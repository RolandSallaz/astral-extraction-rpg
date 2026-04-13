import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RaidRunEntity } from './entities/raid-run.entity';
import type { RaidTemplateDefinition } from '@mmorpg/shared/raids/templates';
import { RaidTemplateFiles } from './raid-template-files';

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
