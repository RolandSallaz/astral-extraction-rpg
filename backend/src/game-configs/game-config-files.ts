import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  getItemBalancePath,
  getMobBalancePath,
  getMobVisualsPath,
  getSkillBalancePath,
} from '@mmorpg/shared/content/paths';
import {
  cloneMobBalanceConfig,
  DEFAULT_MOB_BALANCE_CONFIG,
  type MobBalanceConfig,
} from '@mmorpg/shared/balance/mobBalance';
import {
  cloneSkillBalanceConfig,
  DEFAULT_SKILL_BALANCE_CONFIG,
  type SkillBalanceConfig,
} from '@mmorpg/shared/balance/skillBalance';
import {
  createDefaultMobVisualConfig,
  normalizeMobVisualConfig,
  type MobVisualConfig,
} from '@mmorpg/shared/mobs/visuals';
import {
  ensureJsonFile,
  readJsonFile,
  resolveGameDataDirectory,
  writeJsonFile,
} from '../content/game-data-files';
import { DEFAULT_ITEM_BALANCE_CONFIG, type ItemBalanceEntry } from './item-balance.defaults';

export type ItemBalanceConfig = Record<string, ItemBalanceEntry>;

function cloneItemBalanceConfig(config: ItemBalanceConfig): ItemBalanceConfig {
  return Object.fromEntries(
    Object.entries(config).map(([itemId, entry]) => [
      itemId,
      {
        value: entry.value,
        tooltipStats: [...entry.tooltipStats],
        fireResistancePercent: entry.fireResistancePercent,
      },
    ]),
  );
}

export function createDefaultItemBalanceConfig(): ItemBalanceConfig {
  return cloneItemBalanceConfig(DEFAULT_ITEM_BALANCE_CONFIG);
}

function normalizeSkillBalance(raw: unknown): SkillBalanceConfig {
  const defaults = cloneSkillBalanceConfig(DEFAULT_SKILL_BALANCE_CONFIG);
  if (!raw || typeof raw !== 'object') return defaults;
  return cloneSkillBalanceConfig({ ...defaults, ...(raw as SkillBalanceConfig) });
}

function normalizeMobBalance(raw: unknown): MobBalanceConfig {
  const defaults = cloneMobBalanceConfig(DEFAULT_MOB_BALANCE_CONFIG);
  if (!raw || typeof raw !== 'object') return defaults;
  return cloneMobBalanceConfig({ ...defaults, ...(raw as MobBalanceConfig) });
}

function normalizeItemBalance(raw: unknown): ItemBalanceConfig {
  const defaults = createDefaultItemBalanceConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  return cloneItemBalanceConfig({ ...defaults, ...(raw as ItemBalanceConfig) });
}

function normalizeMobVisuals(raw: unknown): MobVisualConfig {
  if (!raw || typeof raw !== 'object') return createDefaultMobVisualConfig();
  return normalizeMobVisualConfig(raw as Partial<Record<string, unknown>>);
}

export class GameConfigFiles {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = resolveGameDataDirectory(rootDir);
  }

  private get skillBalancePath() {
    return path.normalize(getSkillBalancePath(this.rootDir));
  }

  private get mobBalancePath() {
    return path.normalize(getMobBalancePath(this.rootDir));
  }

  private get itemBalancePath() {
    return path.normalize(getItemBalancePath(this.rootDir));
  }

  private get mobVisualsPath() {
    return path.normalize(getMobVisualsPath(this.rootDir));
  }

  async readSkillBalance() {
    const defaults = cloneSkillBalanceConfig(DEFAULT_SKILL_BALANCE_CONFIG);
    await ensureJsonFile(this.skillBalancePath, defaults);
    return (await readJsonFile<SkillBalanceConfig>(this.skillBalancePath, normalizeSkillBalance)) ?? defaults;
  }

  async writeSkillBalance(config: SkillBalanceConfig) {
    await writeJsonFile(this.skillBalancePath, config);
    return config;
  }

  async readMobBalance() {
    const defaults = cloneMobBalanceConfig(DEFAULT_MOB_BALANCE_CONFIG);
    await ensureJsonFile(this.mobBalancePath, defaults);
    return (await readJsonFile<MobBalanceConfig>(this.mobBalancePath, normalizeMobBalance)) ?? defaults;
  }

  async writeMobBalance(config: MobBalanceConfig) {
    await writeJsonFile(this.mobBalancePath, config);
    return config;
  }

  async readItemBalance() {
    const defaults = createDefaultItemBalanceConfig();
    await ensureJsonFile(this.itemBalancePath, defaults);
    return (await readJsonFile<ItemBalanceConfig>(this.itemBalancePath, normalizeItemBalance)) ?? defaults;
  }

  async writeItemBalance(config: ItemBalanceConfig) {
    await writeJsonFile(this.itemBalancePath, config);
    return config;
  }

  async readMobVisuals() {
    const defaults = createDefaultMobVisualConfig();
    await ensureJsonFile(this.mobVisualsPath, defaults);
    return (await readJsonFile<MobVisualConfig>(this.mobVisualsPath, normalizeMobVisuals)) ?? defaults;
  }

  async writeMobVisuals(config: MobVisualConfig) {
    await writeJsonFile(this.mobVisualsPath, config);
    return config;
  }

  async readContentVersion() {
    await Promise.all([
      ensureJsonFile(this.skillBalancePath, cloneSkillBalanceConfig(DEFAULT_SKILL_BALANCE_CONFIG)),
      ensureJsonFile(this.mobBalancePath, cloneMobBalanceConfig(DEFAULT_MOB_BALANCE_CONFIG)),
      ensureJsonFile(this.itemBalancePath, createDefaultItemBalanceConfig()),
      ensureJsonFile(this.mobVisualsPath, createDefaultMobVisualConfig()),
    ]);

    const files = [
      this.skillBalancePath,
      this.mobBalancePath,
      this.itemBalancePath,
      this.mobVisualsPath,
    ];
    const hash = createHash('sha1');

    for (const filePath of files) {
      const content = await readFile(filePath);
      hash.update(path.basename(filePath));
      hash.update(':');
      hash.update(content);
      hash.update(';');
    }

    return hash.digest('hex');
  }
}
