import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';
import type { EquipmentState, InventoryState } from '@mmorpg/shared/player/contracts';
import type { QuestLog } from '@mmorpg/shared/quests/core';
import { PlayersService } from '../players/players.service';
import { UpdatePlayerDto } from '../players/dto/update-player.dto';

type PlayerProfileUpdatedEvent = {
  playerId: string;
  equipment?: EquipmentState;
  inventory?: InventoryState;
  gold?: number;
  quests?: QuestLog;
  source?: string;
  updatedAt?: string;
};

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'mmorpg-backend',
    brokers: (process.env.KAFKA_BROKERS ?? 'kafka:9092')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    logLevel: logLevel.NOTHING,
  });
  private readonly consumer = this.kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID ?? 'mmorpg-backend',
  });
  private readonly topicName = 'player.profile.updated';

  constructor(private readonly playersService: PlayersService) {}

  async onModuleInit() {
    await this.ensureTopic();
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.topicName,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }

        try {
          const payload = JSON.parse(message.value.toString()) as PlayerProfileUpdatedEvent;
          if (!payload?.playerId) {
            return;
          }
          await this.handlePlayerProfileUpdate(payload);
        } catch (error) {
          this.logger.error('Failed to handle kafka message', error as Error);
        }
      },
    });
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
    } catch (error) {
      this.logger.error('Failed to disconnect kafka consumer', error as Error);
    }
  }

  private async ensureTopic() {
    const admin = this.kafka.admin();
    try {
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes(this.topicName)) {
        await admin.createTopics({
          waitForLeaders: true,
          topics: [
            {
              topic: this.topicName,
              numPartitions: 1,
              replicationFactor: 1,
            },
          ],
        });
      }
    } catch (error) {
      this.logger.error('Failed to ensure kafka topic exists', error as Error);
    } finally {
      try {
        await admin.disconnect();
      } catch (error) {
        this.logger.error('Failed to disconnect kafka admin', error as Error);
      }
    }
  }

  private async handlePlayerProfileUpdate(payload: PlayerProfileUpdatedEvent) {
    const update: UpdatePlayerDto = {};
    if (payload.equipment) {
      update.equipment = payload.equipment;
    }
    if (payload.inventory) {
      update.inventory = payload.inventory;
    }
    if (typeof payload.gold === 'number') {
      update.gold = payload.gold;
    }
    if (payload.quests) {
      update.quests = payload.quests;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    try {
      const player = await this.playersService.findPlayerById(payload.playerId);
      await this.playersService.updatePlayer(player, update);
    } catch (error) {
      this.logger.error(`Failed to persist player ${payload.playerId}`, error as Error);
    }
  }
}
