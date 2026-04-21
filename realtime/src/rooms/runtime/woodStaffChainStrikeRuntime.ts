import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import {
  getItemProgressionBonuses,
  resolveWoodStaffStrikeDamage,
  WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX,
  WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT,
  type ItemProgressionState,
} from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import { setMobAggroTarget } from "./mobAi.js";
import type { DamageType } from "./projectileSkills.js";
import { recordMobDamage } from "./trainingDummyRuntime.js";

type ChainTarget =
  | { kind: "player"; entity: BasePlayerState; x: number; y: number }
  | { kind: "mob"; entity: MobState; x: number; y: number };

export interface WoodStaffChainStrikeContext {
  profile: RoomGameplayProfile;
  roomPlayers: MapSchema<BasePlayerState>;
  roomMobs: MapSchema<MobState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  canTeleportTo(x: number, y: number, playerId: string): boolean;
  canPushTargetTo(x: number, y: number, targetId: string): boolean;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
}

const CHAIN_STEP_DELAY_MS = 300;
const CHAIN_HIT_VISUAL_LOCK_MS = 220;
const CHAIN_STRIKE_DAMAGE_SCALE = 0.75;

export type PendingWoodStaffChainStrike = {
  ownerId: string;
  weaponProgression?: ItemProgressionState | null;
  remainingHits: number;
  safetyHitsRemaining: number;
  nextAt: number;
  searchX: number;
  searchY: number;
  lastTargetKind: ChainTarget["kind"];
  lastTargetId: string;
  excludedIds: string[];
};

export function performWoodStaffChainStrike(
  ctx: WoodStaffChainStrikeContext,
  ownerId: string,
  player: BasePlayerState,
  targetX: number,
  targetY: number,
  lagCompensatedAt: number,
  lagCompensationEnabled: boolean,
  weaponProgression?: ItemProgressionState | null,
): PendingWoodStaffChainStrike | null {
  const bonuses = getItemProgressionBonuses(player.weaponItem, weaponProgression);
  if (!bonuses.grantsWoodStaffChainStrike) {
    return null;
  }

  const primaryTarget = findPrimaryChainTarget(
    ctx,
    player,
    targetX,
    targetY,
    lagCompensatedAt,
    lagCompensationEnabled,
    bonuses.meleeStrikeRangeBonusPx + bonuses.woodStaffChainStrikeRangeBonusPx,
  );
  if (!primaryTarget) {
    return null;
  }

  const baseDamage = Math.max(1, ctx.profile.meleeStrikeDamage);
  const strengthBonus = Math.max(0, player.strength - 1) * 2;
  const damage = resolveChainStrikeDamage(baseDamage + strengthBonus, bonuses);
  const didHit = executeChainStrikeHit(ctx, ownerId, player, primaryTarget, damage, bonuses);
  if (didHit) {
    const totalHitCount = getWoodStaffChainStrikeHitCount(bonuses);
    ctx.onCombatLog(`${player.name} releases Chain Strike.`);
    return {
      ownerId,
      weaponProgression,
      remainingHits: totalHitCount - 1,
      safetyHitsRemaining: getWoodStaffChainStrikeSafetyHitCount(totalHitCount) - 1,
      nextAt: Date.now() + CHAIN_STEP_DELAY_MS,
      searchX: primaryTarget.x,
      searchY: primaryTarget.y,
      lastTargetKind: primaryTarget.kind,
      lastTargetId: primaryTarget.entity.id,
      excludedIds: [primaryTarget.entity.id],
    } satisfies PendingWoodStaffChainStrike;
  }

  return null;
}

export function continueWoodStaffChainStrike(
  ctx: WoodStaffChainStrikeContext,
  pending: PendingWoodStaffChainStrike,
): PendingWoodStaffChainStrike | null {
  if (pending.remainingHits <= 0 || pending.safetyHitsRemaining <= 0) {
    return null;
  }

  const player = ctx.roomPlayers.get(pending.ownerId);
  if (!player || player.dead) {
    return null;
  }

  const bonuses = getItemProgressionBonuses(player.weaponItem, pending.weaponProgression);
  if (!bonuses.grantsWoodStaffChainStrike) {
    return null;
  }

  const target = findNextBounceTarget(
    ctx,
    player,
    { kind: "player", entity: player, x: pending.searchX, y: pending.searchY },
    new Set(pending.excludedIds),
    WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX + bonuses.woodStaffChainStrikeBounceRadiusBonusPx,
  ) ?? findPreviousChainTarget(ctx, pending);
  if (!target) {
    return null;
  }

  const baseDamage = Math.max(1, ctx.profile.meleeStrikeDamage);
  const strengthBonus = Math.max(0, player.strength - 1) * 2;
  const damage = resolveChainStrikeDamage(baseDamage + strengthBonus, bonuses);
  const didHit = executeChainStrikeHit(ctx, pending.ownerId, player, target, damage, bonuses);
  if (!didHit) {
    return null;
  }

  const refundChance = Math.max(0, Math.min(1, bonuses.woodStaffChainStrikeRefundChance));
  const spendsHit = refundChance <= 0 || Math.random() >= refundChance;

  return {
    ...pending,
    remainingHits: spendsHit ? pending.remainingHits - 1 : pending.remainingHits,
    safetyHitsRemaining: pending.safetyHitsRemaining - 1,
    nextAt: Date.now() + CHAIN_STEP_DELAY_MS,
    searchX: target.x,
    searchY: target.y,
    lastTargetKind: target.kind,
    lastTargetId: target.entity.id,
    excludedIds: pending.excludedIds.includes(target.entity.id)
      ? pending.excludedIds
      : [...pending.excludedIds, target.entity.id],
  };
}

