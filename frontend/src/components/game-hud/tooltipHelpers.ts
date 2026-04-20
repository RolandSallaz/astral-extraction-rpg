import {
  DEFAULT_ITEM_BALANCE_CONFIG,
  getResolvedItemTooltipStats,
  getResolvedItemValue,
  type ItemBalanceConfig,
} from '@/lib/itemBalance';
import {
  EQUIPMENT_ITEMS,
  getInventoryItemId,
  parseInventoryItem,
} from '@/lib/items/equipmentItems';
import type { SkillId } from '@/components/game-hud/types';

export function getSafeTooltipPosition(
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
) {
  if (typeof window === 'undefined') {
    return {
      left: pointerX + 16,
      top: pointerY + 16,
    };
  }

  const margin = 20;
  const horizontalOffset = 16;
  const verticalOffset = 16;
  const preferredRightLeft = pointerX + horizontalOffset;
  const preferredBottomTop = pointerY + verticalOffset;
  const preferredLeftLeft = pointerX - width - horizontalOffset;
  const preferredTopTop = pointerY - height - verticalOffset;
  const left =
    preferredRightLeft + width <= window.innerWidth - margin
      ? preferredRightLeft
      : preferredLeftLeft >= margin
        ? preferredLeftLeft
        : Math.min(
            Math.max(margin, preferredRightLeft),
            Math.max(margin, window.innerWidth - width - margin),
          );
  const top =
    preferredBottomTop + height <= window.innerHeight - margin
      ? preferredBottomTop
      : preferredTopTop >= margin
        ? preferredTopTop
        : Math.min(
            Math.max(margin, preferredBottomTop),
            Math.max(margin, window.innerHeight - height - margin),
          );

  return {
    left,
    top,
  };
}

export function formatGoldValue(value: number) {
  return `${Math.max(0, Math.floor(value))}g`;
}

export function getDisplayItemName(itemValue: string) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return 'Unknown Item';
  }

  return parsed.raidUnidentified ? 'Unidentified Potion' : EQUIPMENT_ITEMS[parsed.itemId].name;
}

export function getDisplayItemTooltipLines(
  itemValue: string,
  itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return ['Unknown item'];
  }

  if (parsed.raidUnidentified) {
    return [
      'Raid potion',
      'Effect is unknown until identified',
      'Identify by finding another of the same type or by extracting',
    ];
  }

  const item = EQUIPMENT_ITEMS[parsed.itemId as keyof typeof EQUIPMENT_ITEMS];
  if (!item) {
    return ['Unknown item'];
  }

  return [
    ...getResolvedItemTooltipStats(item.id, itemBalanceConfig),
    `Value: ${formatGoldValue(getResolvedItemValue(item.id, itemBalanceConfig))}`,
  ];
}

export function getItemTooltipLines(
  itemId: string,
  itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
) {
  return getDisplayItemTooltipLines(itemId, itemBalanceConfig);
}

export function getDisplayItemCategory(itemValue: string) {
  const itemId = getInventoryItemId(itemValue);
  return itemId ? (EQUIPMENT_ITEMS[itemId].slot ?? EQUIPMENT_ITEMS[itemId].type) : 'item';
}

export function getSkillDisplayName(skillId: SkillId) {
  switch (skillId) {
    case 'woodStaffStrike':
      return 'Wood Staff Strike';
    case 'woodStaffDash':
      return 'Wood Staff Dash';
    case 'fireball':
      return 'Fireball';
    case 'fireNova':
      return 'Fire Nova';
    case 'fireField':
      return 'Fire Field';
  }
}

export function getItemContextPrimaryActionLabel(itemValue: string) {
  const itemId = getInventoryItemId(itemValue);
  if (!itemId) {
    return 'Equip';
  }

  const itemType = EQUIPMENT_ITEMS[itemId].type;
  if (itemType === 'consumable') {
    return 'Use';
  }

  if (itemType === 'equipment' || itemType === 'gem') {
    return 'Equip';
  }

  return 'Store';
}
