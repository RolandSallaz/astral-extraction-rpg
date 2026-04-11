import { IsString, MaxLength, MinLength } from 'class-validator';

export class GiveItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  nickname: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  itemCode: string;
}
