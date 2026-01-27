import { Module } from '@nestjs/common';
import { FirestoreBridgeService } from './firestore-bridge.service';

@Module({
  providers: [FirestoreBridgeService],
  exports: [FirestoreBridgeService],
})
export class FirestoreModule {}
