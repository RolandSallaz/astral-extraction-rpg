import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { UpdateMobBalanceDto } from './dto/update-mob-balance.dto';
import { UpdateMobVisualsDto } from './dto/update-mob-visuals.dto';
import { UpdateSkillBalanceDto } from './dto/update-skill-balance.dto';
import type { ItemBalanceEntry } from './item-balance.defaults';
import { GameConfigsService } from './game-configs.service';

@Controller('game-configs')
export class GameConfigsController {
  constructor(
    private readonly gameConfigsService: GameConfigsService,
  ) {}

  @Get('skill-balance')
  getSkillBalance() {
    return this.gameConfigsService.getSkillBalance();
  }

  @Get('mob-balance')
  getMobBalance() {
    return this.gameConfigsService.getMobBalance();
  }

  @Get('item-balance')
  getItemBalance() {
    return this.gameConfigsService.getItemBalance();
  }

  @Get('mob-visuals')
  getMobVisuals() {
    return this.gameConfigsService.getMobVisuals();
  }

  @UseGuards(AuthGuard)
  @Patch('skill-balance')
  updateSkillBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateSkillBalanceDto,
  ) {
    return this.gameConfigsService.updateSkillBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('mob-balance')
  updateMobBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateMobBalanceDto,
  ) {
    return this.gameConfigsService.updateMobBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('item-balance')
  updateItemBalance(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: Record<string, Partial<ItemBalanceEntry>>,
  ) {
    return this.gameConfigsService.updateItemBalance(player, body);
  }

  @UseGuards(AuthGuard)
  @Patch('mob-visuals')
  updateMobVisuals(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: UpdateMobVisualsDto,
  ) {
    return this.gameConfigsService.updateMobVisuals(player, body);
  }
}
