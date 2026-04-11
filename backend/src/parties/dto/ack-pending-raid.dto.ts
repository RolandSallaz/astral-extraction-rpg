import { IsOptional, IsString } from 'class-validator';

export class AckPendingRaidDto {
  @IsOptional()
  @IsString()
  raidRunId?: string;
}
