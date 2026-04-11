import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameConfigsController } from './game-configs.controller';
import { GameConfigsService } from './game-configs.service';
import { GetGameConfigsQuery } from './use-cases/get-game-configs.query';
import { UpdateGameConfigsUseCase } from './use-cases/update-game-configs.use-case';
import { GameContentRepository } from '../content/game-content.repository';

@Module({
  imports: [AuthModule],
  controllers: [GameConfigsController],
  providers: [
    GameContentRepository,
    GameConfigsService,
    GetGameConfigsQuery,
    UpdateGameConfigsUseCase,
  ],
  exports: [GameConfigsService],
})
export class GameConfigsModule {}
