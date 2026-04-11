import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { StartRaidDto } from '../dto/start-raid.dto';
import { RaidsService } from '../raids.service';

@Injectable()
export class StartRaidUseCase {
  constructor(private readonly raidsService: RaidsService) {}

  execute(player: PlayerEntity, input: StartRaidDto) {
    return this.raidsService.startRaid(player, input);
  }
}
