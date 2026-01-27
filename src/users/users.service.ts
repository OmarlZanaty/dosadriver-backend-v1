import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type FirebaseDecoded = {
  user_id?: string;
  uid?: string;
  phone_number?: string;
  name?: string;

  // optional custom claims (later)
  role?: string;

  [key: string]: any;
};

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const p = phone.trim();
  return p.length ? p : null;
}


function normalizeName(name: string | null): string | null {
  if (!name) return null;
  const n = name.trim();
  return n.length ? n : null;
}


function getRoleClaim(decoded: FirebaseDecoded): string | null {
  const claim =
    decoded.role ??
    (decoded as any)?.claims?.role ??
    (decoded as any)?.customClaims?.role ??
    null;

  if (!claim) return null;

  const value = String(claim).trim();
  return value.length ? value : null;
}

function parseRole(roleClaim: string | null): UserRole | null {
  if (!roleClaim) return null;

  const r = roleClaim.toUpperCase();

  if (r === 'ADMIN') return UserRole.ADMIN;
  if (r === 'CAPTAIN') return UserRole.CAPTAIN;
  if (r === 'RIDER') return UserRole.RIDER;

  return null;
}



@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert user from Firebase decoded token.
   * - Single source of truth: firebaseUid
   * - Keeps name/phone updated
   * - Prevents phone unique collisions (clears phone from any other user)
   */
 async upsertFromFirebase(decoded: FirebaseDecoded) {
  const firebaseUid = decoded.user_id || decoded.uid;
  if (!firebaseUid) throw new Error('Missing firebase uid');

  const phone = normalizePhone(decoded.phone_number ?? null);
  const name = normalizeName(decoded.name ?? null);

  const roleClaim = getRoleClaim(decoded);
  const parsedRole = parseRole(roleClaim);

  return this.prisma.user.upsert({
    where: { firebaseUid },
    create: {
      firebaseUid,
      phone,
      name,
      role: parsedRole ?? UserRole.RIDER, // default only on CREATE
    },
    update: {
      phone,
      name,
      ...(parsedRole ? { role: parsedRole } : {}), // 🔥 DO NOT overwrite role unless claim exists
    },
  });
}

async setPushToken(userId: number, token: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { pushToken: token },
  });
}

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }

  async setRole(firebaseUid: string, role: UserRole) {
    return this.prisma.user.update({
      where: { firebaseUid },
      data: { role },
    });
  }

  async updateMe(userId: number, dto: { phone?: string }) {
  return this.prisma.user.update({
    where: { id: userId },
    data: {
      ...(dto.phone ? { phone: dto.phone.trim() } : {}),
    },
  });
}

  async updateProfile(
    firebaseUid: string,
    data: { name?: string | null; phone?: string | null },
  ) {
    const phone = normalizePhone(data.phone ?? null);
    const name = normalizeName(data.name ?? null);

    return this.prisma.$transaction(async (tx) => {
      if (phone) {
        const other = await tx.user.findUnique({ where: { phone } });
        if (other && other.firebaseUid !== firebaseUid) {
          await tx.user.update({
            where: { id: other.id },
            data: { phone: null },
          });
        }
      }

      return tx.user.update({
        where: { firebaseUid },
        data: { phone, name },
      });
    });
  }

  /**
   * AppConfig helpers
   */
  async getConfig(key: string) {
    return this.prisma.appConfig.findUnique({ where: { key } });
  }

  async setConfig(key: string, data: Prisma.InputJsonValue, version?: number) {
    return this.prisma.appConfig.upsert({
      where: { key },
      create: {
        key,
        data,
        version: version ?? 1,
      },
      update: {
        data,
        ...(version != null ? { version } : {}),
      },
    });
  }
}
