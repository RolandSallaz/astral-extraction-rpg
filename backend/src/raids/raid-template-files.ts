import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getLegacyRaidTemplatesPath,
  getRaidTemplatesPath,
} from '@mmorpg/shared/content/paths';
import {
  normalizeRaidTemplateDefinition,
  type RaidTemplateDefinition,
} from '@mmorpg/shared/raids/templates';
import { resolveGameDataDirectory } from '../content/game-data-files';
import { CRYPT_SMALL_HEIGHT, CRYPT_SMALL_WIDTH } from './raid-procgen';

const DEFAULT_RAID_TEMPLATES: RaidTemplateDefinition[] = [
  {
    code: 'crypt_small',
    name: 'Crypt Small',
    description: 'Compact astral crypt for the first rite: loot a staff and gem, socket them, kill a rat, then reach the exit.',
    biome: 'crypt',
    minPlayers: 1,
    maxPlayers: 1,
    width: CRYPT_SMALL_WIDTH,
    height: CRYPT_SMALL_HEIGHT,
    isActive: true,
  },
  {
    code: 'crypt',
    name: 'Crypt',
    description: 'Procedural crypt for delves beyond the first rite.',
    biome: 'crypt',
    minPlayers: 1,
    maxPlayers: 4,
    width: 64,
    height: 64,
    isActive: true,
  },
];

export class RaidTemplateFiles {
  private readonly filePath: string;
  private readonly legacyFilePath: string;

  constructor(filePath?: string) {
    const gameDataDir = resolveGameDataDirectory();
    this.filePath = filePath ?? path.normalize(getRaidTemplatesPath(gameDataDir));
    this.legacyFilePath = path.normalize(getLegacyRaidTemplatesPath(gameDataDir));
  }

  async listTemplates() {
    const candidatePaths = [this.filePath, this.legacyFilePath];
    for (const candidatePath of candidatePaths) {
      try {
        const rawValue = await readFile(candidatePath, 'utf8');
        const parsed = JSON.parse(rawValue) as Partial<RaidTemplateDefinition>[];
        const templates = Array.isArray(parsed)
          ? parsed
              .map((template) => normalizeRaidTemplateDefinition(template))
              .filter((template): template is RaidTemplateDefinition => Boolean(template))
          : [];

        if (templates.length > 0) {
          return templates;
        }
      } catch {
        continue;
      }
    }

    await this.saveTemplates(DEFAULT_RAID_TEMPLATES);
    return DEFAULT_RAID_TEMPLATES.map((template) => ({ ...template }));
  }

  async saveTemplates(templates: RaidTemplateDefinition[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(templates, null, 2)}\n`, 'utf8');
  }
}
