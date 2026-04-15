import { type MapSchema } from "@colyseus/schema";
import type { SkillBalanceConfig } from "@mmorpg/shared";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import {
  type ProjectileState,
  type ProjectileServerData,
  createDefaultProjectileServerData,
} from "../schema/ProjectileState.js";
import { setMobAggroTarget } from "../mobAi.js";
import {
  applyGemConfigToProjectile,
  buildOnHitProjectileEffects,
  shouldProjectileDealDirectDamage,
  type DamageType,
} from "../projectileSkills.js";
import {
  canProjectileHitOwner,
  startProjectileReturn as startSharedProjectileReturn,
  tryBounceProjectile as trySharedProjectileBounce,
} from "../sharedGameplay.js";
import {
  FIREBALL_SHARD_SKILL_ID,
  type ProjectileGemConfig,
} from "../fireballGems.js";
import type { ProjectileSystem } from "../systems/ProjectileSystem.js";

export interface ProjectileStateContext {
  profile: RoomGameplayProfile;
  roomProjectiles: MapSchema<ProjectileState>;
  projectileServerData: Map<string, ProjectileServerData>;
  projectileHitHistory: Map<string, Set<string>>;
  projectileSystem: ProjectileSystem;
  getPlayer(playerId: string): BasePlayerState | undefined;
  createProjectileState(): ProjectileState;
}

export interface ProjectileSpatialQueryContext {
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  isBlockedTile(tileX: number, tileY: number): boolean;
  queryNearbyPlayers(x: number, y: number, radius: number): Iterable<BasePlayerState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  ensureSpatialGrids(): void;
  findNearestProjectileTarget(
    projectile: ProjectileState,
    maxDistance: number,
    excludedEntityId?: string,
  ): { entity: BasePlayerState | MobState; distance: number } | null;
}

export interface ProjectileCombatContext {
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  markMobSpatialDirty(): void;
  awardExperience(playerId: string, amount: number): void;
  applyBurnToPlayer(player: BasePlayerState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string): void;
  applyBurnToMob(mob: MobState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string): void;
  applyProjectileLifesteal(ownerId: string, resolvedDamage: number, targetPlayerId?: string): void;
  pushTargetByKnockback(
    fromX: number,
    fromY: number,
    target: { x: number; y: number },
    knockbackDistance: number,
    applyPosition: (x: number, y: number) => void,
  ): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  onCombatLog(text: string): void;
  createFireTrail(ownerId: string, tileX: number, tileY: number, now: number): void;
}

export interface ProjectileSkillRuntimeContext {
  getProjectileDamageScale(projectile: ProjectileState, sd: ProjectileServerData): number;
  getProjectileDirectDamage(
    projectile: ProjectileState,
    sd: ProjectileServerData,
    targetHealth: number,
    targetMaxHealth: number,
  ): { damage: number; isCritical: boolean };
  getSkillBalanceKey(skillId: string): keyof SkillBalanceConfig;
  getSkillDirectDamage(skillId: string): number;
  getOwnerProjectileGemConfig(ownerId: string, skillId: string): ProjectileGemConfig;
  getProjectileBounceCount(ownerId: string, skillId: string): number;
  getProjectileRangeMultiplier(ownerId: string, skillId: string): number;
  canProjectileLeaveTrail(projectile: ProjectileState): boolean;
  canProjectileShatter(projectile: ProjectileState): boolean;
  isProjectileReturningEnabled(projectile: ProjectileState): boolean;
}

export interface ProjectileRuntimeContext {
  state: ProjectileStateContext;
  spatial: ProjectileSpatialQueryContext;
  combat: ProjectileCombatContext;
  skills: ProjectileSkillRuntimeContext;
}

export function deleteProjectile(ctx: ProjectileRuntimeContext, projectileId: string): void {
  ctx.state.projectileHitHistory.delete(projectileId);
  ctx.state.projectileServerData.delete(projectileId);
  ctx.state.roomProjectiles.delete(projectileId);
}

