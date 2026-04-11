import { type ProjectileState } from "../schema/ProjectileState.js";
import { SpatialGrid } from "../services/SpatialGrid.js";

export type SpatialRuntimeEntity = {
  id: string;
  x: number;
  y: number;
  dead: boolean;
};

export function rebuildRoomSpatialGrid<T extends SpatialRuntimeEntity>(
  grid: SpatialGrid<T>,
  order: Map<string, number>,
  entities: Iterable<T>,
) {
  const aliveEntities = Array.from(entities).filter((entity) => !entity.dead);
  order.clear();
  aliveEntities.forEach((entity, index) => {
    order.set(entity.id, index);
  });
  grid.rebuild(aliveEntities);
}

export function queryNearbyRoomEntities<T extends { id: string; x: number; y: number }>(
  grid: SpatialGrid<T>,
  order: Map<string, number>,
  x: number,
  y: number,
  radius: number,
) {
  return grid.queryRadius(x, y, radius).sort(
    (left, right) =>
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function findNearestRoomProjectileTarget<
  TPlayer extends SpatialRuntimeEntity,
  TMob extends SpatialRuntimeEntity,
>(
  projectile: ProjectileState,
  maxDistance: number,
  playerGrid: SpatialGrid<TPlayer>,
  mobGrid: SpatialGrid<TMob>,
  excludedEntityId?: string,
) {
  const nearestPlayer = playerGrid.findNearest(
    projectile.x,
    projectile.y,
    maxDistance,
    (player) =>
      !player.dead &&
      player.id !== projectile.ownerId &&
      `player:${player.id}` !== excludedEntityId,
  );
  const nearestMob = mobGrid.findNearest(
    projectile.x,
    projectile.y,
    maxDistance,
    (mob) => !mob.dead && `mob:${mob.id}` !== excludedEntityId,
  );

  if (!nearestPlayer) {
    return nearestMob;
  }

  if (!nearestMob) {
    return nearestPlayer;
  }

  return nearestPlayer.distance <= nearestMob.distance ? nearestPlayer : nearestMob;
}
