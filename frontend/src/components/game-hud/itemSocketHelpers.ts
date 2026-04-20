import {
  EQUIPMENT_ITEMS,
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

export const MAX_ITEM_SOCKET_COUNT = 3;

export const ITEM_TIER_STYLES = {
  1: {
    slotBackground: 'linear-gradient(180deg,rgba(92,92,92,0.34),rgba(38,38,38,0.52))',
    slotBorder: '#9d9d9d',
    textColor: '#d2d2d2',
    badgeBackground: 'rgba(78,78,78,0.9)',
  },
  2: {
    slotBackground: 'linear-gradient(180deg,rgba(67,121,210,0.3),rgba(19,44,94,0.56))',
    slotBorder: '#6da8ff',
    textColor: '#8cc4ff',
    badgeBackground: 'rgba(32,72,148,0.9)',
  },
  3: {
    slotBackground: 'linear-gradient(180deg,rgba(130,76,184,0.32),rgba(55,23,91,0.58))',
    slotBorder: '#bc8cff',
    textColor: '#d3a8ff',
    badgeBackground: 'rgba(88,40,132,0.9)',
  },
} as const;

export function getEquipmentItemDefinition(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  const itemId = equipment[slot];
  if (!itemId) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  return item?.type === 'equipment' ? item : null;
}

export function getEquipmentSocketSlotIds(slot: BaseEquipmentSlot, equipment: EquipmentState) {
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

export function serializeSocketedEquipmentItem(itemId: string, gemIds: Array<string | null>) {
  return serializeInventoryItem(itemId as EquipmentItemId, 1, gemIds);
}

export function getItemTierStyle(itemId: string | null | undefined) {
  if (!itemId) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  if (!item || item.type !== 'equipment' || !item.tier) {
    return null;
  }

  return ITEM_TIER_STYLES[item.tier];
}
