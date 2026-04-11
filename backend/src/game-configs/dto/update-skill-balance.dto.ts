import { IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SkillBalanceSectionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  damage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  burnDamage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  burnTicks?: number;
}

export class UpdateSkillBalanceDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SkillBalanceSectionDto)
  fireball?: SkillBalanceSectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SkillBalanceSectionDto)
  fireNova?: SkillBalanceSectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SkillBalanceSectionDto)
  fireField?: SkillBalanceSectionDto;
}
