import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../entities/player.entity';
import { PlayerSerializerService } from '../player-serializer.service';

@Injectable()
export class GetCurrentPlayerQuery {
  constructor(private readonly playerSerializer: PlayerSerializerService) {}

  execute(player: PlayerEntity) {
    return this.playerSerializer.serializePlayer(player);
  }
}
