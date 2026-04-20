import { isSameEquipmentItemFamily } from '@mmorpg/shared';
import {
  EQUIPMENT_ITEMS,
  getInventoryItemId,
  type BaseEquipmentSlot,
  type EquipmentSlot,
  type GemItemId,
} from '@/lib/items/equipmentItems';
import type { EquipmentState, InventoryState } from '@/lib/playerProfile';
import {
  getEquipmentItemDefinition,
  getEquipmentSocketSlotIds,
} from '@/components/game-hud/itemSocketHelpers';

const BASE_EQUIPMENT_SLOT_IDS: BaseEquipmentSlot[] = [
  'head',
  'amulet',
  'body',
  'weapon',
  'offhand',
  'ring-1',
  'ring-2',
];

export function moveInventoryItem(
  inventory: InventoryState,
  fromIndex: number,
  toIndex: number,
): InventoryState {
  const nextInventory = [...inventory];
  const targetItem = nextInventory[toIndex];
  nextInventory[toIndex] = nextInventory[fromIndex];
  nextInventory[fromIndex] = targetItem;
  return nextInventory;
}

export function moveGridItem(
  slots: InventoryState,
  fromIndex: number,
  toIndex: number,
): InventoryState {
  const nextSlots = [...slots];
  const targetItem = nextSlots[toIndex];
  nextSlots[toIndex] = nextSlots[fromIndex];
  nextSlots[fromIndex] = targetItem;
  return nextSlots;
}

export function findFirstEmptySlot(slots: InventoryState) {
  return slots.findIndex((itemId) => itemId === null);
}

export function findFirstEmptySocketSlot(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  return getEquipmentSocketSlotIds(slot, equipment).find((slotId) => !equipment[slotId]) ?? null;
}

export function canSocketGemIntoSlot(
  itemId: GemItemId,
  slot: BaseEquipmentSlot,
  equipment: EquipmentState,
) {
  const equippedItem = getEquipmentItemDefinition(slot, equipment);
  if (!equippedItem) {
    return false;
  }

  const gemItem = EQUIPMENT_ITEMS[itemId];
  if (!gemItem || gemItem.type !== 'gem') {
    return false;
  }

  if (!equippedItem.socketCount || equippedItem.socketCount <= 0) {
    return false;
  }

  if (gemItem.gemType && equippedItem.socketType && gemItem.gemType !== equippedItem.socketType) {
    return false;
  }

  if (
    !gemItem.socketableInto?.some((supportedItemId) =>
      isSameEquipmentItemFamily(equippedItem.id, supportedItemId),
    )
  ) {
    return false;
  }

  return true;
}

export function findFirstCompatibleEquipmentSlotForGem(
  itemId: GemItemId,
  equipment: EquipmentState,
) {
  const compatibleSlots = BASE_EQUIPMENT_SLOT_IDS.filter((slot) =>
    canSocketGemIntoSlot(itemId, slot, equipment),
  );

  if (compatibleSlots.length === 0) {
    return null;
  }

  return compatibleSlots.find((slot) => findFirstEmptySocketSlot(slot, equipment)) ?? compatibleSlots[0];
}

export function canSwapIntoEquipment(itemValue: string | null, slot: EquipmentSlot) {
  const itemId = getInventoryItemId(itemValue);
  if (!itemId) {
    return true;
  }

  const item = EQUIPMENT_ITEMS[itemId];
  return item.type === 'equipment' && item.slot === slot;
}
