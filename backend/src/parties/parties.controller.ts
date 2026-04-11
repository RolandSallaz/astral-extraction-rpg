import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { JoinPartyDto } from './dto/join-party.dto';
import { AckPendingRaidDto } from './dto/ack-pending-raid.dto';
import { SetReadyDto } from './dto/set-ready.dto';
import { AckPendingRaidUseCase } from './use-cases/ack-pending-raid.use-case';
import { CreatePartyUseCase } from './use-cases/create-party.use-case';
import { GetMyPartyQuery } from './use-cases/get-my-party.query';
import { JoinPartyUseCase } from './use-cases/join-party.use-case';
import { LeavePartyUseCase } from './use-cases/leave-party.use-case';
import { SetPartyReadyUseCase } from './use-cases/set-party-ready.use-case';

@UseGuards(AuthGuard)
@Controller('parties')
export class PartiesController {
  constructor(
    private readonly getMyPartyQuery: GetMyPartyQuery,
    private readonly createPartyUseCase: CreatePartyUseCase,
    private readonly joinPartyUseCase: JoinPartyUseCase,
    private readonly setPartyReadyUseCase: SetPartyReadyUseCase,
    private readonly leavePartyUseCase: LeavePartyUseCase,
    private readonly ackPendingRaidUseCase: AckPendingRaidUseCase,
  ) {}

  @Get('me')
  getMyParty(@CurrentPlayer() player: PlayerEntity) {
    return this.getMyPartyQuery.execute(player);
  }

  @Post()
  createParty(@CurrentPlayer() player: PlayerEntity) {
    return this.createPartyUseCase.execute(player);
  }

  @Post('join')
  joinParty(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: JoinPartyDto,
  ) {
    return this.joinPartyUseCase.execute(player, body);
  }

  @Post('ready')
  setReady(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: SetReadyDto,
  ) {
    return this.setPartyReadyUseCase.execute(player, body.ready);
  }

  @Post('leave')
  leaveParty(@CurrentPlayer() player: PlayerEntity) {
    return this.leavePartyUseCase.execute(player);
  }

  @Post('ack-raid')
  ackPendingRaid(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: AckPendingRaidDto,
  ) {
    return this.ackPendingRaidUseCase.execute(player, body.raidRunId);
  }
}
