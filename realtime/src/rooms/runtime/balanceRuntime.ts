import {
  isMobKind,
  MOB_KINDS,
  type MobKind,
} from "@mmorpg/shared/mobs/catalog";
import {
  applyItemBalanceUpdate,
  type ItemBalanceConfig,
} from "../itemBalance.js";
import {
  cloneSkillBalanceConfig,
  type SkillBalanceConfig,
} from "../skillBalance.js";
import {
  cloneMobBalanceConfig,
  type MobBalanceConfig,
  type MobBalanceSection,
} from "../mobBalance.js";
import { type MobState } from "../schema/MobState.js";

export function serializeSkillBalanceConfig(
  skillBalance: SkillBalanceConfig,
) {
  return cloneSkillBalanceConfig(skillBalance);
}

export function serializeMobBalanceConfig(
  mobBalance: MobBalanceConfig,
) {
  return cloneMobBalanceConfig(mobBalance);
}

export function applyBackendSkillBalance(
  skillBalance: SkillBalanceConfig,
  data: Record<string, unknown>,
) {
  const sections = [
    [skillBalance.fireball, data.fireball],
    [skillBalance.fireNova, data.fireNova],
    [skillBalance.fireField, data.fireField],
  ] as const;

  for (const [target, patch] of sections) {
    if (!patch || typeof patch !== "object") {
      continue;
    }
    const p = patch as Record<string, unknown>;
    if (typeof p.damage === "number" && Number.isFinite(p.damage)) {
      target.damage = Math.max(0, Math.floor(p.damage));
    }
    if (typeof p.burnDamage === "number" && Number.isFinite(p.burnDamage)) {
      target.burnDamage = Math.max(0, Math.floor(p.burnDamage));
    }
    if (typeof p.burnTicks === "number" && Number.isFinite(p.burnTicks)) {
      target.burnTicks = Math.max(0, Math.floor(p.burnTicks));
    }
  }

  return serializeSkillBalanceConfig(skillBalance);
}

export function applyBackendMobBalance(
  mobBalance: MobBalanceConfig,
  data: Record<string, unknown>,
  mobs: Iterable<MobState>,
) {
  for (const kind of MOB_KINDS) {
    const target = mobBalance[kind];
    const patch = data[kind];
    if (!patch || typeof patch !== "object") {
      continue;
    }
    const p = patch as Record<string, unknown>;
    if (typeof p.maxHealth === "number" && Number.isFinite(p.maxHealth)) {
      target.maxHealth = Math.max(1, Math.floor(p.maxHealth));
    }
    if (typeof p.moveSpeed === "number" && Number.isFinite(p.moveSpeed)) {
      target.moveSpeed = Math.max(0, Math.floor(p.moveSpeed));
    }
    if (typeof p.aggroRange === "number" && Number.isFinite(p.aggroRange)) {
      target.aggroRange = Math.max(0, Math.floor(p.aggroRange));
    }
    if (typeof p.leashRange === "number" && Number.isFinite(p.leashRange)) {
      target.leashRange = Math.max(0, Math.floor(p.leashRange));
    }
    if (typeof p.attackRange === "number" && Number.isFinite(p.attackRange)) {
      target.attackRange = Math.max(0, Math.floor(p.attackRange));
    }
    if (typeof p.attackDamage === "number" && Number.isFinite(p.attackDamage)) {
      target.attackDamage = Math.max(0, Math.floor(p.attackDamage));
    }
    if (typeof p.attackCooldownMs === "number" && Number.isFinite(p.attackCooldownMs)) {
      target.attackCooldownMs = Math.max(0, Math.floor(p.attackCooldownMs));
    }
    if (typeof p.experienceReward === "number" && Number.isFinite(p.experienceReward)) {
      target.experienceReward = Math.max(0, Math.floor(p.experienceReward));
    }
  }

  applyMobBalanceToLiveMobs(mobBalance, mobs);
  return serializeMobBalanceConfig(mobBalance);
}

export function applyMobBalanceToLiveMobs(
  mobBalance: MobBalanceConfig,
  mobs: Iterable<MobState>,
) {
  for (const mob of mobs) {
    const balance = getMobBalanceForMob(mobBalance, mob);
    const healthRatio = mob.maxHealth > 0 ? mob.health / mob.maxHealth : 1;
    applyMobBalance(mob, balance);
    mob.health = mob.dead
      ? 0
      : Math.max(0, Math.min(mob.maxHealth, Math.round(mob.maxHealth * healthRatio)));
  }
}

export function applyMobBalance(mob: MobState, balance: MobBalanceSection) {
  mob.moveSpeed = balance.moveSpeed;
  mob.aggroRange = balance.aggroRange;
  mob.leashRange = balance.leashRange;
  mob.attackRange = balance.attackRange;
  mob.attackDamage = balance.attackDamage;
  mob.attackCooldownMs = balance.attackCooldownMs;
  mob.maxHealth = balance.maxHealth;
  mob.health = balance.maxHealth;
  mob.experienceReward = balance.experienceReward;
}

export function resolveMobKind(mob: MobState): MobKind {
  if (typeof mob.kind === "string" && isMobKind(mob.kind)) {
    return mob.kind;
  }

  if (isMobKind(mob.texture)) {
    return mob.texture;
  }

  return "rat";
}

export function getMobBalanceForMob(
  mobBalance: MobBalanceConfig,
  mob: MobState,
): MobBalanceSection {
  return mobBalance[resolveMobKind(mob)];
}

export function applyBackendItemBalance(
  itemFireResistance: Map<string, number>,
  data: Record<string, unknown>,
) {
  applyItemBalanceUpdate(itemFireResistance, data as ItemBalanceConfig);
}
