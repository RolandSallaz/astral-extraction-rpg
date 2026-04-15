import type { SkillId } from "@mmorpg/shared/skills/registry";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "../skills/SkillHandler.js";

type PendingSkillCast = {
  skillId: SkillId;
  targetX?: number;
  targetY?: number;
};

export type SkillCastSystemContext = {
  getPlayer: (playerId: string) => BasePlayerState | undefined;
  getSkillHandler: (skillId: SkillId) => SkillHandler | undefined;
  createSkillCastContext: (
    playerId: string,
    player: BasePlayerState,
    now: number,
  ) => SkillCastContext;
  clearPlayerCastState: (player: BasePlayerState) => void;
  performTeleportScroll: (playerId: string, player: BasePlayerState) => void;
};

export class SkillCastSystem {
  private readonly pendingSkillCasts = new Map<string, PendingSkillCast>();
  private readonly pendingTeleportScrollCasts = new Set<string>();

  queueSkillCast(playerId: string, cast: PendingSkillCast) {
    this.pendingSkillCasts.set(playerId, cast);
  }

  queueTeleportScroll(playerId: string) {
    this.pendingTeleportScrollCasts.add(playerId);
  }

  clearPlayer(playerId: string) {
    this.pendingSkillCasts.delete(playerId);
    this.pendingTeleportScrollCasts.delete(playerId);
  }

  clearAll() {
    this.pendingSkillCasts.clear();
    this.pendingTeleportScrollCasts.clear();
  }

  update(now: number, context: SkillCastSystemContext) {
    for (const [playerId, cast] of this.pendingSkillCasts.entries()) {
      const player = context.getPlayer(playerId);
      if (!player || player.dead) {
        this.pendingSkillCasts.delete(playerId);
        continue;
      }

      if (player.castEndsAt > now) {
        continue;
      }

      const handler = context.getSkillHandler(cast.skillId);
      const castContext = context.createSkillCastContext(playerId, player, now);
      const postCastLockMs = handler
        ? handler.performCast(castContext, cast.targetX ?? player.x, cast.targetY ?? player.y)
        : 0;

      this.pendingSkillCasts.delete(playerId);
      if (postCastLockMs > 0) {
        player.castingSkillId = cast.skillId;
        player.castStartedAt = now;
        player.castEndsAt = now + postCastLockMs;
        continue;
      }

      context.clearPlayerCastState(player);
    }

    for (const playerId of Array.from(this.pendingTeleportScrollCasts)) {
      const player = context.getPlayer(playerId);
      if (!player || player.dead) {
        this.pendingTeleportScrollCasts.delete(playerId);
        continue;
      }

      if (player.castEndsAt > now) {
        continue;
      }

      context.performTeleportScroll(playerId, player);
      context.clearPlayerCastState(player);
    }
  }
}
