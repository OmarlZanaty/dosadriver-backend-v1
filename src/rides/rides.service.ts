import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RideStatus, UserRole } from '@prisma/client';
import { FirestoreBridgeService } from '../firestore/firestore-bridge.service';
import { NotificationService } from '../notifications/notification.service';

type DbUser = {
  id: number;
  role: UserRole;
};

const TERMINAL_STATUSES: RideStatus[] = [RideStatus.COMPLETED, RideStatus.CANCELED];

function assertNotTerminal(status: RideStatus) {
  if (TERMINAL_STATUSES.includes(status)) {
    throw new ConflictException('TERMINAL_RIDE');
  }
}


function toFiniteNumber(v: any): number | null {
  if (v === null || v === undefined) return null;

  // handle strings like "31.2226" or "31,2226"
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function getByPath(obj: any, path: string): any {
  // supports "pickup.lat" "pickup.location.lat" etc.
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function firstNumber(obj: any, paths: string[]): number | null {
  for (const p of paths) {
    const v = getByPath(obj, p);
    const n = toFiniteNumber(v);
    if (n !== null) return n;
  }
  return null;
}

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bridge: FirestoreBridgeService,
    private readonly notificationService: NotificationService, // <-- new

  ) {}

  // Rider creates a ride request
  async createRide(rider: DbUser, input: any) {
    if (rider.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only RIDER can create rides');
    }

    
    /**
     * ✅ Accept multiple request shapes coming from Flutter:
     * - { pickupLat, pickupLng, dropLat, dropLng }
     * - { pickup: { lat, lng }, drop: { lat, lng } }
     * - { pickup: { latitude, longitude }, drop: { latitude, longitude } }
     * - { pickupLocation: { lat, lng }, destinationLocation: { lat, lng } }
     * - { pickupLocation: { latitude, longitude }, destinationLocation: { latitude, longitude } }
     * - { pickup: { location: { lat, lng } } } ... etc
     */
    const pickupLat = firstNumber(input, [
      'pickupLat',
      'pickup_lat',
      'pickup.latitude',
      'pickup.lat',
      'pickup.location.latitude',
      'pickup.location.lat',
      'pickupLocation.latitude',
      'pickupLocation.lat',
      'pickup_location.latitude',
      'pickup_location.lat',
    ]);

    const pickupLng = firstNumber(input, [
      'pickupLng',
      'pickup_lng',      
      'pickup.longitude',
      'pickup.lng',
      'pickup.location.longitude',
      'pickup.location.lng',
      'pickupLocation.longitude',
      'pickupLocation.lng',
      'pickup_location.longitude',
      'pickup_location.lng',
    ]);

const dropLat = firstNumber(input, [
  'dropLat',
  'drop_lat',
  'drop.latitude',
  'drop.lat',
  'drop.location.latitude',
  'drop.location.lat',

  // ✅ common alternatives
  'destinationLat',
  'destination_lat',
  'destLat',
  'dest_lat',
  'toLat',
  'to_lat',
  'dropoffLat',
  'dropoff_lat',

  // ✅ nested alternatives
  'destination.latitude',
  'destination.lat',
  'destination.location.latitude',
  'destination.location.lat',
  'destinationLocation.latitude',
  'destinationLocation.lat',
  'to.latitude',
  'to.lat',
]);

const dropLng = firstNumber(input, [
  'dropLng',
  'drop_lng',
  'drop.longitude',
  'drop.lng',
  'drop.location.longitude',
  'drop.location.lng',

  // ✅ common alternatives
  'destinationLng',
  'destination_lng',
  'destLng',
  'dest_lng',
  'toLng',
  'to_lng',
  'dropoffLng',
  'dropoff_lng',

  // ✅ nested alternatives
  'destination.longitude',
  'destination.lng',
  'destination.location.longitude',
  'destination.location.lng',
  'destinationLocation.longitude',
  'destinationLocation.lng',
  'to.longitude',
  'to.lng',
]);


    if (
      pickupLat === null ||
      pickupLng === null ||
      dropLat === null ||
      dropLng === null
    ) {
      // ✅ include what we actually parsed (so you immediately know the mismatch)
      throw new BadRequestException({
  message: 'Invalid pickup/drop coordinates',
  parsed: { pickupLat, pickupLng, dropLat, dropLng },
  keys: Object.keys(input ?? {}),
  inputPreview: input, // temporarily, remove later
});

    }

    // Prevent multiple active rides
    const existing = await this.prisma.ride.findFirst({
      where: {
        riderId: rider.id,
        status: {
          in: [
            RideStatus.REQUESTED,
            RideStatus.ACCEPTED,
            RideStatus.ARRIVED,
            RideStatus.STARTED,
          ],
        },
      },
      orderBy: { id: 'desc' },
    });

    if (existing) {
      throw new BadRequestException('You already have an active ride');
    }

    const pickupAddr =
      input?.pickupAddr ??
      input?.pickup_addr ??
      input?.pickupAddress ??
      input?.pickup_address ??
      input?.pickup?.address ??
      input?.pickupLocation?.address ??
      null;

    const dropAddr =
      input?.dropAddr ??
      input?.drop_addr ??
      input?.dropAddress ??
      input?.drop_address ??
      input?.drop?.address ??
      input?.destinationAddress ??
      input?.destination?.address ??
      null;

    const ride = await this.prisma.ride.create({
      data: {
        rider: { connect: { id: rider.id } },
        pickupLat,
        pickupLng,
        pickupAddr,
        dropLat,
        dropLng,
        dropAddr,
        status: RideStatus.REQUESTED,
      },
    });
        await this.notificationService.notifyNewRide(ride);
        await this.bridge.safeUpsertRideMirror(ride);
        return ride;
  }

  async cancelRideByCaptain(captain: DbUser, rideId: number) {
  if (captain.role !== UserRole.CAPTAIN) {
    throw new ForbiddenException('Only CAPTAIN can cancel rides');
  }

  const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw new NotFoundException('Ride not found');

  assertNotTerminal(ride.status);

  // must be his ride
  if (ride.captainId !== captain.id) {
  throw new ForbiddenException('NOT_YOUR_RIDE');
  }

  // allow cancel only before STARTED (you can decide the rule)
  const cancelable: RideStatus[] = [RideStatus.ACCEPTED, RideStatus.ARRIVED];
  if (!cancelable.includes(ride.status)) {
    throw new BadRequestException('Ride cannot be canceled at this status');
  }

  const updated = await this.prisma.ride.update({
    where: { id: rideId },
    data: { status: RideStatus.CANCELED, stateVersion: { increment: 1 } },
  });

  await this.notificationService.notifyRideStatus(updated, 'CANCELED');
  await this.bridge.safeUpsertRideMirror(updated);
  return updated;
}

  // Rider gets their active ride
  async getActiveRideForRider(rider: DbUser) {
    if (rider.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only RIDER can view rider active ride');
    }

    return this.prisma.ride.findFirst({
      where: {
        riderId: rider.id,
        status: {
          in: [
            RideStatus.REQUESTED,
            RideStatus.ACCEPTED,
            RideStatus.ARRIVED,
            RideStatus.STARTED,
          ],
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  // Rider cancels ride (only if not started)
  async cancelRide(rider: DbUser, rideId: number) {
    if (rider.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only RIDER can cancel rides');
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');

    assertNotTerminal(ride.status);

    if (ride.riderId !== rider.id) {
throw new ForbiddenException('NOT_YOUR_RIDE');
    }

    const cancelable: RideStatus[] = [RideStatus.REQUESTED, RideStatus.ACCEPTED];
    if (!cancelable.includes(ride.status)) {
      throw new BadRequestException('Ride cannot be canceled at this status');
    }

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.CANCELED, stateVersion: { increment: 1 } },
    });

    await this.bridge.safeUpsertRideMirror(updated);
    return updated;
  }

  
  // Captain lists open rides
  async listOpenRides(captain: DbUser) {
    if (captain.role !== UserRole.CAPTAIN) {
      throw new ForbiddenException('Only CAPTAIN can list open rides');
    }

    return this.prisma.ride.findMany({
      where: { status: RideStatus.REQUESTED },
      orderBy: { id: 'asc' },
      take: 50,
    });
  }

  // Captain accepts ride
  async acceptRide(captain: DbUser, rideId: number) {
    if (captain.role !== UserRole.CAPTAIN) {
      throw new ForbiddenException('Only CAPTAIN can accept rides');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const ride = await tx.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new NotFoundException('Ride not found');

      if (ride.status !== RideStatus.REQUESTED) {
        throw new BadRequestException('Ride is not available to accept');
      }

      assertNotTerminal(ride.status);

            const currentVersion = (ride as any).stateVersion ?? 0;

      const updated = await tx.ride.updateMany({
        where: {
          id: rideId,
          status: RideStatus.REQUESTED,
          captainId: null,
          stateVersion: currentVersion,
        },
        data: {
          status: RideStatus.ACCEPTED,
          captainId: captain.id,
          stateVersion: currentVersion + 1,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException('RIDE_ALREADY_TAKEN');
      }

      const accepted = await tx.ride.findUnique({ where: { id: rideId } });
      if (!accepted) {
        throw new NotFoundException('Ride not found after accept');
      }
      return accepted;

    });

    await this.notificationService.notifyRideStatus(updated, 'ACCEPTED');
    await this.bridge.safeUpsertRideMirror(updated);
    return updated;
  }

  async captainArrive(captain: DbUser, rideId: number) {
    return this.updateCaptainStatus(
      captain,
      rideId,
      RideStatus.ACCEPTED,
      RideStatus.ARRIVED,
    );
  }

async markRideRefused(captain: DbUser, rideId: number) {
  if (captain.role !== UserRole.CAPTAIN) {
    throw new ForbiddenException('Only CAPTAIN can refuse rides');
  }
  const prismaAny = this.prisma as any;
  await prismaAny.rideVisibility.upsert({
    where: { rideId_captainId: { rideId, captainId: captain.id } },
    create: { rideId, captainId: captain.id, state: 'refused' },
    update: { state: 'refused' },
  });
}

async markRideExpired(captain: DbUser, rideId: number) {
  if (captain.role !== UserRole.CAPTAIN) {
    throw new ForbiddenException('Only CAPTAIN can expire rides');
  }
  const prismaAny = this.prisma as any;
  await prismaAny.rideVisibility.upsert({
    where: { rideId_captainId: { rideId, captainId: captain.id } },
    create: { rideId, captainId: captain.id, state: 'expired' },
    update: { state: 'expired' },
  });
}


  async captainStart(captain: DbUser, rideId: number) {
    return this.updateCaptainStatus(
      captain,
      rideId,
      RideStatus.ARRIVED,
      RideStatus.STARTED,
    );
  }

  async captainComplete(captain: DbUser, rideId: number) {
    return this.updateCaptainStatus(
      captain,
      rideId,
      RideStatus.STARTED,
      RideStatus.COMPLETED,
    );
  }

  async getActiveRideForCaptain(captain: DbUser) {
  if (captain.role !== UserRole.CAPTAIN) {
    throw new ForbiddenException('Only CAPTAIN can view active ride');
  }
  return this.prisma.ride.findFirst({
    where: {
      captainId: captain.id,
      status: { in: [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.STARTED] },
    },
    orderBy: { id: 'desc' },
  });
}

  private async updateCaptainStatus(
    captain: DbUser,
    rideId: number,
    expectedCurrent: RideStatus,
    next: RideStatus,
  ) {
    if (captain.role !== UserRole.CAPTAIN) {
      throw new ForbiddenException('Only CAPTAIN can update ride status');
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');

    assertNotTerminal(ride.status);

    if (ride.captainId !== captain.id) {
    throw new ForbiddenException('NOT_YOUR_RIDE');
    }

    if (ride.status !== expectedCurrent) {
      throw new BadRequestException(
        `Ride must be ${expectedCurrent} to move to ${next}`,
      );
    }

    //const updated = await this.prisma.ride.update({
    //  where: { id: rideId },
    //  data: { status: next, stateVersion: { increment: 1 } },
    //});

    const currentVersion = (ride as any).stateVersion ?? 0;
    const result = await this.prisma.ride.updateMany({
    where: {
    id: rideId,
    captainId: captain.id,
    status: expectedCurrent,
    stateVersion: currentVersion,
    },
    data: { status: next, stateVersion: currentVersion + 1 },
    });
      if (result.count === 0) {
      throw new ConflictException('RIDE_STATE_CONFLICT');
    }
    const updated = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!updated) throw new NotFoundException('Ride not found after update');
    await this.bridge.safeUpsertRideMirror(updated);
    await this.notificationService.notifyRideStatus(updated, next);
    return updated;


  }
}
