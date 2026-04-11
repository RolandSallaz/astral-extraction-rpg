import { PlayerRole } from './player-role.enum';
import type { CharacterProfile } from '@mmorpg/shared/player/contracts';

export type SerializedCharacter = CharacterProfile;

export type SerializedPlayer = {
  id: string;
  nickname: string;
  role: PlayerRole;
  character: SerializedCharacter;
};

export type CreatePlayerInput = {
  nickname: string;
  passwordHash: string;
  role?: PlayerRole;
};
