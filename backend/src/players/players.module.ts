import { Module } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerEntity } from './entities/player.entity';
import { PlayerItemEntity } from './entities/player-item.entity';
import { ItemsModule } from '../items/items.module';
import { PlayerInventoryService } from './player-inventory.service';
import { PlayerSerializerService } from './player-serializer.service';
import { AuthSessionsModule } from '../auth/auth-sessions.module';
import { GetCurrentPlayerQuery } from './use-cases/get-current-player.query';
import { GrantItemUseCase } from './use-cases/grant-item.use-case';
import { UpdatePlayerProfileUseCase } from './use-cases/update-player-profile.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayerEntity, PlayerItemEntity]),
    ItemsModule,
    AuthSessionsModule,
  ],
  controllers: [PlayersController],
  providers: [
    PlayersService,
    PlayerInventoryService,
    PlayerSerializerService,
    GetCurrentPlayerQuery,
    GrantItemUseCase,
    UpdatePlayerProfileUseCase,
  ],
  exports: [PlayersService, PlayerInventoryService, PlayerSerializerService],
})
export class PlayersModule {}
