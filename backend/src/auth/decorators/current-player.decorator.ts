import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthorizedRequest } from '../auth.types';

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    return request.player;
  },
);
