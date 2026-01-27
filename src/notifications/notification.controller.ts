import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { Req } from '@nestjs/common';

@Controller('v1/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // register device token for current user
  @UseGuards(FirebaseAuthGuard)
  @Post('register')
  async registerToken(@Body() body: { token: string }, @Req() req: any) {
    const { token } = body;
    await req.dbUser; // the guard sets dbUser
    await req.dbUser.$set('pushToken', token);
    return { ok: true };
  }

  // admin broadcast endpoint
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('broadcast')
  async adminBroadcast(@Body() body: { role?: UserRole; title: string; body: string }) {
    const { role, title, body: msg } = body;
    const targetRole = role ?? null;
    await this.notificationService.notifyAdminBroadcast(targetRole, title, msg);
    return { ok: true };
  }
}
