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

export interface WoodStaffVoidFractureContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  roomMobs: MapSchema<MobState>;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
}

export type PendingVoidFracture = {
  ownerId: string;
  fireAt: number;
  damageMultiplier: number;
  weaponProgression: ItemProgressionState | null;
};

export function performWoodStaffVoidFracture(
  ctx: WoodStaffVoidFractureContext,
  ownerId: string,
  player: BasePlayerState,
  weaponProgression: ItemProgressionState | null,
  now: number,
): PendingVoidFracture | null {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  if (!bonuses.grantsWoodStaffVoidFracture) return null;

  _doVoidFractureBlast(ctx, ownerId, player, weaponProgression, 1.0, now);

  if (bonuses.woodStaffVoidFractureTwinBurst) {
    return {
      ownerId,
      fireAt: now + 1500,
      damageMultiplier: 0.5,
      weaponProgression,
    };
  }
  return null;
}

export function executePendingVoidFracture(
  ctx: WoodStaffVoidFractureContext,
  pending: PendingVoidFracture,
  now: number,
): void {
  const player = ctx.roomPlayers.get(pending.ownerId);
  if (!player || player.dead) return;
  _doVoidFractureBlast(ctx, pending.ownerId, player, pending.weaponProgression, pending.damageMultiplier, now);
}

function _doVoidFractureBlast(
  ctx: WoodStaffVoidFractureContext,
  ownerId: string,
  player: BasePlayerState,
  weaponProgression: ItemProgressionState | null,
  multiplier: number,
  now: number,
): void {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  const baseDamage = resolveWoodStaffStrikeDamage(ctx.profile.meleeStrikeDamage, bonuses);
  const fractureDamage = Math.max(
    1,
    Math.round(
      baseDamage *
        ctx.profile.woodStaffVoidFractureDamageMultiplier *
        (1 + bonuses.woodStaffVoidFractureDamageMultiplierBonus) *
        multiplier,
    ),
  );
  const radius = ctx.profile.tileSize * ctx.profile.woodStaffVoidFractureRadiusTiles;
  const stunDuration = ctx.profile.woodStaffVoidFractureStunMs + bonuses.woodStaffVoidFractureStunDurationBonusMs;

  let totalDamage = 0;
  let hitCount = 0;

  for (const mob of ctx.roomMobs.values()) {
    if (mob.dead) continue;
    if (Math.hypot(mob.x - player.x, mob.y - player.y) > radius) continue;

    mob.health = Math.max(0, mob.health - fractureDamage);
    recordMobDamage(mob, fractureDamage);
    setMobAggroTarget(mob, player);
    mob.slowEndsAt = Math.max(mob.slowEndsAt, now + stunDuration);
    totalDamage += fractureDamage;
    hitCount += 1;
    ctx.broadcastDamageText(mob.x, mob.y - 18, `-${fractureDamage}`, "#c080ff");
    if (mob.health <= 0) {
      ctx.handleMobDeath(mob);
      ctx.awardExperience(ownerId, mob.experienceReward);
    }
  }

  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead) continue;
    if (Math.hypot(candidate.x - player.x, candidate.y - player.y) > radius) continue;

    const resolved = ctx.applyDamageToPlayer(candidate, fractureDamage, "physical");
    candidate.slowEndsAt = Math.max(candidate.slowEndsAt, now + stunDuration);
    if (resolved > 0) {
      totalDamage += resolved;
      hitCount += 1;
    }
    ctx.broadcastDamageText(candidate.x, candidate.y - 18, `-${resolved}`, "#c080ff");
    if (candidate.health <= 0) {
      ctx.handlePlayerKilled(candidate);
    }
  }

  if (bonuses.woodStaffVoidFractureLifestealPercent > 0 && totalDamage > 0) {
    const heal = Math.max(1, Math.round(totalDamage * bonuses.woodStaffVoidFractureLifestealPercent));
    player.health = Math.min(player.maxHealth, player.health + heal);
  }

  if (hitCount > 0) {
    const suffix = multiplier < 1 ? " (echo)" : "";
    ctx.onCombatLog(`${player.name} casts Void Fracture${suffix} and hits ${hitCount} target${hitCount === 1 ? "" : "s"}.`);
  }
}
