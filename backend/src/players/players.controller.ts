import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { GiveItemDto } from './dto/give-item.dto';
import { PlayersService } from './players.service';
import { PlayerEntity } from './entities/player.entity';
import { PlayerSerializerService } from './player-serializer.service';

@UseGuards(AuthGuard)
@Controller('players')
export class PlayersController {
  constructor(
    private readonly playersService: PlayersService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  @Get('me')
  getMe(@CurrentPlayer() player: PlayerEntity) {
    return this.playerSerializer.serializePlayer(player);
  }

  @Patch('me')
  async updateMe(@CurrentPlayer() player: PlayerEntity, @Body() body: UpdatePlayerDto) {
    const updatedPlayer = await this.playersService.updatePlayer(player, body);
    return this.playerSerializer.serializePlayer(updatedPlayer);
  }

  @Post('admin/give-item')
  async giveItem(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: GiveItemDto,
  ) {
    const updatedPlayer = await this.playersService.giveItemToPlayer(
      player,
      body.nickname,
      body.itemCode,
    );

    return this.playerSerializer.serializePlayer(updatedPlayer);
  }
}
