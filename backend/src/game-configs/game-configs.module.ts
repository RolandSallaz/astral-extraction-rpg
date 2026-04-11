import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameConfigsController } from './game-configs.controller';
import { GameConfigsService } from './game-configs.service';

@Module({
  imports: [AuthModule],
  controllers: [GameConfigsController],
  providers: [GameConfigsService],
  exports: [GameConfigsService],
})
export class GameConfigsModule {}
