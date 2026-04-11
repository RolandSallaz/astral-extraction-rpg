import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard } from './guards/auth.guard';
import { CurrentPlayer } from './decorators/current-player.decorator';
import { PlayerEntity } from '../players/entities/player.entity';
import { PlayerSerializerService } from '../players/player-serializer.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentPlayer() player: PlayerEntity) {
    return this.playerSerializer.serializePlayer(player);
  }
}
