import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PartiesService } from '../parties.service';

@Injectable()
export class SetPartyReadyUseCase {
  constructor(private readonly partiesService: PartiesService) {}

  execute(player: PlayerEntity, ready: boolean) {
    return this.partiesService.setReady(player, ready);
  }
}
