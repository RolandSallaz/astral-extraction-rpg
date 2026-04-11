import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerEntity } from '../players/entities/player.entity';
import { PlayerSessionEntity } from './entities/player-session.entity';
import { AuthGuard } from './guards/auth.guard';
import { PlayerSessionsService } from './player-sessions.service';
import { AuthStrategy } from './strategies/auth.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([PlayerEntity, PlayerSessionEntity])],
  providers: [PlayerSessionsService, AuthStrategy, AuthGuard],
  exports: [PlayerSessionsService, AuthStrategy, AuthGuard],
})
export class AuthSessionsModule {}
