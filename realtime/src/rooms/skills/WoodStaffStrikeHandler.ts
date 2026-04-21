import { getItemProgressionBonuses } from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillHandler, SkillCastContext } from "./SkillHandler.js";

export const WoodStaffStrikeHandler: SkillHandler = {
  skillId: "woodStaffStrike",
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
    ctx.performWoodStaffStrike(ctx.player, targetX, targetY);
    return 180;
  },
};
