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

@Module({
    imports: [
      TypeOrmModule.forFeature([PlayerEntity, PlayerItemEntity]),
      ItemsModule,
      AuthSessionsModule,
    ],
    controllers: [PlayersController],
    providers: [PlayersService, PlayerInventoryService, PlayerSerializerService],
    exports: [PlayersService, PlayerInventoryService, PlayerSerializerService],

})
export class PlayersModule { }
