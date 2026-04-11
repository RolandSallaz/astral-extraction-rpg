import { IsBoolean } from 'class-validator';

export class SetReadyDto {
  @IsBoolean()
  ready: boolean;
}
