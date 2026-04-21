import { type MapSchema } from "@colyseus/schema";
import { getItemProgressionBonuses, type ItemProgressionState } from "@mmorpg/shared";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";
import { recordMobDamage } from "./trainingDummyRuntime.js";

export interface WoodStaffSlamContext {
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

export function performWoodStaffSlam(
  ctx: WoodStaffSlamContext,
  ownerId: string,
  player: BasePlayerState,
  weaponProgression?: ItemProgressionState | null,
): void {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  if (!bonuses.grantsWoodStaffSlam) {
    return;
  }

  const radius = ctx.profile.tileSize * ctx.profile.woodStaffSlamRadiusTiles;
  const damage = Math.max(1, ctx.profile.woodStaffSlamDamage + Math.max(0, player.strength - 1) * 2);
  const originX = player.x;
  const originY = player.y - ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  let hitCount = 0;

  const mobCenterOffsetY = -ctx.profile.mobHitRadius + ctx.profile.meleeStrikeMobCenterOffsetY;
  for (const mob of ctx.roomMobs.values()) {
    if (mob.dead) {
      continue;
    }

    const mobCenterY = mob.y + mobCenterOffsetY;
    if (Math.hypot(mob.x - originX, mobCenterY - originY) > radius + ctx.profile.mobHitRadius) {
      continue;
    }

    mob.health = Math.max(0, mob.health - damage);
    recordMobDamage(mob, damage);
    setMobAggroTarget(mob, player);
    hitCount += 1;
    ctx.broadcastDamageText(mob.x, mob.y - 18, `-${damage}`, "#ffd089");
    if (mob.health <= 0) {
      ctx.handleMobDeath(mob);
      ctx.awardExperience(ownerId, mob.experienceReward);
    }
  }

  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead) {
      continue;
    }

    const candidateCenterY = candidate.y - ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
    if (Math.hypot(candidate.x - originX, candidateCenterY - originY) > radius + ctx.profile.playerHitRadius) {
      continue;
    }

    const resolvedDamage = ctx.applyDamageToPlayer(candidate, damage, "physical");
    if (resolvedDamage <= 0) {
      continue;
    }

    hitCount += 1;
    ctx.broadcastDamageText(candidate.x, candidate.y - 18, `-${resolvedDamage}`, "#ffd089");
    if (candidate.health <= 0) {
      ctx.handlePlayerKilled(candidate);
    }
  }

  if (hitCount > 0) {
    ctx.onCombatLog(`${player.name} unleashes Wood Staff Slam and hits ${hitCount} target${hitCount === 1 ? "" : "s"}.`);
  }
}
