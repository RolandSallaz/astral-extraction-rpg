import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PartiesModule } from '../parties/parties.module';
import { RaidRunEntity } from './entities/raid-run.entity';
import { RaidTemplateFiles } from './raid-template-files';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';
import { GetRaidRunQuery } from './use-cases/get-raid-run.query';
import { GetRaidTemplatesQuery } from './use-cases/get-raid-templates.query';
import { StartRaidUseCase } from './use-cases/start-raid.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([RaidRunEntity]), AuthModule, PartiesModule],
  controllers: [RaidsController],
  providers: [
    RaidsService,
    GetRaidRunQuery,
    GetRaidTemplatesQuery,
    StartRaidUseCase,
    {
      provide: RaidTemplateFiles,
      useFactory: () => new RaidTemplateFiles(),
    },
  ],
  exports: [RaidsService],
})
export class RaidsModule {}
