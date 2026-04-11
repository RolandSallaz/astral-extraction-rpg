import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { UpdateMobBalanceDto } from '../dto/update-mob-balance.dto';
import { UpdateMobVisualsDto } from '../dto/update-mob-visuals.dto';
import { UpdateSkillBalanceDto } from '../dto/update-skill-balance.dto';
import { GameConfigsService } from '../game-configs.service';
import type { ItemBalanceEntry } from '../item-balance.defaults';

@Injectable()
export class UpdateGameConfigsUseCase {
  constructor(private readonly gameConfigsService: GameConfigsService) {}

  skillBalance(player: PlayerEntity, input: UpdateSkillBalanceDto) {
    return this.gameConfigsService.updateSkillBalance(player, input);
  }

  mobBalance(player: PlayerEntity, input: UpdateMobBalanceDto) {
    return this.gameConfigsService.updateMobBalance(player, input);
  }

  itemBalance(player: PlayerEntity, input: Record<string, Partial<ItemBalanceEntry>>) {
    return this.gameConfigsService.updateItemBalance(player, input);
  }

  mobVisuals(player: PlayerEntity, input: UpdateMobVisualsDto) {
    return this.gameConfigsService.updateMobVisuals(player, input);
  }
}
