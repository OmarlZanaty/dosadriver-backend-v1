import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    // No roles required => allow
    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<any>();
    const dbUser = req.dbUser; // we will attach this in AuthController or guard flow
    if (!dbUser?.role) {
      throw new ForbiddenException('Missing dbUser role');
    }

    if (!requiredRoles.includes(dbUser.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
