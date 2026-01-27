import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService {
  // You probably already initialize admin in module/provider using Secret Manager.
  // This class just centralizes access.
  auth() {
    return admin.auth();
  }
}
