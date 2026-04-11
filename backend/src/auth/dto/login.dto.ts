import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  nickname: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  password: string;
}