export function spawnProjectile(
  ctx: ProjectileRuntimeContext,
  ownerId: string,
  skillId: string,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  lifetime: number,
  damageScale = 1,
  sizeScale = 1,
): void {
  const p = ctx.state.profile;
  const gemConfig = ctx.skills.getOwnerProjectileGemConfig(ownerId, skillId);
  const projectile = ctx.state.createProjectileState();
  projectile.id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  projectile.ownerId = ownerId;
  projectile.skillId = skillId;
  projectile.x = x;
  projectile.y = y;
  projectile.directionX = directionX;
  projectile.directionY = directionY;
  projectile.originX = x;
  projectile.originY = y;
  const serverData = createDefaultProjectileServerData();
  applyGemConfigToProjectile(projectile, serverData, gemConfig, {
    bounceCount: ctx.skills.getProjectileBounceCount(ownerId, skillId),
    rangeMultiplier: ctx.skills.getProjectileRangeMultiplier(ownerId, skillId),
    fireballSpeed: p.fireballSpeed,
    selfHitGraceMs: p.fireballSelfHitGraceMs,
    now: Date.now(),
    lifetime,
    damageScale,
    sizeScale,
  });
  ctx.state.roomProjectiles.set(projectile.id, projectile);
  ctx.state.projectileServerData.set(projectile.id, serverData);
}

function getProjectileHitHistory(ctx: ProjectileRuntimeContext, projectileId: string): Set<string> {
  let history = ctx.state.projectileHitHistory.get(projectileId);
  if (!history) {
    history = new Set<string>();
    ctx.state.projectileHitHistory.set(projectileId, history);
  }
  return history;
}

function canProjectileReturn(ctx: ProjectileRuntimeContext, projectile: ProjectileState): boolean {
  return !projectile.returning && ctx.skills.isProjectileReturningEnabled(projectile);
}

function startProjectileReturn(ctx: ProjectileRuntimeContext, projectile: ProjectileState): boolean {
  return startSharedProjectileReturn(projectile, ctx.state.profile.fireballSpeed);
}

function explodeFireballIntoShards(ctx: ProjectileRuntimeContext, projectile: ProjectileState): void {
  if (!ctx.skills.canProjectileShatter(projectile)) {
    return;
  }
  const p = ctx.state.profile;
  for (let index = 0; index < p.fireballShardCount; index += 1) {
    const angle = (Math.PI * 2 * index) / p.fireballShardCount;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    spawnProjectile(
      ctx,
      projectile.ownerId,
      FIREBALL_SHARD_SKILL_ID,
      projectile.x + dirX * 6,
      projectile.y + dirY * 6,
      dirX,
      dirY,
      p.fireballShardLifetime,
      0,
      0.6,
    );
  }
}

function tryBounceProjectile(
  ctx: ProjectileRuntimeContext,
  projectile: ProjectileState,
  previousX: number,
  previousY: number,
): boolean {
  const tileSize = ctx.state.profile.tileSize;
  return trySharedProjectileBounce(
    projectile,
    previousX,
    previousY,
    ctx.spatial.isBlockedTile(Math.floor(projectile.x / tileSize), Math.floor(previousY / tileSize)),
    ctx.spatial.isBlockedTile(Math.floor(previousX / tileSize), Math.floor(projectile.y / tileSize)),
  );
}

function tryChainProjectile(
  ctx: ProjectileRuntimeContext,
  projectile: ProjectileState,
  sd: ProjectileServerData,
  excludeEntityId: string,
): boolean {
  if (sd.chainRemaining <= 0) {
    return false;
  }
  const bestTarget = ctx.spatial.findNearestProjectileTarget(projectile, 180, excludeEntityId);
  if (!bestTarget) {
    return false;
  }
  const dx = bestTarget.entity.x - projectile.x;
  const dy = bestTarget.entity.y - projectile.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    return false;
  }
  projectile.directionX = dx / distance;
  projectile.directionY = dy / distance;
  sd.chainRemaining -= 1;
  return true;
}

