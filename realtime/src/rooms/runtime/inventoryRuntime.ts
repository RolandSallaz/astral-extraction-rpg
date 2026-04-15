import { type ChestState } from "../schema/ChestState.js";
import {
  HEALING_POTION_ID,
  TELEPORT_SCROLL_ID,
  consumeRoomInventoryEntry,
  normalizeRoomInventorySlots,
} from "../roomItems.js";

type RoomStringSlotTarget = {
  clear(): void;
  push(value: string): unknown;
};

export function replaceRoomStringSlots(
  target: RoomStringSlotTarget,
  values: readonly string[],
) {
  target.clear();
  values.forEach((value) => {
    target.push(value);
  });
}

export function syncRoomChestSlots(
  chest: Pick<ChestState, "columns" | "rows" | "slots">,
  slots: Array<string | null | undefined>,
) {
  const nextSlots = normalizeRoomInventorySlots(slots, chest.columns * chest.rows);
  replaceRoomStringSlots(chest.slots, nextSlots);
  return nextSlots;
}

export function consumeSupportedRoomConsumable(
  value: string | null | undefined,
) {
  const consumedEntry = consumeRoomInventoryEntry(value);
  const parsed = consumedEntry?.parsed;
  if (!consumedEntry || !parsed) {
    return null;
  }

  if (parsed.code !== HEALING_POTION_ID && parsed.code !== TELEPORT_SCROLL_ID) {
    return null;
  }

  return {
    parsed,
    nextValue: consumedEntry.nextValue,
  };
}
