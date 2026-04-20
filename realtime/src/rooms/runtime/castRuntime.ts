import { getFireballCastRange } from "./fireballGems.js";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type BasePlayerState } from "../schema/BasePlayerState.js";

export function clampTargetToCastRange(
  profile: RoomGameplayProfile,
  player: BasePlayerState,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
) {
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const distance = Math.hypot(deltaX, deltaY);
  const castRange = getFireballCastRange(profile.staffCastRange, player);

  if (distance <= castRange || distance <= 0.001) {
    return { x: targetX, y: targetY };
  }

  const scale = castRange / distance;
  return {
    x: originX + deltaX * scale,
    y: originY + deltaY * scale,
  };
}
