import { WOOD_STAFF_CHAIN_STRIKE_COOLDOWN_MS } from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

export const WoodStaffChainStrikeHandler: SkillHandler = {
  skillId: "woodStaffChainStrike",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffChainStrikeCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffChainStrikeCooldownEndsAt = value;
  },

  getCooldownMs() {
    return WOOD_STAFF_CHAIN_STRIKE_COOLDOWN_MS;
  },

  getCastTimeMs() {
    return 0;
  },

  performCast(ctx: SkillCastContext, targetX: number, targetY: number) {
    ctx.clearPlayerMovement(ctx.sessionId);
    ctx.performWoodStaffChainStrike(ctx.player, targetX, targetY);
    return 180;
  },
};
