import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlayersModule } from '../players/players.module';
import { AuthSessionsModule } from './auth-sessions.module';

@Module({
    imports: [PlayersModule, AuthSessionsModule],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService, AuthSessionsModule],
})
export class AuthModule { }
