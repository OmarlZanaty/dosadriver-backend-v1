import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  async me(@Req() req: Request & { user?: any }) {
    const decoded = req.user; // set by FirebaseAuthGuard
    const uid = decoded?.user_id || decoded?.uid;

    const dbUser = await this.usersService.upsertFromFirebase(decoded);

    return {
      ok: true,
      uid,
      user: decoded, // firebase claims
      dbUser,        // postgres row
    };
  }
}
