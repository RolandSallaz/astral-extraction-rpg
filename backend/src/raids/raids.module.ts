import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PartiesModule } from '../parties/parties.module';
import { RaidRunEntity } from './entities/raid-run.entity';
import { RaidTemplateFiles } from './raid-template-files';
import { RaidsController } from './raids.controller';
import { RaidsService } from './raids.service';

@Module({
  imports: [TypeOrmModule.forFeature([RaidRunEntity]), AuthModule, PartiesModule],
  controllers: [RaidsController],
  providers: [
    RaidsService,
    {
      provide: RaidTemplateFiles,
      useFactory: () => new RaidTemplateFiles(),
    },
  ],
  exports: [RaidsService],
})
export class RaidsModule {}
