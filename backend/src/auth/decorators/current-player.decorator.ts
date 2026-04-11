import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PlayerEntity } from '../../players/entities/player.entity';
import { AuthorizedRequest } from '../auth.types';

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    return request.player;
  },
);
