import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { JoinPartyDto } from '../dto/join-party.dto';
import { PartiesService } from '../parties.service';

@Injectable()
export class JoinPartyUseCase {
  constructor(private readonly partiesService: PartiesService) {}

  execute(player: PlayerEntity, input: JoinPartyDto) {
    return this.partiesService.joinParty(player, input);
  }
}
