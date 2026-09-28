import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) return false;

    const result = await this.db.query<{ code: string }>(
      `SELECT DISTINCT p.code
       FROM management.user_role ur
       JOIN management.role_permission rp ON rp.role_id = ur.role_id
       JOIN management.permission p ON p.permission_id = rp.permission_id
       WHERE ur.user_id = $1`,
      [user.userId],
    );
    const granted = new Set(result.rows.map((row) => row.code));
    return requiredPermissions.every((permission) => granted.has(permission));
  }
}
