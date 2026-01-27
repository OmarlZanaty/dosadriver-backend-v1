import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (e: any) {
      console.error('[Prisma] connect failed:', e?.message ?? e);

      // In production, fail hard (correct behavior)
      if (process.env.NODE_ENV === 'production') {
        throw e;
      }
    }
  }
}
