import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PlayersService } from '../players/players.service';
import { AuthResult } from './auth.types';
import { PlayerSessionsService } from './player-sessions.service';
import { PlayerSerializerService } from '../players/player-serializer.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly playersService: PlayersService,
    private readonly playerSessionsService: PlayerSessionsService,
    private readonly playerSerializer: PlayerSerializerService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    const nickname = this.normalizeNickname(input.nickname);
    const existingPlayer = await this.playersService.findByNickname(nickname);

    if (existingPlayer) {
      throw new ConflictException('Nickname already exists.');
    }

    const sessionToken = this.createSessionToken();
    const player = await this.playersService.createPlayer({
      nickname,
      passwordHash: this.hashPassword(input.password),
    });
    await this.playerSessionsService.replaceSession(player.id, sessionToken);

    return {
      token: sessionToken,
      player: this.playerSerializer.serializePlayer(player),
    };
  }

  async login(input: LoginDto): Promise<AuthResult> {
    const nickname = this.normalizeNickname(input.nickname);
    const player = await this.playersService.findByNickname(nickname);

    if (!player || !this.verifyPassword(input.password, player.passwordHash)) {
      throw new UnauthorizedException('Invalid nickname or password.');
    }

    const sessionToken = this.createSessionToken();
    await this.playerSessionsService.replaceSession(player.id, sessionToken);
    const updatedPlayer = await this.playersService.findByNickname(nickname);
    if (!updatedPlayer) {
      throw new UnauthorizedException('Player session could not be created.');
    }

    return {
      token: sessionToken,
      player: this.playerSerializer.serializePlayer(updatedPlayer),
    };
  }

  private normalizeNickname(value: string) {
    return value.trim().toLowerCase();
  }

  private createSessionToken() {
    return randomBytes(24).toString('hex');
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedPassword: string) {
    const [salt, storedHash] = storedPassword.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const hashBuffer = scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');

    return storedBuffer.length === hashBuffer.length && timingSafeEqual(storedBuffer, hashBuffer);
  }
}
