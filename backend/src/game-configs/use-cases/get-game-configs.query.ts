import { Injectable } from '@nestjs/common';
import { GameConfigsService } from '../game-configs.service';

@Injectable()
export class GetGameConfigsQuery {
  constructor(private readonly gameConfigsService: GameConfigsService) {}

  skillBalance() {
    return this.gameConfigsService.getSkillBalance();
  }

  mobBalance() {
    return this.gameConfigsService.getMobBalance();
  }

  itemBalance() {
    return this.gameConfigsService.getItemBalance();
  }

  mobVisuals() {
    return this.gameConfigsService.getMobVisuals();
  }

  contentVersion() {
    return this.gameConfigsService.getContentVersion();
  }

  contentSnapshot() {
    return this.gameConfigsService.getContentSnapshot();
  }
}
