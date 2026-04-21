import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';
import type { EquipmentItemProgressionState, EquipmentState, InventoryState, QuestLog, RaidRuntimeState } from '@mmorpg/shared';
import { PlayersService } from '../players/players.service';
import { UpdatePlayerDto } from '../players/dto/update-player.dto';
import { RaidsService } from '../raids/raids.service';

type PlayerProfileUpdatedEvent = {
  playerId: string;
  equipment?: EquipmentState;
  equipmentItemProgression?: EquipmentItemProgressionState;
  inventory?: InventoryState;
  gold?: number;
  quests?: QuestLog;
  source?: string;
  updatedAt?: string;
};

type RaidRunUpdatedEvent = {
  raidRunId: string;
  runtimeState?: RaidRuntimeState;
  updatedAt?: string;
};

function parseEventUpdatedAt(updatedAt?: string): number | null {
  const parsed = Date.parse(updatedAt ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

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
  private readonly profileTopicName = 'player.profile.updated';
  private readonly raidRuntimeTopicName = 'raid.run.updated';

  constructor(
    private readonly playersService: PlayersService,
    private readonly raidsService: RaidsService,
  ) {}

  async onModuleInit() {
    await this.ensureTopic();
    await this.consumer.connect();
    await Promise.all([
      this.consumer.subscribe({
        topic: this.profileTopicName,
        fromBeginning: false,
      }),
      this.consumer.subscribe({
        topic: this.raidRuntimeTopicName,
        fromBeginning: false,
      }),
    ]);

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) {
          return;
        }

        try {
          if (topic === this.profileTopicName) {
            const payload = JSON.parse(message.value.toString()) as PlayerProfileUpdatedEvent;
            if (!payload?.playerId) {
              return;
            }
            await this.handlePlayerProfileUpdate(payload);
            return;
          }

          if (topic === this.raidRuntimeTopicName) {
            const payload = JSON.parse(message.value.toString()) as RaidRunUpdatedEvent;
            if (!payload?.raidRunId || !payload.runtimeState) {
              return;
            }
            await this.handleRaidRunUpdate(payload);
          }
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
      const missingTopics = [this.profileTopicName, this.raidRuntimeTopicName].filter(
        (topicName) => !topics.includes(topicName),
      );
      if (missingTopics.length > 0) {
        await admin.createTopics({
          waitForLeaders: true,
          topics: missingTopics.map((topic) => ({
            topic,
            numPartitions: 1,
            replicationFactor: 1,
          })),
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
    const eventUpdatedAt = parseEventUpdatedAt(payload.updatedAt);
    if (eventUpdatedAt === null) {
      this.logger.warn(`Skipping player.profile.updated for ${payload.playerId} without valid updatedAt.`);
      return;
    }

    const update: UpdatePlayerDto = {};
    if (payload.equipment) {
      update.equipment = payload.equipment;
    }
    if (payload.inventory) {
      update.inventory = payload.inventory;
    }
    if (payload.equipmentItemProgression) {
      update.equipmentItemProgression = payload.equipmentItemProgression;
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
      if (eventUpdatedAt < player.updatedAt.getTime()) {
        this.logger.warn(
          `Skipping stale player.profile.updated for ${payload.playerId}: event=${payload.updatedAt}, db=${player.updatedAt.toISOString()}.`,
        );
        return;
      }
      await this.playersService.updatePlayer(player, update);
    } catch (error) {
      this.logger.error(`Failed to persist player ${payload.playerId}`, error as Error);
    }
  }

  private async handleRaidRunUpdate(payload: RaidRunUpdatedEvent) {
    const eventUpdatedAt = parseEventUpdatedAt(payload.updatedAt ?? payload.runtimeState?.updatedAt);
    if (eventUpdatedAt === null || !payload.runtimeState) {
      this.logger.warn(`Skipping raid.run.updated for ${payload.raidRunId} without valid updatedAt.`);
      return;
    }

    try {
      await this.raidsService.persistRuntimeState(
        payload.raidRunId,
        payload.runtimeState,
        new Date(eventUpdatedAt).toISOString(),
      );
    } catch (error) {
      this.logger.error(`Failed to persist raid ${payload.raidRunId}`, error as Error);
    }
  }
}
