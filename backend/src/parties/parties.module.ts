import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';
import { AckPendingRaidUseCase } from './use-cases/ack-pending-raid.use-case';
import { CreatePartyUseCase } from './use-cases/create-party.use-case';
import { GetMyPartyQuery } from './use-cases/get-my-party.query';
import { JoinPartyUseCase } from './use-cases/join-party.use-case';
import { LeavePartyUseCase } from './use-cases/leave-party.use-case';
import { SetPartyReadyUseCase } from './use-cases/set-party-ready.use-case';

@Module({
  imports: [AuthModule],
  controllers: [PartiesController],
  providers: [
    PartiesService,
    AckPendingRaidUseCase,
    CreatePartyUseCase,
    GetMyPartyQuery,
    JoinPartyUseCase,
    LeavePartyUseCase,
    SetPartyReadyUseCase,
  ],
  exports: [PartiesService],
})
export class PartiesModule {}
