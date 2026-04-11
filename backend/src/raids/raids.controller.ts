import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { StartRaidDto } from './dto/start-raid.dto';
import { GetRaidRunQuery } from './use-cases/get-raid-run.query';
import { GetRaidTemplatesQuery } from './use-cases/get-raid-templates.query';
import { StartRaidUseCase } from './use-cases/start-raid.use-case';

@UseGuards(AuthGuard)
@Controller('raids')
export class RaidsController {
  constructor(
    private readonly getRaidTemplatesQuery: GetRaidTemplatesQuery,
    private readonly startRaidUseCase: StartRaidUseCase,
    private readonly getRaidRunQuery: GetRaidRunQuery,
  ) {}

  @Get('templates')
  getTemplates() {
    return this.getRaidTemplatesQuery.execute();
  }

  @Post('start')
  startRaid(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: StartRaidDto,
  ) {
    return this.startRaidUseCase.execute(player, body);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.getRaidRunQuery.execute(id);
  }
}