function getWoodStaffChainStrikeHitCount(bonuses: ReturnType<typeof getItemProgressionBonuses>) {
  return Math.max(1, WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT + bonuses.woodStaffChainStrikeBonusHits);
}

function getWoodStaffChainStrikeSafetyHitCount(totalHitCount: number) {
  return Math.max(totalHitCount, totalHitCount + 3);
}

function resolveChainStrikeDamage(
  baseDamage: number,
  bonuses: ReturnType<typeof getItemProgressionBonuses>,
) {
  return Math.max(1, Math.round(resolveWoodStaffStrikeDamage(baseDamage, bonuses) * CHAIN_STRIKE_DAMAGE_SCALE));
}

function findPreviousChainTarget(
  ctx: WoodStaffChainStrikeContext,
  pending: PendingWoodStaffChainStrike,
): ChainTarget | null {
  if (pending.lastTargetKind === "mob") {
    const mob = ctx.roomMobs.get(pending.lastTargetId);
    if (!mob || mob.dead) {
      return null;
    }

    const mobCenterOffsetY = -ctx.profile.mobHitRadius + ctx.profile.meleeStrikeMobCenterOffsetY;
    return { kind: "mob", entity: mob, x: mob.x, y: mob.y + mobCenterOffsetY };
  }

  const player = ctx.roomPlayers.get(pending.lastTargetId);
  if (!player || player.dead) {
    return null;
  }

  const playerCenterOffsetY = -ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  return { kind: "player", entity: player, x: player.x, y: player.y + playerCenterOffsetY };
}

function executeChainStrikeHit(
  ctx: WoodStaffChainStrikeContext,
  ownerId: string,
  player: BasePlayerState,
  target: ChainTarget,
  damage: number,
  bonuses: ReturnType<typeof getItemProgressionBonuses>,
) {
  teleportPlayerBehindChainTarget(ctx, player, target);
  applyChainStrikeCastVisual(player);

  if (target.kind === "player") {
    const resolvedDamage = ctx.applyDamageToPlayer(target.entity, damage, "physical");
    if (resolvedDamage <= 0) {
      return false;
    }

    applyWoodStaffStrikeKnockback(ctx, target.entity, player, bonuses.woodStaffStrikeKnockbackBonusTiles);
    applyWoodStaffStrikeSlow(target.entity, bonuses.woodStaffStrikeSlowDurationMs);
    ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${resolvedDamage}`, "#ffd089");
    if (target.entity.health <= 0) {
      ctx.handlePlayerKilled(target.entity);
    }
    return true;
  }

  target.entity.health = Math.max(0, target.entity.health - damage);
  recordMobDamage(target.entity, damage);
  setMobAggroTarget(target.entity, player);
  applyWoodStaffStrikeKnockback(ctx, target.entity, player, bonuses.woodStaffStrikeKnockbackBonusTiles);
  applyWoodStaffStrikeSlow(target.entity, bonuses.woodStaffStrikeSlowDurationMs);
  ctx.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${damage}`, "#ffd089");
  if (target.entity.health <= 0) {
    ctx.handleMobDeath(target.entity);
    ctx.awardExperience(ownerId, target.entity.experienceReward);
  }
  return true;
}

function applyChainStrikeCastVisual(player: BasePlayerState) {
  const now = Date.now();
  player.castingSkillId = "woodStaffChainStrike";
  player.castStartedAt = now;
  player.castEndsAt = now + CHAIN_HIT_VISUAL_LOCK_MS;
}

