import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlayersModule } from '../players/players.module';
import { AuthSessionsModule } from './auth-sessions.module';
import { GetAuthenticatedPlayerQuery } from './use-cases/get-authenticated-player.query';
import { LoginPlayerUseCase } from './use-cases/login-player.use-case';
import { RegisterPlayerUseCase } from './use-cases/register-player.use-case';

@Module({
  imports: [PlayersModule, AuthSessionsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GetAuthenticatedPlayerQuery,
    LoginPlayerUseCase,
    RegisterPlayerUseCase,
  ],
  exports: [AuthService, AuthSessionsModule],
})
export class AuthModule {}