function applyProjectileSplash(
  ctx: ProjectileRuntimeContext,
  projectile: ProjectileState,
  sd: ProjectileServerData,
  hitX: number,
  hitY: number,
  excludedEntityId: string | null,
): void {
  if (sd.splashRadius <= 0 || sd.splashDamageScale <= 0) {
    return;
  }

  const splashDamage = Math.max(
    0,
    Math.round(
      ctx.skills.getSkillDirectDamage(projectile.skillId) *
        sd.splashDamageScale *
        ctx.skills.getProjectileDamageScale(projectile, sd),
    ),
  );
  if (splashDamage <= 0) {
    return;
  }

  for (const player of ctx.spatial.queryNearbyPlayers(hitX, hitY, sd.splashRadius)) {
    if (player.dead || `player:${player.id}` === excludedEntityId) {
      continue;
    }
    const dealt = ctx.combat.applyDamageToPlayer(player, splashDamage, "fire");
    ctx.combat.applyProjectileLifesteal(projectile.ownerId, dealt, player.id);
    if (player.health <= 0) {
      ctx.combat.handlePlayerKilled(player);
    }
  }

  for (const mob of ctx.spatial.queryNearbyMobs(hitX, hitY, sd.splashRadius)) {
    if (mob.dead || `mob:${mob.id}` === excludedEntityId) {
      continue;
    }
    mob.health = Math.max(0, mob.health - splashDamage);
    ctx.combat.applyProjectileLifesteal(projectile.ownerId, splashDamage);
    if (mob.health <= 0) {
      ctx.combat.markMobSpatialDirty();
      ctx.combat.handleMobDeath(mob);
      ctx.combat.awardExperience(projectile.ownerId, mob.experienceReward);
    }
  }
}

function applyOnHitGemEffects(
  ctx: ProjectileRuntimeContext,
  projectile: ProjectileState,
  sd: ProjectileServerData,
): void {
  const p = ctx.state.profile;
  const { spawns, aftershock } = buildOnHitProjectileEffects(projectile, sd, {
    fireballLifetime: p.fireballLifetime,
    fireballShardLifetime: p.fireballShardLifetime,
    shardSkillId: FIREBALL_SHARD_SKILL_ID,
  });

  spawns.forEach((spawn) => {
    spawnProjectile(
      ctx,
      spawn.ownerId,
      spawn.skillId,
      spawn.x,
      spawn.y,
      spawn.directionX,
      spawn.directionY,
      spawn.lifetime,
      spawn.damageScale ?? 1,
      spawn.sizeScale ?? 1,
    );
  });

  if (aftershock) {
    ctx.state.projectileSystem.queueAftershock(aftershock);
  }
}

function canProjectileHitPlayer(
  ctx: ProjectileRuntimeContext,
  projectile: ProjectileState,
  sd: ProjectileServerData,
  player: BasePlayerState,
): boolean {
  return canProjectileHitOwner(
    projectile,
    sd.selfHitGraceEndsAt,
    player.id,
    ctx.state.profile.fireballSelfHitArmDistance,
  );
}

