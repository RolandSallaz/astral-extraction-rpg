import type { MobState } from "../schema/MobState.js";
import { resetMobToSpawn } from "./mobAi.js";

const TRAINING_DUMMY_RESET_MS = 3000;

export function isTrainingDummy(mob: Pick<MobState, "kind" | "texture">) {
  return mob.kind === "dummy" || mob.texture === "dummy";
}

export function recordMobDamage(mob: MobState, damage: number, now = Date.now()) {
  if (damage <= 0) {
    return;
  }

  mob.lastDamagedAt = now;
  mob.totalDamageTaken += damage;
  mob.totalHitsTaken += 1;
}

export function resetTrainingDummy(mob: MobState) {
  resetMobToSpawn(mob);
  mob.poisonTicksRemaining = 0;
  mob.poisonEndsAt = 0;
  mob.slowEndsAt = 0;
  mob.lastDamagedAt = 0;
  mob.totalDamageTaken = 0;
  mob.totalHitsTaken = 0;
}

export function shouldResetTrainingDummy(mob: MobState, now = Date.now()) {
  return isTrainingDummy(mob) && mob.lastDamagedAt > 0 && now - mob.lastDamagedAt >= TRAINING_DUMMY_RESET_MS;
}
