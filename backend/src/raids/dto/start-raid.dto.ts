import { IsOptional, IsString } from 'class-validator';

export class StartRaidDto {
  @IsString()
  templateCode: string;

  @IsOptional()
  @IsString()
  partyId?: string;
}
