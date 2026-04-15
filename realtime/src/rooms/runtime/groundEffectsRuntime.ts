import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { buildGroundEffectTileArea } from "../sharedGameplay.js";
import { GroundEffectState } from "../schema/GroundEffectState.js";

type CreateFireFieldParams = {
  profile: RoomGameplayProfile;
  playerId: string;
  targetX: number;
  targetY: number;
  now: number;
  groundEffects: MapSchema<GroundEffectState>;
  getMapWidthTiles: () => number;
  getMapHeightTiles: () => number;
  isBlockedTile: (tileX: number, tileY: number) => boolean;
};

type CreateFireTrailParams = {
  profile: RoomGameplayProfile;
  ownerId: string;
  tileX: number;
  tileY: number;
  now: number;
  groundEffects: MapSchema<GroundEffectState>;
  getMapWidthTiles: () => number;
  getMapHeightTiles: () => number;
  isBlockedTile: (tileX: number, tileY: number) => boolean;
  durationMultiplier: number;
};

export function createFireField({
  profile,
  playerId,
  targetX,
  targetY,
  now,
  groundEffects,
  getMapWidthTiles,
  getMapHeightTiles,
  isBlockedTile,
}: CreateFireFieldParams) {
  const tileSize = profile.tileSize;
  const centerTileX = Math.max(0, Math.min(getMapWidthTiles() - 1, Math.floor(targetX / tileSize)));
  const centerTileY = Math.max(0, Math.min(getMapHeightTiles() - 1, Math.floor(targetY / tileSize)));

  for (const { tileX, tileY } of buildGroundEffectTileArea({
    centerTileX,
    centerTileY,
    radiusTiles: profile.fireFieldRadiusTiles,
    width: getMapWidthTiles(),
    height: getMapHeightTiles(),
    isBlocked: (tx, ty) => isBlockedTile(tx, ty),
  })) {
    const effectId = `fire-field-${playerId}-${tileX}-${tileY}`;
    let effect = groundEffects.get(effectId);
    if (!effect) {
      effect = new GroundEffectState();
      effect.id = effectId;
      effect.ownerId = playerId;
      effect.skillId = "fireField";
      effect.tileX = tileX;
      effect.tileY = tileY;
      effect.x = tileX * tileSize + tileSize / 2;
      effect.y = tileY * tileSize + tileSize / 2;
      groundEffects.set(effectId, effect);
    }

    effect.ownerId = playerId;
    effect.expiresAt = now + profile.fireFieldDurationMs;
    effect.nextTickAt = now + profile.fireFieldTickMs;
  }
}

export function createFireTrail({
  profile,
  ownerId,
  tileX,
  tileY,
  now,
  groundEffects,
  getMapWidthTiles,
  getMapHeightTiles,
  isBlockedTile,
  durationMultiplier,
}: CreateFireTrailParams) {
  const tileSize = profile.tileSize;
  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX >= getMapWidthTiles() ||
    tileY >= getMapHeightTiles() ||
    isBlockedTile(tileX, tileY)
  ) {
    return;
  }

  const effectId = `fire-trail-${ownerId}-${tileX}-${tileY}`;
  let effect = groundEffects.get(effectId);
  if (!effect) {
    effect = new GroundEffectState();
    effect.id = effectId;
    effect.ownerId = ownerId;
    effect.skillId = "fireTrail";
    effect.tileX = tileX;
    effect.tileY = tileY;
    effect.x = tileX * tileSize + tileSize / 2;
    effect.y = tileY * tileSize + tileSize / 2;
    groundEffects.set(effectId, effect);
  }

  effect.ownerId = ownerId;
  effect.expiresAt = now + Math.round(profile.fireTrailDurationMs * durationMultiplier);
  effect.nextTickAt = now + profile.fireTrailTickMs;
}
