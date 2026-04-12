import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../entities/player.entity';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { PlayersService } from '../players.service';
import { PlayerSerializerService } from '../player-serializer.service';

@Injectable()
export class UpdatePlayerProfileUseCase {
  constructor(
    private readonly playersService: PlayersService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  async execute(player: PlayerEntity, input: UpdatePlayerDto) {
    const updatedPlayer = await this.playersService.updatePlayer(player, input);
    return this.playerSerializer.serializePlayer(updatedPlayer);
  }
}
