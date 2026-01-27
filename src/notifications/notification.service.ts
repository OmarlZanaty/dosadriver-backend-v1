import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {
    // Initialize Firebase if it hasn't been initialized already
    if (!admin.apps.length) {
      let serviceAccount: admin.ServiceAccount | undefined;

      // Prefer credentials supplied as a JSON string
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        // Otherwise load from the given file path
        const serviceAccountPath = process.env
          .FIREBASE_SERVICE_ACCOUNT_PATH as string;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        serviceAccount = require(serviceAccountPath);
      }

      if (!serviceAccount) {
        throw new Error(
          'No Firebase service account configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.',
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, any> = {},
  ) {
    if (!tokens.length) return;
    const message = {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
      tokens,
    };
    try {
      const res = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Push sent: success=${res.successCount} failure=${res.failureCount}`,
      );
    } catch (e) {
      this.logger.error(`Push failed: ${e}`);
    }
  }

  async notifyRideStatus(ride: any, status: string) {
    const rider = await this.prisma.user.findUnique({
      where: { id: ride.riderId },
    });
    if (!rider?.pushToken) return;

    let title = '';
    let body = '';
    switch (status) {
      case 'ACCEPTED':
        title = 'Ride accepted';
        body = 'Your driver is on the way.';
        break;
      case 'ARRIVED':
        title = 'Driver arrived';
        body = 'Your driver has arrived at the pickup location.';
        break;
      case 'STARTED':
        title = 'Trip started';
        body = 'Enjoy your ride!';
        break;
      case 'COMPLETED':
        title = 'Trip completed';
        body = 'Thank you for riding with us.';
        break;
      case 'CANCELED':
        title = 'Ride canceled';
        body = 'Your ride has been canceled.';
        break;
      default:
        return;
    }

    await this.sendToTokens(
      [rider.pushToken],
      title,
      body,
      { rideId: String(ride.id), status },
    );
  }

  async notifyNewRide(ride: any) {
    // Notify all available captains with a registered token and no active ride
    const captains = await this.prisma.user.findMany({
      where: {
        role: UserRole.CAPTAIN,
        pushToken: { not: null },
        captainRides: {
          none: { status: { in: ['ACCEPTED', 'ARRIVED', 'STARTED'] } },
        },
      },
      select: { pushToken: true },
    });
    const tokens = captains
      .map((u) => u.pushToken!)
      .filter(Boolean);
    await this.sendToTokens(tokens, 'New ride request', 'A rider has requested a ride', {
      rideId: String(ride.id),
    });
  }

  async notifyAdminBroadcast(targetRole: UserRole | null, title: string, body: string) {
    const where: any = { pushToken: { not: null } };
    if (targetRole) {
      where.role = targetRole;
    }
    const users = await this.prisma.user.findMany({
      where,
      select: { pushToken: true },
    });
    const tokens = users.map((u) => u.pushToken!).filter(Boolean);
    await this.sendToTokens(tokens, title, body);
  }
}
