import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PartiesService } from '../parties.service';

@Injectable()
export class AckPendingRaidUseCase {
  constructor(private readonly partiesService: PartiesService) {}

  execute(player: PlayerEntity, raidRunId?: string) {
    return this.partiesService.ackPendingRaid(player, raidRunId);
  }
}
