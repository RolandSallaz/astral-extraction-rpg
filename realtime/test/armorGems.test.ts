import assert from "assert";
import {
  FOCUS_GEM_ID,
  getArmorGemConfig,
  GUARD_GEM_ID,
  VITALITY_GEM_ID,
} from "../src/rooms/armorGems.js";

describe("armor gem helpers", () => {
  it("stacks armor gem effects across head and body sockets", () => {
    const config = getArmorGemConfig({
      headGemItem1: GUARD_GEM_ID,
      bodyGemItem1: GUARD_GEM_ID,
      bodyGemItem2: FOCUS_GEM_ID,
      bodyGemItem3: VITALITY_GEM_ID,
      headGemItem2: VITALITY_GEM_ID,
    });

    assert.ok(Math.abs(config.damageTakenMultiplier - 0.8464) < 0.00001);
    assert.ok(Math.abs(config.castTimeMultiplier - 0.9) < 0.00001);
    assert.ok(Math.abs(config.healingReceivedMultiplier - 1.5) < 0.00001);
  });
});
