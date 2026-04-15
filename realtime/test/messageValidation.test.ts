import assert from "assert";
import {
  normalizeCastSkillMessage,
  normalizeMoveMessage,
  normalizeSyncChestMessage,
  normalizeUseConsumableMessage,
  normalizeUseExitMessage,
} from "../src/rooms/runtime/messageValidation.js";

describe("message validation", () => {
  it("rejects structurally invalid move payloads before normalization", () => {
    assert.strictEqual(normalizeMoveMessage("up" as never), null);
    assert.strictEqual(normalizeMoveMessage({ x: 1 } as never), null);
  });

  it("rejects structurally invalid cast and consumable payloads before normalization", () => {
    assert.strictEqual(normalizeCastSkillMessage({ skillId: 123 } as never), null);
    assert.strictEqual(normalizeUseConsumableMessage({ slotIndex: "0" } as never), null);
  });

  it("rejects structurally invalid sync and exit payloads before normalization", () => {
    assert.strictEqual(normalizeSyncChestMessage({ chestId: "bag", slots: [1] } as never), null);
    assert.strictEqual(normalizeUseExitMessage({ exitId: 42 } as never), null);
  });
});
