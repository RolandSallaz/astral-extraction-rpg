import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PlayerEntity } from '../../players/entities/player.entity';
import { PlayerSessionsService } from '../player-sessions.service';

@Injectable()
export class AuthStrategy {
  constructor(private readonly playerSessionsService: PlayerSessionsService) {}

  async authenticate(request: Request): Promise<PlayerEntity> {
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing session token.');
    }

    const player = await this.playerSessionsService.findPlayerByToken(token);
    if (!player) {
      throw new UnauthorizedException('Session expired.');
    }

    return player;
  }

  private extractToken(request: Request) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length).trim();
  }
}
