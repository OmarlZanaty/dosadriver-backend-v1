import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RidesService } from './rides.service';

@Controller('v1')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  // ---------- Rider endpoints ----------

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rides')
  async createRide(@Req() req: any, @Body() body: any) {
    const rider = req.dbUser;
    return {
      ok: true,
      ride: await this.ridesService.createRide(rider, body),
    };
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rides/active')
  async getActiveRide(@Req() req: any) {
    const rider = req.dbUser;
    const ride = await this.ridesService.getActiveRideForRider(rider);
    return { ok: true, ride: ride ?? null };
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rides/:id/cancel')
  async cancelRide(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const rider = req.dbUser;
    const ride = await this.ridesService.cancelRide(rider, id);
    return { ok: true, ride };
  }

  // ---------- Captain endpoints ----------

@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Post('rides/:id/cancel/captain')
async cancelByCaptain(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
  const captain = req.dbUser;
  const ride = await this.ridesService.cancelRideByCaptain(captain, id);
  return { ok: true, ride };
}

// GET /v1/captain/rides/active
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Get('captain/rides/active')
async getActiveRideForCaptain(@Req() req: any) {
  const captain = req.dbUser;
  const ride = await this.ridesService.getActiveRideForCaptain(captain);
  return { ok: true, ride: ride ?? null };
}



@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Get('captain/rides/open')
async listOpenRides(@Req() req: any) {
  const captain = req.dbUser;
  const rides = await this.ridesService.listOpenRides(captain);
  return { ok: true, rides };
}

@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Post('rides/:id/refuse')
async refuse(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
  const captain = req.dbUser;
  await this.ridesService.markRideRefused(captain, id);
  return { ok: true };
}

@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Post('rides/:id/expire')
async expire(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
  const captain = req.dbUser;
  await this.ridesService.markRideExpired(captain, id);
  return { ok: true };
}



@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.CAPTAIN)
@Post('rides/:id/accept')
async acceptRide(
  @Req() req: any,
  @Param('id', ParseIntPipe) id: number,
) {
  const captain = req.dbUser;
  const ride = await this.ridesService.acceptRide(captain, id);
  return { ok: true, ride };
}


  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.CAPTAIN)
  @Post('rides/:id/arrive')
  async arrive(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const captain = req.dbUser;
    const ride = await this.ridesService.captainArrive(captain, id);
    return { ok: true, ride };
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.CAPTAIN)
  @Post('rides/:id/start')
  async start(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const captain = req.dbUser;
    const ride = await this.ridesService.captainStart(captain, id);
    return { ok: true, ride };
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.CAPTAIN)
  @Post('rides/:id/complete')
  async complete(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const captain = req.dbUser;
    const ride = await this.ridesService.captainComplete(captain, id);
    return { ok: true, ride };
  }
}


