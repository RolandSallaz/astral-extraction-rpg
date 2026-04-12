import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { GiveItemDto } from './dto/give-item.dto';
import { PlayerEntity } from './entities/player.entity';
import { GetCurrentPlayerQuery } from './use-cases/get-current-player.query';
import { GrantItemUseCase } from './use-cases/grant-item.use-case';
import { UpdatePlayerProfileUseCase } from './use-cases/update-player-profile.use-case';

@UseGuards(AuthGuard)
@Controller('players')
export class PlayersController {
  constructor(
    private readonly getCurrentPlayerQuery: GetCurrentPlayerQuery,
    private readonly updatePlayerProfileUseCase: UpdatePlayerProfileUseCase,
    private readonly grantItemUseCase: GrantItemUseCase,
  ) {}

  @Get('me')
  getMe(@CurrentPlayer() player: PlayerEntity) {
    return this.getCurrentPlayerQuery.execute(player);
  }

  @Patch('me')
  async updateMe(@CurrentPlayer() player: PlayerEntity, @Body() body: UpdatePlayerDto) {
    return this.updatePlayerProfileUseCase.execute(player, body);
  }

  @Post('admin/give-item')
  async giveItem(
    @CurrentPlayer() player: PlayerEntity,
    @Body() body: GiveItemDto,
  ) {
    return this.grantItemUseCase.execute(player, body);
  }
}
