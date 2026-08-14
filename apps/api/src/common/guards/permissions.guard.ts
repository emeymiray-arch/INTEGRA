import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, getPermissionsForRoles } from '@integra/shared';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthUser } from '../types/auth-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const permissions =
      user.permissions?.length > 0
        ? user.permissions
        : getPermissionsForRoles(user.roles ?? []);
    const hasAny = required.some((p) => permissions.includes(p));

    if (!hasAny) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
