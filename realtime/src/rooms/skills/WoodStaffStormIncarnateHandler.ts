import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

export const WoodStaffStormIncarnateHandler: SkillHandler = {
  skillId: "woodStaffStormIncarnate",
  needsTarget: false,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffStormIncarnateCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffStormIncarnateCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return ctx.profile.woodStaffStormIncarnateCooldownMs;
  },

  getCastTimeMs() {
    return 0;
  },

  performCast(ctx: SkillCastContext, _targetX: number, _targetY: number) {
    ctx.performWoodStaffStormIncarnate(ctx.player);
    return 300;
  },
};
