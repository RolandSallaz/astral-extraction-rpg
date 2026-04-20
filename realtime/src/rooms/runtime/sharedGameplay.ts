// Re-export gameplay profiles from the shared package so that
// the realtime server, frontend, and backend all share one
// source of truth for game-loop constants.
export {
  type RoomGameplayProfile,
  WORLD_GAMEPLAY_PROFILE,
  RAID_GAMEPLAY_PROFILE,
} from "@mmorpg/shared/gameplay/profiles";

export type BurnableEntity = {
  burnTicksRemaining: number;
  burnEndsAt: number;
};

export function applyBurnState(
  target: BurnableEntity,
  burnTicks: number,
  burnTickMs: number,
  durationMultiplier = 1,
  now = Date.now(),
) {
  target.burnTicksRemaining = Math.max(
    target.burnTicksRemaining,
    Math.round(burnTicks * durationMultiplier),
  );
  target.burnEndsAt = now + target.burnTicksRemaining * burnTickMs;
  return now + burnTickMs;
}

export function canProjectileHitOwner(
  projectile: {
    ownerId: string;
    returning: boolean;
    x: number;
    y: number;
    originX: number;
    originY: number;
  },
  selfHitGraceEndsAt: number,
  playerId: string,
  armDistance: number,
  now = Date.now(),
) {
  if (playerId !== projectile.ownerId) {
    return true;
  }

  return (
    projectile.returning ||
    (now >= selfHitGraceEndsAt &&
      Math.hypot(projectile.x - projectile.originX, projectile.y - projectile.originY) >= armDistance)
  );
}

export function getProjectileDamageScale(
  position: { x: number; y: number; originX: number; originY: number },
  combat: { damageScale?: number; maxDistance: number },
) {
  let damageScale = combat.damageScale || 1;

  if (combat.maxDistance > 0) {
    const distanceFromOrigin = Math.hypot(
      position.x - position.originX,
      position.y - position.originY,
    );
    const falloffScale = Math.max(0, 1 - distanceFromOrigin / combat.maxDistance);
    damageScale *= falloffScale;
  }

  return damageScale;
}

export function getProjectileDirectDamage(
  position: { x: number; y: number; originX: number; originY: number },
  combat: {
    damageScale?: number;
    maxDistance: number;
    executionThreshold: number;
    executionDamageMultiplier: number;
    criticalChance: number;
    criticalDamageMultiplier: number;
  },
  baseDamage: number,
  targetHealth: number,
  targetMaxHealth: number,
) {
  let damage = baseDamage * getProjectileDamageScale(position, combat);
  if (
    combat.executionThreshold > 0 &&
    targetMaxHealth > 0 &&
    targetHealth / targetMaxHealth <= combat.executionThreshold
  ) {
    damage *= combat.executionDamageMultiplier;
  }

  let isCritical = false;
  if (combat.criticalChance > 0 && Math.random() < combat.criticalChance) {
    damage *= combat.criticalDamageMultiplier;
    isCritical = true;
  }

  return {
    damage: Math.max(0, Math.round(damage)),
    isCritical,
  };
}

export function startProjectileReturn(
  projectile: {
    x: number;
    y: number;
    originX: number;
    originY: number;
    directionX: number;
    directionY: number;
    lifetime: number;
    returning: boolean;
  },
  projectileSpeed: number,
) {
  const deltaX = projectile.originX - projectile.x;
  const deltaY = projectile.originY - projectile.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0.001) {
    return false;
  }

  projectile.directionX = deltaX / distance;
  projectile.directionY = deltaY / distance;
  projectile.lifetime = distance / projectileSpeed + 0.05;
  projectile.returning = true;
  return true;
}

export function tryBounceProjectile(
  projectile: {
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    bouncesRemaining: number;
  },
  previousX: number,
  previousY: number,
  wouldBlockX: boolean,
  wouldBlockY: boolean,
) {
  if (projectile.bouncesRemaining <= 0) {
    return false;
  }

  projectile.x = previousX;
  projectile.y = previousY;

  if (wouldBlockX && !wouldBlockY) {
    projectile.directionX *= -1;
  } else if (!wouldBlockX && wouldBlockY) {
    projectile.directionY *= -1;
  } else {
    projectile.directionX *= -1;
    projectile.directionY *= -1;
  }

  projectile.bouncesRemaining -= 1;
  return true;
}

export function awardExperience(
  player: { experience: number; level: number },
  amount: number,
) {
  if (amount <= 0) {
    return 0;
  }

  player.experience += amount;
  let levelsGained = 0;

  while (player.experience >= player.level * 100) {
    player.experience -= player.level * 100;
    player.level += 1;
    levelsGained += 1;
  }

  return levelsGained;
}

export function buildGroundEffectTileArea(options: {
  centerTileX: number;
  centerTileY: number;
  radiusTiles: number;
  width: number;
  height: number;
  isBlocked: (tileX: number, tileY: number) => boolean;
}) {
  const tiles: Array<{ tileX: number; tileY: number }> = [];

  for (let offsetY = -options.radiusTiles; offsetY <= options.radiusTiles; offsetY += 1) {
    for (let offsetX = -options.radiusTiles; offsetX <= options.radiusTiles; offsetX += 1) {
      const tileX = options.centerTileX + offsetX;
      const tileY = options.centerTileY + offsetY;

      if (
        tileX < 0 ||
        tileY < 0 ||
        tileX >= options.width ||
        tileY >= options.height ||
        options.isBlocked(tileX, tileY)
      ) {
        continue;
      }

      tiles.push({ tileX, tileY });
    }
  }

  return tiles;
}
