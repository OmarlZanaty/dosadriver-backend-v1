import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './auth/public.decorator';

@Controller('v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.appConfig.findMany({ take: 1 });
    return { api: 'ok', db: 'ok' };
  }
}
