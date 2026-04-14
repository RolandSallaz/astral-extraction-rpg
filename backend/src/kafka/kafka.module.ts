import { Module } from '@nestjs/common';
import { PlayersModule } from '../players/players.module';
import { KafkaConsumerService } from './kafka.consumer';

@Module({
  imports: [PlayersModule],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
