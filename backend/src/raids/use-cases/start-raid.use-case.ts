import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { RaidTemplateDefinition } from '@mmorpg/shared/raids/templates';
import { Repository } from 'typeorm';
import { PartiesService } from '../../parties/parties.service';
import { PlayerEntity } from '../../players/entities/player.entity';
import {
  getIntroductionQuestProgress,
  hasStartedIntroductionQuest,
} from '../../players/player-quest.types';
import { StartRaidDto } from '../dto/start-raid.dto';
import { RaidRunEntity } from '../entities/raid-run.entity';
import { RaidTemplateFiles } from '../raid-template-files';

const RECENT_RAID_REUSE_WINDOW_MS = 60_000;
const NON_TUTORIAL_RAID_SIZE_SCALE = 2;

@Injectable()
export class StartRaidUseCase {
  constructor(
    @InjectRepository(RaidRunEntity)
    private readonly raidRunsRepository: Repository<RaidRunEntity>,
    private readonly partiesService: PartiesService,
    private readonly raidTemplateFiles: RaidTemplateFiles,
  ) {}

  async execute(player: PlayerEntity, input: StartRaidDto) {
    const template = await this.requireActiveTemplate(input.templateCode);
    const scaledTemplate = this.scaleTemplateBounds(template);

    if (template.code === 'crypt_small') {
      const introductionQuest = getIntroductionQuestProgress(player.quests);
      if (!hasStartedIntroductionQuest(player.quests)) {
        throw new BadRequestException('Start the introduction quest with the Old Mage first.');
      }

      if (introductionQuest.status === 'ready' || introductionQuest.status === 'completed') {
        throw new BadRequestException('The first crypt can only be completed once.');
      }
    }

    const party = await this.partiesService.requirePartyLeader(player).catch(() => null);
    const playerCount = party ? party.members.length : 1;

    if (playerCount < template.minPlayers || playerCount > template.maxPlayers) {
      throw new BadRequestException('Party size does not match raid template.');
    }

    const reusedRun = await this.findRecentJoinableRun(scaledTemplate, playerCount);
    if (reusedRun) {
      reusedRun.playerCount += playerCount;
      const savedRun = await this.raidRunsRepository.save(reusedRun);
      return {
        ...this.serializeRun(savedRun),
        joinedExisting: true,
        realtimeRoom: this.createRealtimeRoom(savedRun),
      };
    }

    const seed = `${template.code}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const run = this.raidRunsRepository.create({
      seed,
      status: 'ready',
      playerCount,
      generatedLayout: null,
      startedAt: new Date(),
      finishedAt: null,
      templateCode: scaledTemplate.code,
      templateName: scaledTemplate.name,
      biome: scaledTemplate.biome,
      minPlayers: scaledTemplate.minPlayers,
      maxPlayers: scaledTemplate.maxPlayers,
      width: scaledTemplate.width,
      height: scaledTemplate.height,
      party: party ?? null,
    });

    const savedRun = await this.raidRunsRepository.save(run);
    const realtimeRoom = this.createRealtimeRoom(savedRun);

    if (party) {
      await this.partiesService.markPendingRaidForParty(party.id, {
        raidRunId: savedRun.id,
        startedAt: savedRun.startedAt?.toISOString() ?? null,
        realtimeRoom,
      });
    }

    return {
      ...this.serializeRun(savedRun),
      joinedExisting: false,
      realtimeRoom,
    };
  }

  private async requireActiveTemplate(templateCode: string) {
    const templates = await this.raidTemplateFiles.listTemplates();
    const template = templates.find(
      (candidate) => candidate.code === templateCode && candidate.isActive,
    );

    if (!template) {
      throw new NotFoundException('Raid template not found.');
    }

    return template;
  }

  private serializeTemplate(template: RaidTemplateDefinition) {
    return {
      id: template.code,
      code: template.code,
      name: template.name,
      description: template.description,
      biome: template.biome,
      minPlayers: template.minPlayers,
      maxPlayers: template.maxPlayers,
      width: template.width,
      height: template.height,
      isActive: template.isActive,
    };
  }

  private scaleTemplateBounds(template: RaidTemplateDefinition): RaidTemplateDefinition {
    if (template.code === 'crypt_small') {
      return template;
    }

    return {
      ...template,
      width: template.width * NON_TUTORIAL_RAID_SIZE_SCALE,
      height: template.height * NON_TUTORIAL_RAID_SIZE_SCALE,
    };
  }

  private serializeRun(run: RaidRunEntity) {
    return {
      id: run.id,
      seed: run.seed,
      status: run.status,
      playerCount: run.playerCount,
      template: this.serializeTemplate({
        code: run.templateCode,
        name: run.templateName,
        description: '',
        biome: run.biome,
        minPlayers: run.minPlayers,
        maxPlayers: run.maxPlayers,
        width: run.width,
        height: run.height,
        isActive: true,
      }),
      partyId: run.party?.id ?? null,
      generatedLayout: null,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  private createRealtimeRoom(run: RaidRunEntity) {
    return {
      roomName: 'raid',
      options: {
        raidRunId: run.id,
        templateCode: run.templateCode,
        templateName: run.templateName,
        biome: run.biome,
        seed: run.seed,
        width: run.width,
        height: run.height,
      },
    } as const;
  }

  private async findRecentJoinableRun(
    template: RaidTemplateDefinition,
    requestedPlayerCount: number,
  ) {
    const cutoff = new Date(Date.now() - RECENT_RAID_REUSE_WINDOW_MS);
    const maxJoinedPlayerCount = Math.max(0, template.maxPlayers - requestedPlayerCount);

    return this.raidRunsRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.party', 'party')
      .where('run.templateCode = :templateCode', { templateCode: template.code })
      .andWhere('run.status = :status', { status: 'ready' })
      .andWhere('run.finishedAt IS NULL')
      .andWhere('run.startedAt IS NOT NULL')
      .andWhere('run.startedAt >= :cutoff', { cutoff })
      .andWhere('run.playerCount <= :maxJoinedPlayerCount', { maxJoinedPlayerCount })
      .orderBy('run.startedAt', 'DESC')
      .getOne();
  }
}
