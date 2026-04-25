import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { AuthenticatedUser } from '../common/contracts';
import {
  PERMISSIONS_KEY,
  Permission,
  ROLE_PERMISSIONS,
  ROLES_KEY,
  RoleName
} from './access-control';

@Injectable()
export class RbacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const allowedRoles =
      (Reflect.getMetadata(ROLES_KEY, context.getHandler()) as RoleName[] | undefined) ??
      (Reflect.getMetadata(ROLES_KEY, context.getClass()) as RoleName[] | undefined) ??
      [];

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Role access denied');
    }

    const requiredPermissions =
      (Reflect.getMetadata(PERMISSIONS_KEY, context.getHandler()) as Permission[] | undefined) ??
      (Reflect.getMetadata(PERMISSIONS_KEY, context.getClass()) as Permission[] | undefined) ??
      [];

    if (requiredPermissions.length > 0) {
      const userPermissions = user.permissions ?? ROLE_PERMISSIONS[user.role];
      const missing = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission)
      );
      if (missing.length > 0) {
        throw new ForbiddenException('Permission denied');
      }
    }

    return true;
  }
}
