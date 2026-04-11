import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PartiesService } from '../parties.service';

@Injectable()
export class LeavePartyUseCase {
  constructor(private readonly partiesService: PartiesService) {}

  execute(player: PlayerEntity) {
    return this.partiesService.leaveParty(player);
  }
}
