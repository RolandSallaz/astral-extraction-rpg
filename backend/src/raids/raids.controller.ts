import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { StartRaidDto } from './dto/start-raid.dto';
import { RaidsService } from './raids.service';

@UseGuards(AuthGuard)
@Controller('raids')
export class RaidsController {
  constructor(
    private readonly raidsService: RaidsService,
  ) {}

  @Get('templates')
  getTemplates() {
    return this.raidsService.listTemplates();
  }

  @Post('start')
  startRaid(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: StartRaidDto,
  ) {
    return this.raidsService.startRaid(player, body);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.raidsService.getRun(id);
  }
}
