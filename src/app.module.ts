import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NotificationModule } from './notifications/notification.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RidesModule } from './rides/rides.module';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { HealthController } from './health.controller';
import { FirestoreModule } from './firestore/firestore.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RidesModule,
    FirestoreModule, // ✅ ADD THIS
    NotificationModule,

  ],
  controllers: [
    AppController,
    HealthController,
  ],
  providers: [
    // ✅ Fix: AppController depends on AppService
    AppService,

    // ✅ Global guard (respects @Public decorator if you implemented it in the guard)
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {}
