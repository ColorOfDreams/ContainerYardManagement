import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { TokenPair } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const result = await this.db.query<{
      user_id: string;
      email: string;
      password_hash: string;
      is_active: boolean;
      role_codes: string[];
    }>(
      `SELECT u.user_id, u.email, u.password_hash, u.is_active,
              array_remove(array_agg(r.code), NULL) AS role_codes
       FROM management.user u
       LEFT JOIN management.user_role ur ON ur.user_id = u.user_id
       LEFT JOIN management.role r ON r.role_id = ur.role_id
       WHERE u.email = $1
       GROUP BY u.user_id, u.email, u.password_hash, u.is_active`,
      [dto.email.toLowerCase()],
    );
    const user = result.rows[0];
    const validPassword = user && (await bcrypt.compare(dto.password, user.password_hash));
    if (!user || !validPassword || !user.is_active) {
      throw new UnauthorizedException('Email hoặc mật khẩu không hợp lệ');
    }

    return this.issueTokens(user.user_id, user.email, user.role_codes);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const [tokenId, secret] = rawRefreshToken.split('.', 2);
    if (!tokenId || !secret) throw new UnauthorizedException('Refresh token không hợp lệ');

    const result = await this.db.query<{
      refresh_token_id: string;
      token_hash: string;
      expires_at: Date;
      revoked_at: Date | null;
      user_id: string;
      email: string;
      is_active: boolean;
      role_codes: string[];
    }>(
      `SELECT rt.refresh_token_id, rt.token_hash, rt.expires_at, rt.revoked_at,
              u.user_id, u.email, u.is_active,
              array_remove(array_agg(r.code), NULL) AS role_codes
       FROM management.refresh_token rt
       JOIN management.user u ON u.user_id = rt.user_id
       LEFT JOIN management.user_role ur ON ur.user_id = u.user_id
       LEFT JOIN management.role r ON r.role_id = ur.role_id
       WHERE rt.refresh_token_id = $1
       GROUP BY rt.refresh_token_id, rt.token_hash, rt.expires_at, rt.revoked_at, u.user_id, u.email, u.is_active`,
      [tokenId],
    );
    const token = result.rows[0];
    const valid = token && !token.revoked_at && token.expires_at > new Date() &&
      (await bcrypt.compare(secret, token.token_hash));
    if (!token || !valid || !token.is_active) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Rotation: a token is single-use. A stolen old refresh token cannot be reused.
    await this.db.query(
      `UPDATE management.refresh_token SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_id = $1`,
      [token.refresh_token_id],
    );
    return this.issueTokens(token.user_id, token.email, token.role_codes);
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const [tokenId] = rawRefreshToken.split('.', 2);
    if (!tokenId) return;
    await this.db.query(
      `UPDATE management.refresh_token
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE refresh_token_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [tokenId, userId],
    );
  }

  // [MỚI] FR Auth — Quên mật khẩu. KHÔNG có hạ tầng gửi email thật (đã quyết
  // định bỏ notification/queue — xem docs), nên "gửi" bằng cách LOG token ra
  // console thay vì email — đủ để test luồng, không giả vờ đã tích hợp email.
  async forgotPassword(email: string): Promise<void> {
    const result = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM management.user WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()],
    );
    if (result.rows.length === 0) {
      // Không throw lỗi — tránh lộ thông tin email nào tồn tại trong hệ thống.
      return;
    }
    const userId = result.rows[0].user_id;

    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ
    const tokenResult = await this.db.query<{ reset_token_id: string }>(
      `INSERT INTO management.password_reset_token (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING reset_token_id`,
      [userId, await bcrypt.hash(secret, 12), expiresAt],
    );
    const rawToken = `${tokenResult.rows[0].reset_token_id}.${secret}`;
    this.logger.log(`[DEV] Reset password token cho ${email} (chưa có email thật, dùng token này để test): ${rawToken}`);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const [tokenId, secret] = rawToken.split('.', 2);
    if (!tokenId || !secret) throw new BadRequestException('Token không hợp lệ');

    const result = await this.db.query<{
      reset_token_id: string;
      user_id: string;
      token_hash: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT reset_token_id, user_id, token_hash, expires_at, used_at
       FROM management.password_reset_token WHERE reset_token_id = $1`,
      [tokenId],
    );
    const token = result.rows[0];
    const valid = token && !token.used_at && token.expires_at > new Date() && (await bcrypt.compare(secret, token.token_hash));
    if (!valid) throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');

    await this.db.transaction(async (client) => {
      await client.query(`UPDATE management.user SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`, [
        await bcrypt.hash(newPassword, 12),
        token.user_id,
      ]);
      await client.query(`UPDATE management.password_reset_token SET used_at = CURRENT_TIMESTAMP WHERE reset_token_id = $1`, [
        token.reset_token_id,
      ]);
      // Đổi mật khẩu xong thì thu hồi toàn bộ refresh token cũ — phòng trường
      // hợp mật khẩu bị lộ, kẻ tấn công đã có refresh token từ trước.
      await client.query(`UPDATE management.refresh_token SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`, [
        token.user_id,
      ]);
    });
  }

  private async issueTokens(userId: string, email: string, roles: string[]): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, roles },
      { expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m' },
    );
    const secret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000);
    const result = await this.db.query<{ refresh_token_id: string }>(
      `INSERT INTO management.refresh_token (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING refresh_token_id`,
      [userId, await bcrypt.hash(secret, 12), expiresAt],
    );
    return { accessToken, refreshToken: `${result.rows[0].refresh_token_id}.${secret}` };
  }

  private refreshTtlDays(): number {
    const value = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? 7);
    return Number.isSafeInteger(value) && value > 0 && value <= 90 ? value : 7;
  }
}
