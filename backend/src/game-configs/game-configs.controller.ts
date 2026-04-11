import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { UpdateMobBalanceDto } from './dto/update-mob-balance.dto';
import { UpdateMobVisualsDto } from './dto/update-mob-visuals.dto';
import { UpdateSkillBalanceDto } from './dto/update-skill-balance.dto';
import type { ItemBalanceEntry } from './item-balance.defaults';
import { GetGameConfigsQuery } from './use-cases/get-game-configs.query';
import { UpdateGameConfigsUseCase } from './use-cases/update-game-configs.use-case';

@Controller('game-configs')
export class GameConfigsController {
  constructor(
    private readonly getGameConfigsQuery: GetGameConfigsQuery,
    private readonly updateGameConfigsUseCase: UpdateGameConfigsUseCase,
  ) {}

  @Get('skill-balance')
  getSkillBalance() {
    return this.getGameConfigsQuery.skillBalance();
  }

  @Get('mob-balance')
  getMobBalance() {
    return this.getGameConfigsQuery.mobBalance();
  }

  @Get('item-balance')
  getItemBalance() {
    return this.getGameConfigsQuery.itemBalance();
  }

  @Get('mob-visuals')
  getMobVisuals() {
    return this.getGameConfigsQuery.mobVisuals();
  }

  @Get('content-version')
  getContentVersion() {
    return this.getGameConfigsQuery.contentVersion();
  }

  @Get('content-snapshot')
  getContentSnapshot() {
    return this.getGameConfigsQuery.contentSnapshot();
  }

  @UseGuards(AuthGuard)
  @Patch('skill-balance')
  updateSkillBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateSkillBalanceDto,
  ) {
    return this.updateGameConfigsUseCase.skillBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('mob-balance')
  updateMobBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateMobBalanceDto,
  ) {
    return this.updateGameConfigsUseCase.mobBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('item-balance')
  updateItemBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: Record<string, Partial<ItemBalanceEntry>>,
  ) {
    return this.updateGameConfigsUseCase.itemBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('mob-visuals')
  updateMobVisuals(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateMobVisualsDto,
  ) {
    return this.updateGameConfigsUseCase.mobVisuals(player, body);
  }
}
