import { type MapSchema } from "@colyseus/schema";
import {
  getItemProgressionBonuses,
  resolveWoodStaffStrikeDamage,
  type ItemProgressionState,
} from "@mmorpg/shared";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";
import { recordMobDamage } from "./trainingDummyRuntime.js";

const STORM_STRIKE_DAMAGE_SCALE = 0.75;
const STORM_CHAIN_DAMAGE_SCALE = 0.5;
const FINAL_THUNDER_DAMAGE_SCALE = 0.35;
const FINAL_THUNDER_MAX_DAMAGE = 220;

export interface WoodStaffStormIncarnateContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  roomMobs: MapSchema<MobState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
}

export type PendingStormIncarnate = {
  ownerId: string;
  endsAt: number;
  nextStrikeAt: number;
  accumulatedDamage: number;
  weaponProgression: ItemProgressionState | null;
};

export function performWoodStaffStormIncarnate(
  ctx: WoodStaffStormIncarnateContext,
  ownerId: string,
  player: BasePlayerState,
  weaponProgression: ItemProgressionState | null,
  now: number,
): PendingStormIncarnate | null {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  if (!bonuses.grantsWoodStaffStormIncarnate) return null;

  const durationMs =
    ctx.profile.woodStaffStormIncarnateDurationMs + bonuses.woodStaffStormIncarnateDurationBonusMs;
  player.stormIncarnateEndsAt = now + durationMs;

  ctx.onCombatLog(`${player.name} transforms into a Storm!`);

  return {
    ownerId,
    endsAt: now + durationMs,
    nextStrikeAt: now + ctx.profile.woodStaffStormIncarnateStrikeIntervalMs,
    accumulatedDamage: 0,
    weaponProgression,
  };
}

export function updateStormIncarnate(
  ctx: WoodStaffStormIncarnateContext,
  pending: PendingStormIncarnate,
  now: number,
): PendingStormIncarnate | null {
  const player = ctx.roomPlayers.get(pending.ownerId);
  if (!player || player.dead) {
    return null;
  }

  if (now >= pending.endsAt) {
    player.stormIncarnateEndsAt = 0;
    const bonuses = getItemProgressionBonuses(player.weaponItem, pending.weaponProgression);
    if (bonuses.woodStaffStormIncarnateThunderFinale && pending.accumulatedDamage > 0) {
      _doFinalThunder(ctx, player, pending.ownerId, pending.accumulatedDamage, pending.weaponProgression);
    }
    return null;
  }

  if (now < pending.nextStrikeAt) {
    return pending;
  }

  const bonuses = getItemProgressionBonuses(player.weaponItem, pending.weaponProgression);
  const baseDamage = resolveWoodStaffStrikeDamage(ctx.profile.meleeStrikeDamage, bonuses);
  const stormDamage = Math.max(
    1,
    Math.round(baseDamage * STORM_STRIKE_DAMAGE_SCALE * (1 + bonuses.woodStaffStormIncarnateStrikeDamageMultiplier)),
  );
  const autoRange = ctx.profile.tileSize * ctx.profile.woodStaffStormIncarnateAutoRangeTiles;

  let primaryTarget: MobState | null = null;
  let bestDist = Infinity;
  for (const mob of ctx.queryNearbyMobs(player.x, player.y, autoRange)) {
    if (mob.dead) continue;
    const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      primaryTarget = mob;
    }
  }

  let totalDamageDealt = 0;

  if (primaryTarget) {
    primaryTarget.health = Math.max(0, primaryTarget.health - stormDamage);
    recordMobDamage(primaryTarget, stormDamage);
    setMobAggroTarget(primaryTarget, player);
    totalDamageDealt += stormDamage;
    ctx.broadcastDamageText(primaryTarget.x, primaryTarget.y - 18, `-${stormDamage}`, "#a0e8ff");

    if (primaryTarget.health <= 0) {
      ctx.handleMobDeath(primaryTarget);
      ctx.awardExperience(pending.ownerId, primaryTarget.experienceReward);
    } else if (bonuses.woodStaffStormIncarnateChainOnHit) {
      const chainRange = ctx.profile.tileSize * 2;
      for (const chainTarget of ctx.queryNearbyMobs(primaryTarget.x, primaryTarget.y, chainRange)) {
        if (chainTarget.dead || chainTarget === primaryTarget) continue;
        const chainDamage = Math.max(1, Math.round(stormDamage * STORM_CHAIN_DAMAGE_SCALE));
        chainTarget.health = Math.max(0, chainTarget.health - chainDamage);
        recordMobDamage(chainTarget, chainDamage);
        setMobAggroTarget(chainTarget, player);
        totalDamageDealt += chainDamage;
        ctx.broadcastDamageText(chainTarget.x, chainTarget.y - 18, `-${chainDamage}`, "#80d8f0");
        if (chainTarget.health <= 0) {
          ctx.handleMobDeath(chainTarget);
          ctx.awardExperience(pending.ownerId, chainTarget.experienceReward);
        }
        break;
      }
    }

    if (bonuses.woodStaffStormIncarnateHealPerStrike > 0) {
      player.health = Math.min(player.maxHealth, player.health + bonuses.woodStaffStormIncarnateHealPerStrike);
    }
  }

  return {
    ...pending,
    nextStrikeAt: now + ctx.profile.woodStaffStormIncarnateStrikeIntervalMs,
    accumulatedDamage: pending.accumulatedDamage + totalDamageDealt,
  };
}

function _doFinalThunder(
  ctx: WoodStaffStormIncarnateContext,
  player: BasePlayerState,
  ownerId: string,
  accumulatedDamage: number,
  weaponProgression: ItemProgressionState | null,
): void {
  const autoRange = ctx.profile.tileSize * ctx.profile.woodStaffStormIncarnateAutoRangeTiles;
  const finalDamage = Math.max(
    1,
    Math.min(FINAL_THUNDER_MAX_DAMAGE, Math.round(accumulatedDamage * FINAL_THUNDER_DAMAGE_SCALE)),
  );
  let nearest: MobState | null = null;
  let bestDist = Infinity;
  for (const mob of ctx.queryNearbyMobs(player.x, player.y, autoRange * 2)) {
    if (mob.dead) continue;
    const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = mob;
    }
  }

  if (!nearest) {
    // No mob nearby — spread among all in range
    const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
    for (const mob of ctx.roomMobs.values()) {
      if (mob.dead) continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) > autoRange * 2) continue;
      mob.health = Math.max(0, mob.health - finalDamage);
      recordMobDamage(mob, finalDamage);
      setMobAggroTarget(mob, player);
      ctx.broadcastDamageText(mob.x, mob.y - 18, `-${finalDamage}`, "#ffe566");
      if (mob.health <= 0) {
        ctx.handleMobDeath(mob);
        ctx.awardExperience(ownerId, mob.experienceReward);
      }
      void bonuses;
      break;
    }
    return;
  }

  nearest.health = Math.max(0, nearest.health - finalDamage);
  recordMobDamage(nearest, finalDamage);
  setMobAggroTarget(nearest, player);
  ctx.broadcastDamageText(nearest.x, nearest.y - 18, `-${finalDamage}`, "#ffe566");
  if (nearest.health <= 0) {
    ctx.handleMobDeath(nearest);
    ctx.awardExperience(ownerId, nearest.experienceReward);
  }
  ctx.onCombatLog(`${player.name}'s Final Thunder strikes for ${finalDamage}!`);
}
