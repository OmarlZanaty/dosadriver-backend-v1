import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsersService } from './users.service';

@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(FirebaseAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: any,
    @Body() body: { phone?: string; name?: string },
  ) {
    const decoded = req.user;
    const firebaseUid = decoded?.user_id || decoded?.uid;

    const dbUser = await this.usersService.updateProfile(firebaseUid, {
      phone: body.phone,
      name: body.name,
    });

    return { ok: true, dbUser };
  }
}
