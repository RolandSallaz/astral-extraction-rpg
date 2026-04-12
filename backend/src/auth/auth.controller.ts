import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard } from './guards/auth.guard';
import { CurrentPlayer } from './decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { GetAuthenticatedPlayerQuery } from './use-cases/get-authenticated-player.query';
import { LoginPlayerUseCase } from './use-cases/login-player.use-case';
import { RegisterPlayerUseCase } from './use-cases/register-player.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerPlayerUseCase: RegisterPlayerUseCase,
    private readonly loginPlayerUseCase: LoginPlayerUseCase,
    private readonly getAuthenticatedPlayerQuery: GetAuthenticatedPlayerQuery,
  ) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.registerPlayerUseCase.execute(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.loginPlayerUseCase.execute(body);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentPlayer() player: PlayerEntity) {
    return this.getAuthenticatedPlayerQuery.execute(player);
  }
}
