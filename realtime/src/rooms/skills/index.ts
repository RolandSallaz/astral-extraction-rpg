import type { SkillHandler } from "./SkillHandler.js";
import { FireballHandler } from "./FireballHandler.js";
import { FireNovaHandler } from "./FireNovaHandler.js";
import { FireFieldHandler } from "./FireFieldHandler.js";
import { WoodStaffStrikeHandler } from "./WoodStaffStrikeHandler.js";

export type { SkillHandler, SkillCastContext } from "./SkillHandler.js";

const ALL_SKILL_HANDLERS: readonly SkillHandler[] = [
  WoodStaffStrikeHandler,
  FireballHandler,
  FireNovaHandler,
  FireFieldHandler,
];

export function createSkillHandlers(): Map<string, SkillHandler> {
  return new Map(ALL_SKILL_HANDLERS.map((handler) => [handler.skillId, handler]));
}
