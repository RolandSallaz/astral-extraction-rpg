import {
  EQUIPMENT_ITEMS,
  GEMS_ENABLED,
  type ItemProgressionState,
  type BaseEquipmentSlot,
  type EquipmentItemId,
  getBaseEquipmentSlot,
  getEquipmentGemSlotIds,
  getItemIconTint,
  parseInventoryItem,
  serializeInventoryItem,
} from '@/lib/items/equipmentItems';
import type { EquipmentState } from '@/lib/playerProfile';
import type { DragSource } from '@/components/game-hud/types';

export type ItemTintOverrides = Partial<Record<string, string | null>>;
export type ItemTierStyle = {
  slotBackground: string;
  slotBorder: string;
  textColor: string;
  badgeBackground: string;
};

export const MAX_ITEM_SOCKET_COUNT = 3;

export function getEquipmentItemDefinition(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  const itemId = equipment[slot];
  if (!itemId) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  return item?.type === 'equipment' ? item : null;
}

export function getEquipmentSocketSlotIds(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  if (!GEMS_ENABLED) {
    return [];
  }

  const item = getEquipmentItemDefinition(slot, equipment);
  return item ? getEquipmentGemSlotIds(slot, item.socketCount ?? 0) : [];
}

export function getEquipmentSocketGemIds(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  return getEquipmentSocketSlotIds(slot, equipment).map((slotId) => equipment[slotId] ?? null);
}

export function getResolvedItemTint(
  itemId: string | null | undefined,
  itemTintOverrides: ItemTintOverrides,
) {
  if (!itemId) {
    return null;
  }

  if (itemId in itemTintOverrides) {
    return itemTintOverrides[itemId] ?? null;
  }

  return getItemIconTint(itemId);
}

export function getSocketColors(gemIds: Array<string | null>, itemTintOverrides: ItemTintOverrides) {
  return gemIds.map((gemId) => getResolvedItemTint(gemId, itemTintOverrides));
}

export function getItemSocketGemIds(
  itemValue: string,
  equipment: EquipmentState,
  source?: DragSource,
) {
  if (!GEMS_ENABLED) {
    return [];
  }

  if (source?.type === 'equipment') {
    const baseSlot = getBaseEquipmentSlot(source.slot);
    return baseSlot ? getEquipmentSocketGemIds(baseSlot, equipment) : [];
  }

  const parsed = parseInventoryItem(itemValue);
  return parsed?.socketedGemIds ?? [];
}

export function getItemSocketColors(
  itemValue: string,
  equipment: EquipmentState,
  itemTintOverrides: ItemTintOverrides,
  source?: DragSource,
) {
  return getSocketColors(getItemSocketGemIds(itemValue, equipment, source), itemTintOverrides);
}

export function serializeSocketedEquipmentItem(
  itemId: string,
  gemIds: Array<string | null>,
  itemProgression?: ItemProgressionState | null,
) {
  return serializeInventoryItem(itemId as EquipmentItemId, 1, GEMS_ENABLED ? gemIds : [], {
    itemProgression,
  });
}

export function getItemTierStyle(_itemId: string | null | undefined): ItemTierStyle | null {
  return null;
}
