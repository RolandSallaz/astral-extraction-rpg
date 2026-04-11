import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PlayerSerializerService } from '../../players/player-serializer.service';

@Injectable()
export class GetAuthenticatedPlayerQuery {
  constructor(private readonly playerSerializer: PlayerSerializerService) {}

  execute(player: PlayerEntity) {
    return this.playerSerializer.serializePlayer(player);
  }
}
