// src/firestore/firestore-bridge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { getFirebaseAdminApp } from '../auth/firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

type RideLike = {
  id: number;
  status: any; // Prisma enum -> string
  stateVersion?: number;
  riderId: number;
  captainId: number | null;
  pickupLat: number;
  pickupLng: number;
  pickupAddr: string | null;
  dropLat: number;
  dropLng: number;
  dropAddr: string | null;
  createdAt: Date;
  updatedAt: Date;
};


@Injectable()
export class FirestoreBridgeService {
  private readonly logger = new Logger(FirestoreBridgeService.name);

  private firestore() {
    const app = getFirebaseAdminApp();
    return app.firestore();
  }

  /**
   * Upserts rides/{rideId} mirror doc.
   * IMPORTANT: must never throw (do not break ride APIs if Firestore fails).
   */
  constructor(private readonly prisma: PrismaService) {}

  async safeUpsertRideMirror(ride: RideLike): Promise<void> {

      let captainUid: string | null = null;
      if (ride.captainId) {
        const captain = await this.prisma.user.findUnique({ where: { id: ride.captainId }});
        captainUid = captain?.firebaseUid ?? null;
      }

    try {
      const id = String(ride.id);
      const status = String(ride.status ?? '').toUpperCase(); // ✅ Firestore mirror must be UPPERCASE

      const terminal =
        status === 'COMPLETED' || status === 'CANCELED';

      const payload = {
        id: ride.id,

        // Keep existing 'status' for backward compatibility with apps
        status,
        stateVersion: (ride as any).stateVersion ?? 0,

        // ✅ Phase 1 safety fields
        backendStatus: status,              // explicit: backend says so
        terminal,                           // true if COMPLETED/CANCELED
        backendExists: true,                // helps apps auto-repair
        lastBackendSyncAt: Date.now(),      // ms epoch (freshness)
        captainUid,  // <--- new field

        riderId: ride.riderId,
        captainId: ride.captainId ?? null,

        pickup: {
          lat: ride.pickupLat,
          lng: ride.pickupLng,
          addr: ride.pickupAddr ?? null,
        },
        drop: {
          lat: ride.dropLat,
          lng: ride.dropLng,
          addr: ride.dropAddr ?? null,
        },

        createdAt: ride.createdAt?.toISOString?.() ?? null,
        updatedAt: ride.updatedAt?.toISOString?.() ?? null,

        // helpful numeric timestamps for clients
        createdAtMs: ride.createdAt ? new Date(ride.createdAt).getTime() : null,
        updatedAtMs: ride.updatedAt ? new Date(ride.updatedAt).getTime() : null,

        source: 'backend_v1',
      };



      await this.firestore()
        .collection('rides')
        .doc(id)
        .set(payload, { merge: true });
    } catch (err: any) {
      this.logger.error(
        `Firestore mirror failed for ride=${ride?.id}: ${err?.message ?? err}`,
        err?.stack,
      );
      // ✅ swallow
    }
  }
}
