import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { getFirebaseAdminApp } from './firebase-admin';
import { UsersService } from '../users/users.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';


@Injectable()
export class FirebaseAuthGuard implements CanActivate {
constructor(
  private readonly usersService: UsersService,
  private readonly reflector: Reflector,
) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
    ]);
    if (isPublic) return true;


    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = auth.substring('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Empty Bearer token');

    try {
      const app = getFirebaseAdminApp();
      const decoded = await app.auth().verifyIdToken(token);
      console.log('🔎 decoded.role =', (decoded as any).role, 'decoded.claims?.role =', (decoded as any)?.claims?.role);

      // attach firebase decoded
      (req as any).user = decoded;

      // upsert DB user and attach (needed for RolesGuard + ride endpoints)
      const dbUser = await this.usersService.upsertFromFirebase(decoded as any);
      (req as any).dbUser = dbUser;

      return true;
    } catch (err: any) {
      console.error(
        '[FirebaseAuthGuard] verifyIdToken/upsert failed:',
        err?.message ?? err,
      );
      throw new UnauthorizedException(err?.message ?? 'Invalid Firebase token');
    }
  }
}
