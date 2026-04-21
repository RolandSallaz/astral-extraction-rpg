import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import {
  getItemProgressionBonuses,
  resolveWoodStaffStrikeDamage,
  type ItemProgressionState,
} from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";
import { recordMobDamage } from "./trainingDummyRuntime.js";

type WoodStaffStrikeTarget =
  | { kind: "player"; entity: BasePlayerState; distance: number }
  | { kind: "mob"; entity: MobState; distance: number };

export interface WoodStaffStrikeContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  canPushTargetTo(x: number, y: number, targetId: string): boolean;
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
  weaponProgression?: ItemProgressionState | null,
): void {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  const target = findWoodStaffStrikeTarget(
    ctx,
    player,
    targetX,
    targetY,
    lagCompensatedAt,
    lagCompensationEnabled,
    bonuses.meleeStrikeRangeBonusPx,
  );
  if (!target) {
    return;
  }

  const baseDamage = Math.max(1, ctx.profile.meleeStrikeDamage);
  const strengthBonus = Math.max(0, player.strength - 1) * 2;
  const damage = resolveWoodStaffStrikeDamage(baseDamage + strengthBonus, bonuses);

  if (target.kind === "player") {
    const resolvedDamage = ctx.applyDamageToPlayer(target.entity, damage, "physical");
    ctx.onCombatLog(`${player.name} hits ${target.entity.name} for ${resolvedDamage}.`);
    if (resolvedDamage > 0) {
      ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${resolvedDamage}`, "#ffd089");
      applyWoodStaffStrikeKnockback(ctx, target.entity, player, bonuses.woodStaffStrikeKnockbackBonusTiles);
      applyWoodStaffStrikeSlow(target.entity, bonuses.woodStaffStrikeSlowDurationMs);
    }
    if (target.entity.health <= 0) {
      ctx.handlePlayerKilled(target.entity);
    }
    return;
  }

  target.entity.health = Math.max(0, target.entity.health - damage);
  recordMobDamage(target.entity, damage);
  setMobAggroTarget(target.entity, player);
  ctx.onCombatLog(`${player.name} hits ${target.entity.name} for ${damage}.`);
  if (damage > 0) {
    ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${damage}`, "#ffd089");
    applyWoodStaffStrikeKnockback(ctx, target.entity, player, bonuses.woodStaffStrikeKnockbackBonusTiles);
    applyWoodStaffStrikeSlow(target.entity, bonuses.woodStaffStrikeSlowDurationMs);
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
  rangeBonusPx = 0,
): WoodStaffStrikeTarget | null {
  const maxRange = ctx.profile.meleeStrikeRange + rangeBonusPx;
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

function applyWoodStaffStrikeKnockback(
  ctx: WoodStaffStrikeContext,
  target: BasePlayerState | MobState,
  player: BasePlayerState,
  knockbackBonusTiles: number,
) {
  if (knockbackBonusTiles <= 0) {
    return;
  }

  const distance = ctx.profile.tileSize * knockbackBonusTiles;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) {
    return;
  }

  const directionX = dx / length;
  const directionY = dy / length;
  const stepDistance = Math.max(4, ctx.profile.tileSize / 4);
  const steps = Math.max(1, Math.ceil(distance / stepDistance));
  let nextX = target.x;
  let nextY = target.y;

  for (let step = 1; step <= steps; step += 1) {
    const travelled = Math.min(distance, step * stepDistance);
    const candidateX = target.x + directionX * travelled;
    const candidateY = target.y + directionY * travelled;
    if (!ctx.canPushTargetTo(candidateX, candidateY, target.id)) {
      break;
    }
    nextX = candidateX;
    nextY = candidateY;
  }

  target.x = nextX;
  target.y = nextY;
  if ("targetX" in target) {
    target.targetX = nextX;
    target.targetY = nextY;
  }
}

function applyWoodStaffStrikeSlow(target: BasePlayerState | MobState, slowDurationMs: number) {
  if (slowDurationMs <= 0) {
    return;
  }

  target.slowEndsAt = Math.max(target.slowEndsAt ?? 0, Date.now() + slowDurationMs);
}
