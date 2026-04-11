import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  cloneMobBalanceConfig,
  DEFAULT_MOB_BALANCE_CONFIG,
  type MobBalanceConfig,
  type MobBalanceSection,
} from '@mmorpg/shared/balance/mobBalance';
import { MOB_KINDS, type MobKind } from '@mmorpg/shared/mobs/catalog';
import {
  MOB_ANIMATION_STATES,
  normalizeMobAnimationClipDefinition,
  normalizeMobVisualConfig,
  type MobAnimationState,
  type MobVisualConfig,
  type MobVisualDefinition,
} from '@mmorpg/shared/mobs/visuals';
import { cloneSkillBalanceConfig, DEFAULT_SKILL_BALANCE_CONFIG } from '@mmorpg/shared/balance/skillBalance';
import { PlayerRole } from '../players/player-role.enum';
import { PlayerEntity } from '../players/entities/player.entity';
import { UpdateMobBalanceDto } from './dto/update-mob-balance.dto';
import { UpdateMobVisualsDto } from './dto/update-mob-visuals.dto';
import { UpdateSkillBalanceDto } from './dto/update-skill-balance.dto';
import { DEFAULT_ITEM_BALANCE_CONFIG, type ItemBalanceEntry } from './item-balance.defaults';
import { createDefaultItemBalanceConfig, type ItemBalanceConfig } from './game-config-files';
import type { GameContentSnapshot } from '@mmorpg/shared/content/snapshot';
import { GameContentRepository } from '../content/game-content.repository';

@Injectable()
export class GameConfigsService {
  constructor(private readonly configFiles: GameContentRepository) {}

  static forRootDir(rootDir: string) {
    return new GameConfigsService(new GameContentRepository(rootDir));
  }

  async getSkillBalance() {
    return this.normalizeSkillBalance(await this.configFiles.readSkillBalance());
  }

