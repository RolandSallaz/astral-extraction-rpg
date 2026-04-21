'use client';

import {
  getItemSocketColors,
  getItemSocketGemIds,
  getItemTierStyle,
  type ItemTintOverrides,
} from '@/components/game-hud/itemSocketHelpers';
import {
  getDisplayItemCategory,
  getDisplayItemName,
  getDisplayItemTooltipLines,
  getSkillDisplayName,
  getSkillTooltipLines,
  getSafeTooltipPosition,
} from '@/components/game-hud/tooltipHelpers';
import type {
  HoveredItemState,
  HoveredSkillState,
  InspectItemState,
  ItemContextMenuState,
} from '@/components/game-hud/types';
import {
  EQUIPMENT_ITEMS,
  getInventoryItemId,
  parseInventoryItem,
  serializeInventoryItem,
} from '@/lib/items/equipmentItems';
import type { EquipmentItemProgressionState, EquipmentState } from '@/lib/playerProfile';
import type { ItemBalanceConfig } from '@/lib/itemBalance';

type ContainerLike = { slots: unknown } | null;

export function useHudViews({
  equipment,
  equipmentItemProgression,
  container,
  hoveredItem,
  hoveredSkill,
  inspectItem,
  itemContextMenu,
  itemBalanceConfig,
  itemTintOverrides,
}: {
  equipment: EquipmentState;
  equipmentItemProgression: EquipmentItemProgressionState;
  container: ContainerLike;
  hoveredItem: HoveredItemState | null;
  hoveredSkill: HoveredSkillState | null;
  inspectItem: InspectItemState | null;
  itemContextMenu: ItemContextMenuState | null;
  itemBalanceConfig: ItemBalanceConfig;
  itemTintOverrides: ItemTintOverrides;
}) {
  const visibleInspectItem =
    inspectItem && (inspectItem.source.type !== 'container' || container)
      ? inspectItem
      : null;

  const visibleItemContextMenu =
    itemContextMenu && (itemContextMenu.source.type !== 'container' || container)
      ? itemContextMenu
      : null;

  const visibleHoveredItem =
    hoveredItem &&
    (hoveredItem.scope !== 'container' || container) &&
    (hoveredItem.scope !== 'inspect' || visibleInspectItem)
      ? hoveredItem
      : null;

  const visibleHoveredItemView = visibleHoveredItem
    ? {
        name: getDisplayItemName(visibleHoveredItem.itemId),
        label: getDisplayItemCategory(visibleHoveredItem.itemId),
        lines: getDisplayItemTooltipLines(
          visibleHoveredItem.itemId,
          itemBalanceConfig,
          visibleHoveredItem.scope === 'equipment' && getInventoryItemId(visibleHoveredItem.itemId) === equipment.weapon
            ? equipmentItemProgression.weapon
            : null,
        ),
        textColor: getItemTierStyle(getInventoryItemId(visibleHoveredItem.itemId))?.textColor ?? '#f6ffea',
      }
    : null;

  const hoveredItemTooltipLineCount = visibleHoveredItemView?.lines.length ?? 0;

  const hoveredItemPosition = visibleHoveredItem
    ? getSafeTooltipPosition(
        visibleHoveredItem.pointerX,
        visibleHoveredItem.pointerY,
        252,
        Math.min(320, 92 + hoveredItemTooltipLineCount * 22),
      )
    : null;

  const hoveredSkillView = hoveredSkill
    ? {
        name: getSkillDisplayName(hoveredSkill.skillId),
        lines: getSkillTooltipLines(
          hoveredSkill.skillId,
          equipment.weapon,
          equipmentItemProgression.weapon,
        ),
      }
    : null;

  const hoveredSkillPosition = hoveredSkill
    ? getSafeTooltipPosition(hoveredSkill.pointerX, hoveredSkill.pointerY, 252, 164)
    : null;

  const itemContextMenuPosition = visibleItemContextMenu
    ? getSafeTooltipPosition(visibleItemContextMenu.pointerX, visibleItemContextMenu.pointerY, 216, 196)
    : null;

  const visibleInspectItemView = visibleInspectItem
    ? (() => {
        const parsed = parseInventoryItem(visibleInspectItem.itemValue);
        if (!parsed) {
          return null;
        }

        const item = EQUIPMENT_ITEMS[parsed.itemId];
        const socketCount = item.socketCount ?? 0;
        const socketGemIds = getItemSocketGemIds(visibleInspectItem.itemValue, equipment, visibleInspectItem.source);
        const socketColors = getItemSocketColors(
          visibleInspectItem.itemValue,
          equipment,
          itemTintOverrides,
          visibleInspectItem.source,
        );

        return {
          name: getDisplayItemName(visibleInspectItem.itemValue),
          label: item.slot ?? item.type,
          lines: getDisplayItemTooltipLines(
            visibleInspectItem.itemValue,
            itemBalanceConfig,
            visibleInspectItem.source.type === 'equipment' && visibleInspectItem.source.slot === 'weapon'
              ? equipmentItemProgression.weapon
              : parsed.itemProgression,
          ),
          textColor: getItemTierStyle(item.id)?.textColor ?? '#f6ffea',
          socketColors,
          socketCount,
          socketGemValues: Array.from({ length: socketCount }, (_, index) => {
            const socketGemId = socketGemIds[index] ?? null;
            return socketGemId ? serializeInventoryItem(socketGemId) : null;
          }),
        };
      })()
    : null;

  return {
    visibleInspectItem,
    visibleItemContextMenu,
    visibleHoveredItem,
    visibleHoveredItemView,
    hoveredItemPosition,
    hoveredSkillView,
    hoveredSkillPosition,
    itemContextMenuPosition,
    visibleInspectItemView,
  };
}
