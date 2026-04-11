import { IsArray, IsNumber, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CharacterProfile } from '@mmorpg/shared/player/contracts';
import type { QuestLog } from '@mmorpg/shared/quests/core';

class PositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class UpdatePlayerDto {
  @IsOptional()
  @IsObject()
  equipment?: CharacterProfile['equipment'];

  @IsOptional()
  @IsArray()
  inventory?: CharacterProfile['inventory'];

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

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