export function updateRoomProjectiles(
  ctx: ProjectileRuntimeContext,
  deltaSeconds: number,
  now: number,
): void {
  ctx.spatial.ensureSpatialGrids();
  const tileSize = ctx.state.profile.tileSize;
  const widthPx = ctx.spatial.getMapWidthPx();
  const heightPx = ctx.spatial.getMapHeightPx();
  const p = ctx.state.profile;

  for (const [projectileId, projectile] of ctx.state.roomProjectiles.entries()) {
    const sd = ctx.state.projectileServerData.get(projectileId);
    if (!sd) {
      ctx.state.roomProjectiles.delete(projectileId);
      continue;
    }

    if (sd.homingStrength > 0) {
      const closestTarget = ctx.spatial.findNearestProjectileTarget(projectile, 180);
      if (closestTarget) {
        const desiredX = (closestTarget.entity.x - projectile.x) / Math.max(closestTarget.distance, 0.001);
        const desiredY = (closestTarget.entity.y - projectile.y) / Math.max(closestTarget.distance, 0.001);
        const steer = Math.min(1, sd.homingStrength * deltaSeconds);
        const nextDirX = projectile.directionX + (desiredX - projectile.directionX) * steer;
        const nextDirY = projectile.directionY + (desiredY - projectile.directionY) * steer;
        const length = Math.hypot(nextDirX, nextDirY);
        if (length > 0.001) {
          projectile.directionX = nextDirX / length;
          projectile.directionY = nextDirY / length;
        }
      }
    }

    if (sd.orbitTimeRemaining > 0) {
      const owner = ctx.state.getPlayer(projectile.ownerId);
      if (owner && !owner.dead) {
        const elapsed = sd.orbitTimeRemaining > deltaSeconds * 1000
          ? deltaSeconds * 1000
          : sd.orbitTimeRemaining;
        sd.orbitTimeRemaining -= elapsed;
        const angle = (now / 1000) * Math.PI * 4;
        projectile.x = owner.x + Math.cos(angle) * sd.orbitRadius;
        projectile.y = owner.y + Math.sin(angle) * sd.orbitRadius;
        projectile.originX = owner.x;
        projectile.originY = owner.y;
        continue;
      }
      sd.orbitTimeRemaining = 0;
    }

    const previousX = projectile.x;
    const previousY = projectile.y;
    const speed = projectile.speed > 0 ? projectile.speed : p.fireballSpeed;

    if (projectile.spiralAmplitude > 0 && projectile.spiralFrequency > 0) {
      const prevOffset = Math.sin(projectile.spiralPhase) * projectile.spiralAmplitude;
      projectile.spiralPhase += speed * deltaSeconds * projectile.spiralFrequency * 0.01;
      const nextOffset = Math.sin(projectile.spiralPhase) * projectile.spiralAmplitude;
      const offsetDelta = nextOffset - prevOffset;
      sd.distanceTraveled += speed * deltaSeconds;
      const perpX = -projectile.directionY;
      const perpY = projectile.directionX;
      projectile.x += projectile.directionX * speed * deltaSeconds + perpX * offsetDelta;
      projectile.y += projectile.directionY * speed * deltaSeconds + perpY * offsetDelta;
    } else {
      projectile.x += projectile.directionX * speed * deltaSeconds;
      projectile.y += projectile.directionY * speed * deltaSeconds;
    }

    projectile.lifetime -= deltaSeconds;

    if (projectile.lifetime <= 0) {
      if (canProjectileReturn(ctx, projectile) && startProjectileReturn(ctx, projectile)) {
        continue;
      }
      deleteProjectile(ctx, projectileId);
      continue;
    }

    const pad = p.projectileBoundsPadding;
    if (
      projectile.x < -pad ||
      projectile.y < -pad ||
      projectile.x > widthPx + pad ||
      projectile.y > heightPx + pad
    ) {
      deleteProjectile(ctx, projectileId);
      continue;
    }

    if (
      projectile.returning &&
      Math.hypot(projectile.x - projectile.originX, projectile.y - projectile.originY) <= 12
    ) {
      deleteProjectile(ctx, projectileId);
      continue;
    }

    const tileX = Math.floor(projectile.x / tileSize);
    const tileY = Math.floor(projectile.y / tileSize);
    if (ctx.spatial.isBlockedTile(tileX, tileY)) {
      if (tryBounceProjectile(ctx, projectile, previousX, previousY)) {
        continue;
      }
      applyProjectileSplash(ctx, projectile, sd, projectile.x, projectile.y, null);
      explodeFireballIntoShards(ctx, projectile);
      deleteProjectile(ctx, projectileId);
      continue;
    }

    if (ctx.skills.canProjectileLeaveTrail(projectile)) {
      ctx.combat.createFireTrail(projectile.ownerId, tileX, tileY, now);
    }

    if (!shouldProjectileDealDirectDamage(projectile.skillId)) {
      continue;
    }

    const hitHistory = getProjectileHitHistory(ctx, projectileId);
    let hitPlayer = false;

    for (const player of ctx.spatial.queryNearbyPlayers(projectile.x, projectile.y, p.playerHitRadius)) {
      if (player.dead || !canProjectileHitPlayer(ctx, projectile, sd, player) || hitHistory.has(`player:${player.id}`)) {
        continue;
      }

      const attacker = ctx.state.getPlayer(projectile.ownerId);
      const { damage: resolvedDamage, isCritical } = ctx.skills.getProjectileDirectDamage(
        projectile,
        sd,
        player.health,
        player.maxHealth,
      );
      const finalDamage = ctx.combat.applyDamageToPlayer(player, resolvedDamage, "fire");
      ctx.combat.applyProjectileLifesteal(projectile.ownerId, finalDamage, player.id);
      ctx.combat.onCombatLog(`${attacker?.name || "Wanderer"} hits ${player.name} for ${finalDamage}.`);
      if (isCritical && finalDamage > 0) {
        ctx.combat.broadcastDamageText(player.x, player.y - 18, `-${finalDamage}`);
      }
      ctx.combat.applyBurnToPlayer(player, ctx.skills.getSkillBalanceKey(projectile.skillId), projectile.ownerId);
      ctx.combat.pushTargetByKnockback(projectile.x, projectile.y, player, sd.knockbackDistance, (nx, ny) => {
        player.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
        player.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
      });
      applyProjectileSplash(ctx, projectile, sd, projectile.x, projectile.y, `player:${player.id}`);
      hitHistory.add(`player:${player.id}`);

      if (player.health <= 0) {
        ctx.combat.handlePlayerKilled(player);
      }

      if (sd.piercesRemaining > 0) {
        sd.piercesRemaining -= 1;
        hitPlayer = true;
        break;
      }

      if (tryChainProjectile(ctx, projectile, sd, `player:${player.id}`)) {
        hitPlayer = true;
        break;
      }

      applyOnHitGemEffects(ctx, projectile, sd);
      explodeFireballIntoShards(ctx, projectile);
      deleteProjectile(ctx, projectileId);
      hitPlayer = true;
      break;
    }

    if (hitPlayer) {
      continue;
    }

    let hitMob = false;
    for (const mob of ctx.spatial.queryNearbyMobs(projectile.x, projectile.y, p.mobHitRadius)) {
      if (mob.dead || hitHistory.has(`mob:${mob.id}`)) {
        continue;
      }

      const attacker = ctx.state.getPlayer(projectile.ownerId);
      const { damage: resolvedDamage, isCritical } = ctx.skills.getProjectileDirectDamage(
        projectile,
        sd,
        mob.health,
        mob.maxHealth,
      );
      mob.health = Math.max(0, mob.health - resolvedDamage);
      ctx.combat.applyProjectileLifesteal(projectile.ownerId, resolvedDamage);
      if (attacker && !attacker.dead) {
        setMobAggroTarget(mob, attacker);
      }
      ctx.combat.onCombatLog(`${attacker?.name || "Wanderer"} hits ${mob.name} for ${resolvedDamage}.`);
      if (isCritical && resolvedDamage > 0) {
        ctx.combat.broadcastDamageText(mob.x, mob.y - 18, `-${resolvedDamage}`);
      }
      ctx.combat.applyBurnToMob(mob, ctx.skills.getSkillBalanceKey(projectile.skillId), projectile.ownerId);
      ctx.combat.pushTargetByKnockback(projectile.x, projectile.y, mob, sd.knockbackDistance, (nx, ny) => {
        mob.x = nx;
        mob.y = ny;
        ctx.combat.markMobSpatialDirty();
      });
      applyProjectileSplash(ctx, projectile, sd, projectile.x, projectile.y, `mob:${mob.id}`);
      hitHistory.add(`mob:${mob.id}`);
      hitMob = true;

      if (mob.health <= 0) {
        ctx.combat.markMobSpatialDirty();
        ctx.combat.handleMobDeath(mob);
        ctx.combat.awardExperience(projectile.ownerId, mob.experienceReward);
      }

      if (sd.piercesRemaining > 0) {
        sd.piercesRemaining -= 1;
        break;
      }

      if (tryChainProjectile(ctx, projectile, sd, `mob:${mob.id}`)) {
        break;
      }

      applyOnHitGemEffects(ctx, projectile, sd);
      explodeFireballIntoShards(ctx, projectile);
      deleteProjectile(ctx, projectileId);
      break;
    }

    if (hitMob) {
      continue;
    }
  }
}
