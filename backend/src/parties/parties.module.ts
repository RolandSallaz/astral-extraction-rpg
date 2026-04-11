import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PartiesController } from './parties.controller';
import { PartyMemberEntity } from './entities/party-member.entity';
import { PartyEntity } from './entities/party.entity';
import { PartiesService } from './parties.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartyEntity, PartyMemberEntity]),
    AuthModule,
  ],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
