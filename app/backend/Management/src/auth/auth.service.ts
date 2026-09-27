import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenPair } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    const validPassword = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !validPassword || !user.isActive) {
      throw new UnauthorizedException('Email hoặc mật khẩu không hợp lệ');
    }

    return this.issueTokens(user.userId, user.email, user.roles.map(({ role }) => role.code));
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const [tokenId, secret] = rawRefreshToken.split('.', 2);
    if (!tokenId || !secret) throw new UnauthorizedException('Refresh token không hợp lệ');

    const token = await this.prisma.refreshToken.findUnique({
      where: { refreshTokenId: tokenId },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    const valid = token && !token.revokedAt && token.expiresAt > new Date() &&
      (await bcrypt.compare(secret, token.tokenHash));
    if (!token || !valid || !token.user.isActive) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Rotation: a token is single-use. A stolen old refresh token cannot be reused.
    await this.prisma.refreshToken.update({
      where: { refreshTokenId: token.refreshTokenId },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(token.user.userId, token.user.email, token.user.roles.map(({ role }) => role.code));
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const [tokenId] = rawRefreshToken.split('.', 2);
    if (!tokenId) return;
    await this.prisma.refreshToken.updateMany({
      where: { refreshTokenId: tokenId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, email: string, roles: string[]): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, roles },
      { expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m' },
    );
    const secret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000);
    const refreshToken = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: await bcrypt.hash(secret, 12), expiresAt },
      select: { refreshTokenId: true },
    });
    return { accessToken, refreshToken: `${refreshToken.refreshTokenId}.${secret}` };
  }

  private refreshTtlDays(): number {
    const value = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? 7);
    return Number.isSafeInteger(value) && value > 0 && value <= 90 ? value : 7;
  }
}