function findPrimaryChainTarget(
  ctx: WoodStaffChainStrikeContext,
  player: BasePlayerState,
  targetX: number,
  targetY: number,
  lagCompensatedAt: number,
  lagCompensationEnabled: boolean,
  rangeBonusPx = 0,
): ChainTarget | null {
  const maxRange = ctx.profile.meleeStrikeRange + rangeBonusPx;
  const hitSlack = 4;
  const playerCenterOffsetY = -ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  const rawPlayerPosition = lagCompensatedEnabledPosition(ctx, player, lagCompensatedAt, lagCompensationEnabled);
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
  let nearestMob: ChainTarget | null = null;
  let nearestMobDistance = Number.POSITIVE_INFINITY;
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
    if (distance < nearestMobDistance) {
      nearestMob = { kind: "mob", entity: mob, x: mob.x, y: mob.y + mobCenterOffsetY };
      nearestMobDistance = distance;
    }
  }

  if (nearestMob) {
    return nearestMob;
  }

  let nearestPlayer: ChainTarget | null = null;
  let nearestPlayerDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead) {
      continue;
    }
    const candidatePosition = lagCompensatedEnabledPosition(ctx, candidate, lagCompensatedAt, lagCompensationEnabled);
    const candidateCenterY = candidatePosition.y + playerCenterOffsetY;
    const deltaX = candidatePosition.x - playerPosition.x;
    const deltaY = candidateCenterY - playerPosition.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (
      distance > effectiveRange + ctx.profile.playerHitRadius ||
      !isTargetWithinArc(deltaX, deltaY, distance, ctx.profile.playerHitRadius)
    ) {
      continue;
    }
    if (distance < nearestPlayerDistance) {
      nearestPlayer = { kind: "player", entity: candidate, x: candidatePosition.x, y: candidateCenterY };
      nearestPlayerDistance = distance;
    }
  }

  return nearestPlayer;
}

function findNextBounceTarget(
  ctx: WoodStaffChainStrikeContext,
  player: BasePlayerState,
  lastTarget: ChainTarget,
  excludedIds: Set<string>,
  bounceRadiusPx: number,
): ChainTarget | null {
  let bestTarget: ChainTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const playerCenterOffsetY = -ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  const mobCenterOffsetY = -ctx.profile.mobHitRadius + ctx.profile.meleeStrikeMobCenterOffsetY;

  for (const mob of ctx.roomMobs.values()) {
    if (mob.dead || excludedIds.has(mob.id)) {
      continue;
    }
    const candidateY = mob.y + mobCenterOffsetY;
    const distance = Math.hypot(mob.x - lastTarget.x, candidateY - lastTarget.y);
    if (distance > bounceRadiusPx + ctx.profile.mobHitRadius) {
      continue;
    }
    if (distance < bestDistance) {
      bestTarget = { kind: "mob", entity: mob, x: mob.x, y: candidateY };
      bestDistance = distance;
    }
  }

  for (const candidate of ctx.roomPlayers.values()) {
    if (candidate.id === player.id || candidate.dead || excludedIds.has(candidate.id)) {
      continue;
    }
    const candidateY = candidate.y + playerCenterOffsetY;
    const distance = Math.hypot(candidate.x - lastTarget.x, candidateY - lastTarget.y);
    if (distance > bounceRadiusPx + ctx.profile.playerHitRadius) {
      continue;
    }
    if (distance < bestDistance) {
      bestTarget = { kind: "player", entity: candidate, x: candidate.x, y: candidateY };
      bestDistance = distance;
    }
  }

  return bestTarget;
}

function lagCompensatedEnabledPosition(
  ctx: WoodStaffChainStrikeContext,
  player: BasePlayerState,
  at: number,
  enabled: boolean,
) {
  return enabled ? ctx.getPlayerPositionAt(player.id, at) ?? player : player;
}

function teleportPlayerBehindChainTarget(
  ctx: WoodStaffChainStrikeContext,
  player: BasePlayerState,
  target: ChainTarget,
) {
  const playerCenterOffsetY = -ctx.profile.playerHitRadius + ctx.profile.meleeStrikeOriginOffsetY;
  const targetHitRadius = target.kind === "mob" ? ctx.profile.mobHitRadius : ctx.profile.playerHitRadius;
  const desiredDistance = Math.max(12, ctx.profile.playerHitRadius + targetHitRadius - 4);
  const playerCenterX = player.x;
  const playerCenterY = player.y + playerCenterOffsetY;
  let directionX = target.x - playerCenterX;
  let directionY = target.y - playerCenterY;
  const directionLength = Math.hypot(directionX, directionY);

  if (directionLength <= 0.001) {
    directionX = 1;
    directionY = 0;
  } else {
    directionX /= directionLength;
    directionY /= directionLength;
  }

  const baseAngle = Math.atan2(directionY, directionX);
  const angleOffsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI];
  for (const angleOffset of angleOffsets) {
    const angle = baseAngle + angleOffset;
    const candidateCenterX = target.x + Math.cos(angle) * desiredDistance;
    const candidateCenterY = target.y + Math.sin(angle) * desiredDistance;
    const candidateX = candidateCenterX;
    const candidateY = candidateCenterY - playerCenterOffsetY;
    if (!ctx.canTeleportTo(candidateX, candidateY, player.id)) {
      continue;
    }

    player.x = candidateX;
    player.y = candidateY;
    return;
  }
}

function applyWoodStaffStrikeKnockback(
  ctx: WoodStaffChainStrikeContext,
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
