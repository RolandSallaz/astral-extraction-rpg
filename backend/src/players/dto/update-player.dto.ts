import { IsArray, IsNumber, IsObject, IsOptional } from 'class-validator';
import type { CharacterProfile } from '@mmorpg/shared/player/contracts';
import type { QuestLog } from '@mmorpg/shared/quests/core';

export class UpdatePlayerDto {
  @IsOptional()
  @IsObject()
  equipment?: CharacterProfile['equipment'];

  @IsOptional()
  @IsArray()
  inventory?: CharacterProfile['inventory'];

  @IsOptional()
  @IsNumber()
  gold?: number;

  @IsOptional()
  @IsNumber()
  health?: number;

  @IsOptional()
  @IsNumber()
  maxHealth?: number;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsNumber()
  experience?: number;

  @IsOptional()
  @IsNumber()
  strength?: number;

  @IsOptional()
  @IsNumber()
  agility?: number;

  @IsOptional()
  @IsNumber()
  intellect?: number;

  @IsOptional()
  @IsObject()
  quests?: QuestLog;
}
