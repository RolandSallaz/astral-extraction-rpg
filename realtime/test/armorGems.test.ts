import assert from "assert";
import { countArmorGems, getArmorGemConfig } from "../src/rooms/runtime/armorGems.js";

describe("armor gem helpers", () => {
  it("keeps armor gem effects disabled while clothing is removed", () => {
    assert.strictEqual(
      countArmorGems(
        {
          headGemItem1: "guard_gem",
          bodyGemItem1: "guard_gem",
          bodyGemItem2: "focus_gem",
          bodyGemItem3: "vitality_gem",
          headGemItem2: "vitality_gem",
        },
        "guard_gem",
      ),
      0,
    );

    const config = getArmorGemConfig({
      headGemItem1: "guard_gem",
      bodyGemItem1: "guard_gem",
      bodyGemItem2: "focus_gem",
      bodyGemItem3: "vitality_gem",
      headGemItem2: "vitality_gem",
    });

    assert.strictEqual(config.damageTakenMultiplier, 1);
    assert.strictEqual(config.castTimeMultiplier, 1);
    assert.strictEqual(config.healingReceivedMultiplier, 1);
  });
});
