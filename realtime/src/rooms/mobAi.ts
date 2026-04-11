import { type MobKind } from "@mmorpg/shared/mobs/catalog";
import { MobState } from "./schema/MobState.js";

export type MobAiPlayer = {
  id: string;
  x: number;
  y: number;
  dead?: boolean;
};

type ResolveMobAggroTargetOptions<T extends MobAiPlayer> = {
  canAcquireTarget?: (player: T) => boolean;
  now?: number;
};

type MobMoveOptions = {
  deltaSeconds: number;
  desiredX: number;
  desiredY: number;
  canMoveTo?: (x: number, y: number) => boolean;
};

type SetMobAggroTargetOptions = {
  now?: number;
  lockDurationMs?: number;
};

const MIN_EFFECTIVE_MOB_MOVE_SPEED = 56;
const MIN_EFFECTIVE_MOB_ATTACK_RANGE = 24;
const MIN_EFFECTIVE_MOB_AGGRO_RANGE = 480;
const AGGRO_RETARGET_DISTANCE_BUFFER = 32;
const FORCED_AGGRO_LOCK_MS = 2500;

function resolveMobKind(mob: MobState): MobKind {
  if (mob.kind === "bat" || mob.kind === "rat") {
    return mob.kind;
  }

  return mob.texture === "bat" ? "bat" : "rat";
}

function getMobHomeX(mob: MobState) {
  if (mob.spawnX > 0) {
    return mob.spawnX;
  }

  if (mob.patrolMinX > 0 || mob.patrolMaxX > 0) {
    return (mob.patrolMinX + mob.patrolMaxX) / 2;
  }

  return mob.x;
}

function getMobHomeY(mob: MobState) {
  if (mob.spawnY > 0) {
    return mob.spawnY;
  }

  if (mob.patrolY !== 0) {
    return mob.patrolY;
  }

  return mob.y;
}

export function resetMobToSpawn(mob: MobState) {
  const spawnX = getMobHomeX(mob);
  const spawnY = getMobHomeY(mob);
  mob.dead = false;
  mob.aggroTargetId = "";
  mob.aggroLockedUntil = 0;
  mob.health = mob.maxHealth;
  mob.burnTicksRemaining = 0;
  mob.burnEndsAt = 0;
  mob.x = spawnX;
  mob.y = spawnY;
  mob.targetX = spawnX;
  mob.targetY = spawnY;
  mob.respawnAt = 0;
  mob.attackCooldownEndsAt = 0;
}

export function setMobAggroTarget(
  mob: MobState,
  target: MobAiPlayer | null,
  options: SetMobAggroTargetOptions = {},
) {
  const { now = Date.now(), lockDurationMs = FORCED_AGGRO_LOCK_MS } = options;

  if (!target || target.dead) {
    mob.aggroTargetId = "";
    mob.aggroLockedUntil = 0;
    return;
  }

  mob.aggroTargetId = target.id;
  mob.aggroLockedUntil = lockDurationMs > 0 ? now + lockDurationMs : 0;
  mob.targetX = target.x;
  mob.targetY = target.y;
}

