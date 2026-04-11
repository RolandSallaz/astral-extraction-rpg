import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthStrategy } from '../strategies/auth.strategy';
import { PlayerEntity } from '../../players/entities/player.entity';

type AuthorizedRequest = Request & {
  player?: PlayerEntity;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authStrategy: AuthStrategy) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    request.player = await this.authStrategy.authenticate(request);
    return true;
  }
}
