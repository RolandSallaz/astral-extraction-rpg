import type { Request } from 'express';
import { PlayerEntity } from 'src/players/entities/player.entity';
import { SerializedPlayer } from '../players/player.types';

export type AuthResult = {
  token: string;
  player: SerializedPlayer;
};

export type AuthorizedRequest = Request & {
  player?: PlayerEntity;
};