export function resolveMobAggroTarget<T extends MobAiPlayer>(
  mob: MobState,
  players: Iterable<T>,
  options: ResolveMobAggroTargetOptions<T> = {},
) {
  const { canAcquireTarget, now = Date.now() } = options;
  const effectiveAggroRange = Math.max(mob.aggroRange, MIN_EFFECTIVE_MOB_AGGRO_RANGE);
  let currentTarget: T | null = null;
  const playerList = Array.from(players);

  for (const player of playerList) {
    if (player.id === mob.aggroTargetId) {
      currentTarget = player;
      break;
    }
  }

  if (currentTarget && !currentTarget.dead && mob.aggroLockedUntil > now) {
    mob.targetX = currentTarget.x;
    mob.targetY = currentTarget.y;
    return currentTarget;
  }

  let closestTarget: T | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  if (currentTarget && !currentTarget.dead) {
    closestTarget = currentTarget;
    closestDistance = Math.hypot(currentTarget.x - mob.x, currentTarget.y - mob.y);
  } else {
    mob.aggroTargetId = "";
    mob.aggroLockedUntil = 0;
  }

  for (const player of playerList) {
    if (player.dead) {
      continue;
    }

    const distance = Math.hypot(player.x - mob.x, player.y - mob.y);

    if (player.id === currentTarget?.id) {
      closestTarget = player;
      closestDistance = distance;
      continue;
    }

    if (canAcquireTarget && !canAcquireTarget(player)) {
      continue;
    }

    if (distance > effectiveAggroRange) {
      continue;
    }

    if (
      closestTarget &&
      closestTarget.id === currentTarget?.id &&
      distance > closestDistance - AGGRO_RETARGET_DISTANCE_BUFFER
    ) {
      continue;
    }

    if (distance > closestDistance) {
      continue;
    }

    closestTarget = player;
    closestDistance = distance;
  }

  if (closestTarget) {
    mob.aggroTargetId = closestTarget.id;
    mob.targetX = closestTarget.x;
    mob.targetY = closestTarget.y;
    return closestTarget;
  }

  mob.aggroLockedUntil = 0;
  return null;
}

export function getMobDesiredTargetPosition(
  mob: MobState,
  target: MobAiPlayer | null,
  now: number,
) {
  const timeSeconds = now / 1000;
  const phase = mob.patrolPhase + timeSeconds;
  const homeX = getMobHomeX(mob);
  const homeY = getMobHomeY(mob);
  const patrolRadiusX = Math.max(10, Math.abs(mob.patrolMaxX - mob.patrolMinX) / 2);
  const patrolRadiusY = Math.max(0, mob.patrolRadiusY);

  if (target) {
    if (resolveMobKind(mob) === "bat") {
      const orbitRadius = Math.max(mob.attackRange * 1.5, 34);
      return {
        x: target.x + Math.cos(phase * 2.2) * orbitRadius,
        y:
          target.y -
          10 +
          Math.sin(phase * 1.6 + mob.patrolPhase) * Math.max(10, patrolRadiusY || 10),
      };
    }

    return {
      x: target.x,
      y: target.y,
    };
  }

  if (resolveMobKind(mob) === "bat") {
    return {
      x: homeX + Math.cos(phase * 1.15) * patrolRadiusX,
      y: homeY + Math.sin(phase * 1.7 + mob.patrolPhase) * Math.max(8, patrolRadiusY || 8),
    };
  }

  return {
    x: homeX + Math.cos(phase * 0.9) * patrolRadiusX,
    y: homeY,
  };
}

export function moveMobTowards(mob: MobState, options: MobMoveOptions) {
  const { deltaSeconds, desiredX, desiredY, canMoveTo } = options;
  mob.targetX = desiredX;
  mob.targetY = desiredY;

  const deltaX = desiredX - mob.x;
  const deltaY = desiredY - mob.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 2) {
    return;
  }

  const maxStep = Math.max(mob.moveSpeed, MIN_EFFECTIVE_MOB_MOVE_SPEED) * deltaSeconds;
  const step = Math.min(distance, maxStep);
  const moveX = (deltaX / distance) * step;
  const moveY = (deltaY / distance) * step;
  const nextX = mob.x + moveX;
  const nextY = mob.y + moveY;

  if (!canMoveTo) {
    mob.x = nextX;
    mob.y = nextY;
    return;
  }

  let moved = false;
  if (canMoveTo(nextX, mob.y)) {
    mob.x = nextX;
    moved = true;
  }

  if (canMoveTo(mob.x, nextY)) {
    mob.y = nextY;
    moved = true;
  }

  if (moved) {
    return;
  }

  if (canMoveTo(nextX, nextY)) {
    mob.x = nextX;
    mob.y = nextY;
    return;
  }

  const perpendicularX = mob.x - moveY;
  const perpendicularY = mob.y + moveX;
  if (canMoveTo(perpendicularX, perpendicularY)) {
    mob.x = perpendicularX;
    mob.y = perpendicularY;
  }
}

export function getEffectiveMobAttackRange(mob: MobState) {
  return Math.max(mob.attackRange, MIN_EFFECTIVE_MOB_ATTACK_RANGE);
}
