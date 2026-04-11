import { MOB_KINDS, type MobKind } from "../mobs/catalog";

export type MobBalanceSection = {
  maxHealth: number;
  moveSpeed: number;
  aggroRange: number;
  leashRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  experienceReward: number;
};

export type MobBalanceConfig = Record<MobKind, MobBalanceSection>;

export const DEFAULT_MOB_BALANCE_CONFIG: MobBalanceConfig = {
  rat: {
    maxHealth: 38,
    moveSpeed: 64,
    aggroRange: 144,
    leashRange: 224,
    attackRange: 24,
    attackDamage: 6,
    attackCooldownMs: 900,
    experienceReward: 18,
  },
  bat: {
    maxHealth: 34,
    moveSpeed: 72,
    aggroRange: 176,
    leashRange: 224,
    attackRange: 24,
    attackDamage: 7,
    attackCooldownMs: 800,
    experienceReward: 22,
  },
  skeleton: {
    maxHealth: 52,
    moveSpeed: 58,
    aggroRange: 160,
    leashRange: 240,
    attackRange: 28,
    attackDamage: 11,
    attackCooldownMs: 1100,
    experienceReward: 36,
  },
};

export function cloneMobBalanceConfig(config: MobBalanceConfig): MobBalanceConfig {
  return Object.fromEntries(
    MOB_KINDS.map((kind) => [kind, { ...config[kind] }]),
  ) as MobBalanceConfig;
}
