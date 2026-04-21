import { getItemProgressionBonuses } from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

export const WoodStaffChainStrikeHandler: SkillHandler = {
  skillId: "woodStaffChainStrike",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffStrikeCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffStrikeCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    const bonuses = getItemProgressionBonuses(ctx.player.weaponItem, ctx.weaponProgression);
    return Math.max(0, ctx.profile.meleeStrikeCooldownMs + bonuses.meleeStrikeCooldownDeltaMs);
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
