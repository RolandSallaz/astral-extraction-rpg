import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RaidRunEntity } from './entities/raid-run.entity';
import type { RaidTemplateDefinition } from '@mmorpg/shared/raids/templates';
import { RaidTemplateFiles } from './raid-template-files';

const NON_TUTORIAL_RAID_SIZE_SCALE = 2;

@Injectable()
export class RaidsService {
  constructor(
    @InjectRepository(RaidRunEntity)
    private readonly raidRunsRepository: Repository<RaidRunEntity>,
    private readonly raidTemplateFiles: RaidTemplateFiles,
  ) {}

  async listTemplates() {
    const templates = await this.raidTemplateFiles.listTemplates();
    return templates
      .filter((template) => template.isActive)
      .map((template) => this.serializeTemplate(template));
  }

  async getRun(id: string) {
    const run = await this.raidRunsRepository.findOne({
      where: { id },
    });

    if (!run) {
      throw new NotFoundException('Raid run not found.');
    }

    return this.serializeRun(run);
  }

  private serializeTemplate(template: RaidTemplateDefinition) {
    const scaledTemplate =
      template.code === 'crypt_small'
        ? template
        : {
            ...template,
            width: template.width * NON_TUTORIAL_RAID_SIZE_SCALE,
            height: template.height * NON_TUTORIAL_RAID_SIZE_SCALE,
          };

    return {
      id: scaledTemplate.code,
      code: scaledTemplate.code,
      name: scaledTemplate.name,
      description: scaledTemplate.description,
      biome: scaledTemplate.biome,
      minPlayers: scaledTemplate.minPlayers,
      maxPlayers: scaledTemplate.maxPlayers,
      width: scaledTemplate.width,
      height: scaledTemplate.height,
      isActive: scaledTemplate.isActive,
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

}
