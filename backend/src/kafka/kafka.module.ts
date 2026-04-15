import { Module } from '@nestjs/common';
import { PlayersModule } from '../players/players.module';
import { RaidsModule } from '../raids/raids.module';
import { KafkaConsumerService } from './kafka.consumer';

@Module({
  imports: [PlayersModule, RaidsModule],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
