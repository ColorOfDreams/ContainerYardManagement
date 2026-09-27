import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) return false;

    const memberships = await this.prisma.userRole.findMany({
      where: { userId: user.userId },
      select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
    });
    const granted = new Set(
      memberships.flatMap((membership) => membership.role.permissions.map(({ permission }) => permission.code)),
    );
    return requiredPermissions.every((permission) => granted.has(permission));
  }
}
