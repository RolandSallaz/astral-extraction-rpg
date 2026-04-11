import { IsString, Length } from 'class-validator';

export class JoinPartyDto {
  @IsString()
  @Length(4, 12)
  code: string;
}
