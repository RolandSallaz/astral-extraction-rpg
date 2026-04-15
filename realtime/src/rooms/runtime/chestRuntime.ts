import { type MapSchema } from "@colyseus/schema";
import { serializeInventoryItem, type ItemId } from "@mmorpg/shared";
import { ChestState } from "../schema/ChestState.js";
import type { MobState } from "../schema/MobState.js";
import { syncRoomChestSlots } from "./inventoryRuntime.js";
import { parseRoomInventoryEntry } from "../roomItems.js";

const ESSENCE_DROP_CHANCE = 0.1;
const RANDOM_ESSENCE_ITEM_IDS = [
  "fire_essence",
  "lightning_essence",
  "ice_essence",
  "darkness_essence",
  "void_essence",
] as const satisfies readonly ItemId[];

export function handleSyncChest(
  roomChests: MapSchema<ChestState>,
  message: { chestId?: string; slots?: string[] },
): void {
  if (typeof message?.chestId !== "string" || !Array.isArray(message.slots)) {
    return;
  }
  const chest = roomChests.get(message.chestId);
  if (!chest) {
    return;
  }
  syncRoomChestSlots(chest, message.slots);
  removeChestIfEmptyLootBag(roomChests, chest.id);
}

export function removeChestIfEmptyLootBag(
  roomChests: MapSchema<ChestState>,
  chestId: string,
): void {
  const chest = roomChests.get(chestId);
  if (!chest || chest.subtitle !== "Dropped Loot") {
    return;
  }
  const hasItems = Array.from(chest.slots).some((slot) => parseRoomInventoryEntry(slot) !== null);
  if (!hasItems) {
    roomChests.delete(chestId);
  }
}

export function tryCreateMobLootChest(
  roomChests: MapSchema<ChestState>,
  mob: MobState,
  tileSize: number,
): void {
  if (Math.random() > ESSENCE_DROP_CHANCE) {
    return;
  }
  const itemId = RANDOM_ESSENCE_ITEM_IDS[Math.floor(Math.random() * RANDOM_ESSENCE_ITEM_IDS.length)];
  if (!itemId) {
    return;
  }
  const chest = new ChestState();
  chest.id = `mob-loot-${mob.id}-${Date.now()}`;
  chest.title = "Essence";
  chest.subtitle = "Dropped Loot";
  chest.columns = 1;
  chest.rows = 1;
  chest.x = Math.max(0, Math.floor(mob.x / tileSize));
  chest.y = Math.max(0, Math.floor(mob.y / tileSize));
  chest.slots.push(serializeInventoryItem(itemId, 1));
  roomChests.set(chest.id, chest);
}
