import { getItemProgressionBonuses } from "@mmorpg/shared";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

const BASE_VOLLEY_BOLT_COUNT = 3;
const BASE_VOLLEY_SPREAD_DEG = 24;
const BASE_VOLLEY_DAMAGE_SCALE = 0.75;
const ECHO_VOLLEY_DAMAGE_SCALE = 0.5;

export const WoodStaffSpectralVolleyHandler: SkillHandler = {
  skillId: "woodStaffSpectralVolley",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffSpectralVolleyCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffSpectralVolleyCooldownEndsAt = value;
  },

  getCooldownMs() {
    return 3000;
  },

  getCastTimeMs() {
    return 0;
  },

  canPerform(ctx: SkillCastContext, targetX: number, targetY: number) {
    return Math.hypot(targetX - ctx.player.x, targetY - ctx.player.y) > 0.001;
  },

  performCast(ctx: SkillCastContext, targetX: number, targetY: number) {
    const bonuses = getItemProgressionBonuses(ctx.player.weaponItem, ctx.weaponProgression);
    const boltCount = BASE_VOLLEY_BOLT_COUNT + bonuses.woodStaffSpectralVolleyBonusBolts;
    const totalSpreadDeg = BASE_VOLLEY_SPREAD_DEG + bonuses.woodStaffSpectralVolleySpreadBonusDeg;
    const baseAngle = Math.atan2(targetY - ctx.player.y, targetX - ctx.player.x);

    const fireVolley = (damageScale: number) => {
      const halfSpreadRad = ((totalSpreadDeg * Math.PI) / 180) / 2;
      const stepRad = boltCount > 1 ? (halfSpreadRad * 2) / (boltCount - 1) : 0;

      for (let index = 0; index < boltCount; index += 1) {
        const angle = boltCount > 1
          ? baseAngle - halfSpreadRad + stepRad * index
          : baseAngle;
        ctx.spawnProjectile(
          ctx.sessionId,
          "woodStaffSpectralVolley",
          ctx.player.x,
          ctx.player.y + ctx.profile.fireballSpawnOffsetY,
          Math.cos(angle),
          Math.sin(angle),
          ctx.profile.fireballLifetime,
          damageScale,
          0.85,
          {
            piercesRemaining: bonuses.woodStaffSpectralVolleyPiercing ? 1 : 0,
          },
        );
      }
    };

    fireVolley(BASE_VOLLEY_DAMAGE_SCALE);
    if (bonuses.woodStaffSpectralVolleyRefundChance > 0 && Math.random() < bonuses.woodStaffSpectralVolleyRefundChance) {
      fireVolley(ECHO_VOLLEY_DAMAGE_SCALE);
    }

    return 180;
  },
};
