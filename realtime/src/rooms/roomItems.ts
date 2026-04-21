import {
  EMPTY_ITEM_SLOT,
  HEALING_POTION_ID,
  POISON_POTION_ID,
  SLOW_POTION_ID,
  ANTIDOTE_ID,
  SPEED_POTION_ID,
  FIRE_RESISTANCE_POTION_ID,
  TELEPORT_SCROLL_ID,
  isItemId,
  normalizeInventoryEntry,
  parseInventoryItem,
  serializeInventoryItem,
  type ItemId,
  type ParsedInventoryItem,
} from "@mmorpg/shared";

export {
  EMPTY_ITEM_SLOT,
  HEALING_POTION_ID,
  POISON_POTION_ID,
  SLOW_POTION_ID,
  ANTIDOTE_ID,
  SPEED_POTION_ID,
  FIRE_RESISTANCE_POTION_ID,
  TELEPORT_SCROLL_ID,
};

export function parseRoomInventoryEntry(value: string | null | undefined): ParsedInventoryItem | null {
  return parseInventoryItem(value);
}

export function serializeRoomInventoryEntry(
  code: string,
  quantity = 1,
  socketedGemIds?: Array<string | null> | null,
) {
  if (!isItemId(code)) {
    return EMPTY_ITEM_SLOT;
  }

  return serializeInventoryItem(code as ItemId, quantity, socketedGemIds);
}

export function normalizeRoomInventoryEntry(value: string | null | undefined) {
  return normalizeInventoryEntry(value);
}

export function normalizeRoomInventorySlots(
  values: Array<string | null | undefined>,
  expectedSize: number,
) {
  const nextValues = values
    .slice(0, expectedSize)
    .map((value) => normalizeRoomInventoryEntry(value));

  while (nextValues.length < expectedSize) {
    nextValues.push(EMPTY_ITEM_SLOT);
  }

  return nextValues;
}

export function consumeRoomInventoryEntry(value: string | null | undefined) {
  const parsed = parseRoomInventoryEntry(value);
  if (!parsed) {
    return null;
  }

  return {
    parsed,
    nextValue:
      parsed.quantity > 1
        ? serializeRoomInventoryEntry(parsed.itemId, parsed.quantity - 1, parsed.socketedGemIds)
        : EMPTY_ITEM_SLOT,
  };
}