  async updateSkillBalance(player: PlayerEntity, input: UpdateSkillBalanceDto) {
    if (player.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const config = this.normalizeSkillBalance(await this.configFiles.readSkillBalance());

    if (input.fireball) {
      if (typeof input.fireball.damage === 'number') {
        config.fireball.damage = Math.max(0, Math.floor(input.fireball.damage));
      }
      if (typeof input.fireball.burnDamage === 'number') {
        config.fireball.burnDamage = Math.max(0, Math.floor(input.fireball.burnDamage));
      }
      if (typeof input.fireball.burnTicks === 'number') {
        config.fireball.burnTicks = Math.max(0, Math.floor(input.fireball.burnTicks));
      }
    }

    if (input.fireNova) {
      if (typeof input.fireNova.damage === 'number') {
        config.fireNova.damage = Math.max(0, Math.floor(input.fireNova.damage));
      }
      if (typeof input.fireNova.burnDamage === 'number') {
        config.fireNova.burnDamage = Math.max(0, Math.floor(input.fireNova.burnDamage));
      }
      if (typeof input.fireNova.burnTicks === 'number') {
        config.fireNova.burnTicks = Math.max(0, Math.floor(input.fireNova.burnTicks));
      }
    }

    if (input.fireField) {
      if (typeof input.fireField.damage === 'number') {
        config.fireField.damage = Math.max(0, Math.floor(input.fireField.damage));
      }
      if (typeof input.fireField.burnDamage === 'number') {
        config.fireField.burnDamage = Math.max(0, Math.floor(input.fireField.burnDamage));
      }
      if (typeof input.fireField.burnTicks === 'number') {
        config.fireField.burnTicks = Math.max(0, Math.floor(input.fireField.burnTicks));
      }
    }

    await this.configFiles.writeSkillBalance(config);
    return config;
  }

  async getMobBalance() {
    return this.normalizeMobBalance(await this.configFiles.readMobBalance());
  }

  async updateMobBalance(player: PlayerEntity, input: UpdateMobBalanceDto) {
    if (player.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const config = this.normalizeMobBalance(await this.configFiles.readMobBalance());
    for (const kind of MOB_KINDS) {
      this.applyMobSectionUpdate(config[kind], input[kind]);
    }
    await this.configFiles.writeMobBalance(config);
    return config;
  }

  async getItemBalance() {
    return this.normalizeItemBalanceEntries(await this.configFiles.readItemBalance());
  }

  async getMobVisuals() {
    return this.normalizeMobVisuals(await this.configFiles.readMobVisuals());
  }

  async getContentVersion() {
    return {
      version: await this.configFiles.readContentVersion(),
    };
  }

  async getContentSnapshot(): Promise<GameContentSnapshot> {
    const [version, skillBalance, mobBalance, itemBalance, mobVisuals] = await Promise.all([
      this.configFiles.readContentVersion(),
      this.getSkillBalance(),
      this.getMobBalance(),
      this.getItemBalance(),
      this.getMobVisuals(),
    ]);

    return {
      version,
      skillBalance,
      mobBalance,
      itemBalance,
      mobVisuals,
    };
  }

  async updateItemBalance(
    player: PlayerEntity,
    input: Record<string, Partial<ItemBalanceEntry>> | null | undefined,
  ) {
    if (player.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const currentItems = this.normalizeItemBalanceEntries(await this.configFiles.readItemBalance());

    if (input && typeof input === 'object') {
      for (const [itemId, patch] of Object.entries(input)) {
        if (!(itemId in DEFAULT_ITEM_BALANCE_CONFIG) || !patch || typeof patch !== 'object') {
          continue;
        }

        const target = currentItems[itemId];
        if (typeof patch.value === 'number' && Number.isFinite(patch.value)) {
          target.value = Math.max(0, Math.floor(patch.value));
        }
        if (Array.isArray(patch.tooltipStats)) {
          target.tooltipStats = patch.tooltipStats
            .filter((candidate): candidate is string => typeof candidate === 'string')
            .map((candidate) => candidate.trim())
            .filter(Boolean);
        }
        if (typeof patch.fireResistancePercent === 'number' && Number.isFinite(patch.fireResistancePercent)) {
          target.fireResistancePercent = Math.max(0, Math.min(100, Math.floor(patch.fireResistancePercent)));
        }
      }
    }

    await this.configFiles.writeItemBalance(currentItems);
    return currentItems;
  }

  async updateMobVisuals(
    player: PlayerEntity,
    input: UpdateMobVisualsDto | null | undefined,
  ) {
    if (player.role !== PlayerRole.ADMIN) {
      throw new ForbiddenException('Admin role required.');
    }

    const currentConfig = this.normalizeMobVisuals(await this.configFiles.readMobVisuals());
    if (input && typeof input === 'object') {
      for (const kind of MOB_KINDS) {
        this.applyMobVisualUpdate(currentConfig[kind], input[kind]);
      }
    }

    await this.configFiles.writeMobVisuals(currentConfig);
    return currentConfig;
  }

  private normalizeSkillBalance(rawConfig: Partial<ReturnType<typeof cloneSkillBalanceConfig>>) {
    const defaults = cloneSkillBalanceConfig(DEFAULT_SKILL_BALANCE_CONFIG);

    return {
      fireball: {
        damage: typeof rawConfig.fireball?.damage === 'number' ? Math.max(0, Math.floor(rawConfig.fireball.damage)) : defaults.fireball.damage,
        burnDamage: typeof rawConfig.fireball?.burnDamage === 'number' ? Math.max(0, Math.floor(rawConfig.fireball.burnDamage)) : defaults.fireball.burnDamage,
        burnTicks: typeof rawConfig.fireball?.burnTicks === 'number' ? Math.max(0, Math.floor(rawConfig.fireball.burnTicks)) : defaults.fireball.burnTicks,
      },
      fireNova: {
        damage: typeof rawConfig.fireNova?.damage === 'number' ? Math.max(0, Math.floor(rawConfig.fireNova.damage)) : defaults.fireNova.damage,
        burnDamage: typeof rawConfig.fireNova?.burnDamage === 'number' ? Math.max(0, Math.floor(rawConfig.fireNova.burnDamage)) : defaults.fireNova.burnDamage,
        burnTicks: typeof rawConfig.fireNova?.burnTicks === 'number' ? Math.max(0, Math.floor(rawConfig.fireNova.burnTicks)) : defaults.fireNova.burnTicks,
      },
      fireField: {
        damage: typeof rawConfig.fireField?.damage === 'number' ? Math.max(0, Math.floor(rawConfig.fireField.damage)) : defaults.fireField.damage,
        burnDamage: typeof rawConfig.fireField?.burnDamage === 'number' ? Math.max(0, Math.floor(rawConfig.fireField.burnDamage)) : defaults.fireField.burnDamage,
        burnTicks: typeof rawConfig.fireField?.burnTicks === 'number' ? Math.max(0, Math.floor(rawConfig.fireField.burnTicks)) : defaults.fireField.burnTicks,
      },
    };
  }

  private normalizeMobBalance(rawConfig: Partial<ReturnType<typeof cloneMobBalanceConfig>>) {
    const defaults = cloneMobBalanceConfig(DEFAULT_MOB_BALANCE_CONFIG);
    const normalizeSection = (
      section: Partial<MobBalanceSection> | undefined,
      fallback: MobBalanceSection,
    ): MobBalanceSection => ({
      maxHealth: typeof section?.maxHealth === 'number' ? Math.max(1, Math.floor(section.maxHealth)) : fallback.maxHealth,
      moveSpeed: typeof section?.moveSpeed === 'number' ? Math.max(0, Math.floor(section.moveSpeed)) : fallback.moveSpeed,
      aggroRange: typeof section?.aggroRange === 'number' ? Math.max(0, Math.floor(section.aggroRange)) : fallback.aggroRange,
      leashRange: typeof section?.leashRange === 'number' ? Math.max(0, Math.floor(section.leashRange)) : fallback.leashRange,
      attackRange: typeof section?.attackRange === 'number' ? Math.max(0, Math.floor(section.attackRange)) : fallback.attackRange,
      attackDamage: typeof section?.attackDamage === 'number' ? Math.max(0, Math.floor(section.attackDamage)) : fallback.attackDamage,
      attackCooldownMs: typeof section?.attackCooldownMs === 'number' ? Math.max(0, Math.floor(section.attackCooldownMs)) : fallback.attackCooldownMs,
      experienceReward: typeof section?.experienceReward === 'number' ? Math.max(0, Math.floor(section.experienceReward)) : fallback.experienceReward,
    });

    return Object.fromEntries(
      MOB_KINDS.map((kind) => [kind, normalizeSection(rawConfig[kind], defaults[kind])]),
    ) as MobBalanceConfig;
  }

  private normalizeItemBalanceEntries(
    rawItems?: Record<string, unknown>,
  ): ItemBalanceConfig {
    const nextItems = createDefaultItemBalanceConfig();

    for (const [itemId, defaults] of Object.entries(DEFAULT_ITEM_BALANCE_CONFIG)) {
      const rawEntry = rawItems?.[itemId];
      const entry = rawEntry && typeof rawEntry === 'object'
        ? (rawEntry as Partial<ItemBalanceEntry>)
        : {};

      nextItems[itemId] = {
        value:
          typeof entry.value === 'number' && Number.isFinite(entry.value)
            ? Math.max(0, Math.floor(entry.value))
            : defaults.value,
        tooltipStats:
          Array.isArray(entry.tooltipStats)
            ? entry.tooltipStats
              .filter((candidate): candidate is string => typeof candidate === 'string')
              .map((candidate) => candidate.trim())
              .filter(Boolean)
            : [...defaults.tooltipStats],
        fireResistancePercent:
          typeof entry.fireResistancePercent === 'number' && Number.isFinite(entry.fireResistancePercent)
            ? Math.max(0, Math.min(100, Math.floor(entry.fireResistancePercent)))
            : defaults.fireResistancePercent,
      };
    }

    return nextItems;
  }

  private normalizeMobVisuals(rawConfig?: Partial<Record<MobKind, unknown>>): MobVisualConfig {
    return normalizeMobVisualConfig(rawConfig);
  }

  private applyMobSectionUpdate(
    target: MobBalanceSection,
    input?: Partial<MobBalanceSection>,
  ) {
    if (!input) {
      return;
    }

    if (typeof input.maxHealth === 'number') {
      target.maxHealth = Math.max(1, Math.floor(input.maxHealth));
    }
    if (typeof input.moveSpeed === 'number') {
      target.moveSpeed = Math.max(0, Math.floor(input.moveSpeed));
    }
    if (typeof input.aggroRange === 'number') {
      target.aggroRange = Math.max(0, Math.floor(input.aggroRange));
    }
    if (typeof input.leashRange === 'number') {
      target.leashRange = Math.max(0, Math.floor(input.leashRange));
    }
    if (typeof input.attackRange === 'number') {
      target.attackRange = Math.max(0, Math.floor(input.attackRange));
    }
    if (typeof input.attackDamage === 'number') {
      target.attackDamage = Math.max(0, Math.floor(input.attackDamage));
    }
    if (typeof input.attackCooldownMs === 'number') {
      target.attackCooldownMs = Math.max(0, Math.floor(input.attackCooldownMs));
    }
    if (typeof input.experienceReward === 'number') {
      target.experienceReward = Math.max(0, Math.floor(input.experienceReward));
    }
  }

  private applyMobVisualUpdate(
    target: MobVisualDefinition,
    input?: unknown,
  ) {
    if (!input || typeof input !== 'object') {
      return;
    }

    const candidate = input as Partial<MobVisualDefinition> & {
      clips?: Record<string, unknown>;
      states?: Partial<Record<MobAnimationState, unknown>>;
    };

    if (typeof candidate.spriteScale === 'number' && Number.isFinite(candidate.spriteScale)) {
      target.spriteScale = Math.max(0.1, candidate.spriteScale);
    }

    if (typeof candidate.anchorY === 'number' && Number.isFinite(candidate.anchorY)) {
      target.anchorY = Math.max(0, Math.min(1.5, candidate.anchorY));
    }

    if (candidate.clips && typeof candidate.clips === 'object') {
      const nextClips = Object.entries(candidate.clips).flatMap(([key, value]) => {
        const normalized = normalizeMobAnimationClipDefinition(key, value);
        return normalized ? [[key, normalized] as const] : [];
      });
      target.clips = Object.fromEntries(nextClips);
    }

    if (candidate.states && typeof candidate.states === 'object') {
      const availableClipKeys = new Set(Object.keys(target.clips));
      target.states = Object.fromEntries(
        MOB_ANIMATION_STATES.flatMap((state: MobAnimationState) => {
          const clipKey = candidate.states?.[state];
          if (typeof clipKey !== 'string' || !availableClipKeys.has(clipKey)) {
            return [];
          }

          return [[state, clipKey] as const];
        }),
      ) as MobVisualDefinition['states'];
    }
  }
}
