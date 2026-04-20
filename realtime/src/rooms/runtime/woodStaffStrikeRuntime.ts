import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";

type WoodStaffStrikeTarget =
  | { kind: "player"; entity: BasePlayerState; distance: number }
  | { kind: "mob"; entity: MobState; distance: number };

export interface WoodStaffStrikeContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
}

export function performWoodStaffStrike(
  ctx: WoodStaffStrikeContext,
  ownerId: string,
  player: BasePlayerState,
  targetX: number,
  targetY: number,
  lagCompensatedAt: number,
  lagCompensationEnabled: boolean,
): void {
  const target = findWoodStaffStrikeTarget(ctx, player, targetX, targetY, lagCompensatedAt, lagCompensationEnabled);
  if (!target) {
    return;
  }

  const baseDamage = Math.max(1, ctx.profile.meleeStrikeDamage);
  const strengthBonus = Math.max(0, player.strength - 1) * 2;
  const damage = baseDamage + strengthBonus;

  if (target.kind === "player") {
    const resolvedDamage = ctx.applyDamageToPlayer(target.entity, damage, "physical");
    ctx.onCombatLog(`${player.name} hits ${target.entity.name} for ${resolvedDamage}.`);
    if (resolvedDamage > 0) {
      ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${resolvedDamage}`, "#ffd089");
    }
    if (target.entity.health <= 0) {
      ctx.handlePlayerKilled(target.entity);
    }
    return;
  }

  target.entity.health = Math.max(0, target.entity.health - damage);
  setMobAggroTarget(target.entity, player);
  ctx.onCombatLog(`${player.name} hits ${target.entity.name} for ${damage}.`);
  if (damage > 0) {
    ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${damage}`, "#ffd089");
  }
  if (target.entity.health <= 0) {
    ctx.handleMobDeath(target.entity);
    ctx.awardExperience(ownerId, target.entity.experienceReward);
  }
}

function findWoodStaffStrikeTarget(
  ctx: WoodStaffStrikeContext,
  player: BasePlayerState,
  targetX: number,
  targetY: number,
  lagCompensatedAt: number,
  lagCompensationEnabled: boolean,
): WoodStaffStrikeTarget | null {
  const maxRange = ctx.profile.meleeStrikeRange;
  const hitSlack = 4;
  const playerCenterOffsetY = -ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  const rawPlayerPosition = lagCompensationEnabled
    ? ctx.getPlayerPositionAt(player.id, lagCompensatedAt) ?? player
    : player;
  const playerPosition = {
    x: rawPlayerPosition.x,
    y: rawPlayerPosition.y + playerCenterOffsetY,
  };
  const directionX = targetX - playerPosition.x;
  const directionY = targetY - playerPosition.y;
  const directionLength = Math.hypot(directionX, directionY);
  const hasAimDirection = directionLength > 0.001;
  const normalizedX = hasAimDirection ? directionX / directionLength : 0;
  const normalizedY = hasAimDirection ? directionY / directionLength : 0;
  const upRangeBonus = 24;
  const downRangePenalty = 16;
  const effectiveRange =
    maxRange +
    (hasAimDirection
      ? normalizedY < -0.25
        ? upRangeBonus
        : normalizedY > 0.25
          ? -downRangePenalty
          : 0
      : 0);
  const minimumDot = Math.cos(ctx.profile.meleeStrikeArcHalfAngleRad);
  const isTargetWithinArc = (deltaX: number, deltaY: number, distance: number, hitRadius: number) => {
    if (!hasAimDirection || distance <= hitRadius + hitSlack) {
      return true;
    }
    const forwardDistance = deltaX * normalizedX + deltaY * normalizedY;
    if (forwardDistance < -hitSlack) {
      return false;
    }
    const dot = forwardDistance / Math.max(distance, 0.001);
    return dot >= minimumDot;
  };

  const mobCenterOffsetY = -ctx.profile.mobHitRadius + ctx.profile.meleeStrikeMobCenterOffsetY;
  let nearestMob: WoodStaffStrikeTarget | null = null;
  for (const mob of ctx.queryNearbyMobs(playerPosition.x, playerPosition.y, effectiveRange + ctx.profile.mobHitRadius)) {
    if (mob.dead) {
      continue;
    }
    const deltaX = mob.x - playerPosition.x;
    const deltaY = mob.y + mobCenterOffsetY - playerPosition.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (
      distance > effectiveRange + ctx.profile.mobHitRadius ||
      !isTargetWithinArc(deltaX, deltaY, distance, ctx.profile.mobHitRadius)
    ) {
      continue;
    }
    if (!nearestMob || distance < nearestMob.distance) {
      nearestMob = { kind: "mob", entity: mob, distance };
    }
  }

  if (nearestMob) {
    return nearestMob;
  }

  let nearestPlayer: WoodStaffStrikeTarget | null = null;
  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead) {
      continue;
    }
    const candidatePosition = lagCompensationEnabled
      ? ctx.getPlayerPositionAt(candidate.id, lagCompensatedAt) ?? candidate
      : candidate;
    const deltaX = candidatePosition.x - playerPosition.x;
    const deltaY = candidatePosition.y + playerCenterOffsetY - playerPosition.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (
      distance > effectiveRange + ctx.profile.playerHitRadius ||
      !isTargetWithinArc(deltaX, deltaY, distance, ctx.profile.playerHitRadius)
    ) {
      continue;
    }
    if (!nearestPlayer || distance < nearestPlayer.distance) {
      nearestPlayer = { kind: "player", entity: candidate, distance };
    }
  }

  return nearestPlayer;
}
