import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

import { FirebaseAdminService } from './services/firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    FirebaseAdminService,
    FirebaseAuthGuard,
    RolesGuard,
  ],
  exports: [
    FirebaseAdminService,
    FirebaseAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
