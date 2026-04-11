import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { JoinPartyDto } from './dto/join-party.dto';
import { AckPendingRaidDto } from './dto/ack-pending-raid.dto';
import { SetReadyDto } from './dto/set-ready.dto';
import { PartiesService } from './parties.service';

@UseGuards(AuthGuard)
@Controller('parties')
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
  ) {}

  @Get('me')
  getMyParty(@CurrentPlayer() player: PlayerEntity) {
    return this.partiesService.getPartyForPlayer(player);
  }

  @Post()
  createParty(@CurrentPlayer() player: PlayerEntity) {
    return this.partiesService.createParty(player);
  }

  @Post('join')
  joinParty(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: JoinPartyDto,
  ) {
    return this.partiesService.joinParty(player, body);
  }

  @Post('ready')
  setReady(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: SetReadyDto,
  ) {
    return this.partiesService.setReady(player, body.ready);
  }

  @Post('leave')
  leaveParty(@CurrentPlayer() player: PlayerEntity) {
    return this.partiesService.leaveParty(player);
  }

  @Post('ack-raid')
  ackPendingRaid(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: AckPendingRaidDto,
  ) {
    return this.partiesService.ackPendingRaid(player, body.raidRunId);
  }
}
