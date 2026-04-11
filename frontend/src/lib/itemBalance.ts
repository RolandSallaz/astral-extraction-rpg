import {
  cloneItemBalanceConfig as cloneSharedItemBalanceConfig,
  DEFAULT_ITEM_BALANCE_CONFIG as SHARED_DEFAULT_ITEM_BALANCE_CONFIG,
  type ItemBalanceEntry as SharedItemBalanceEntry,
} from "@mmorpg/shared";
import type { ItemId } from "@/lib/items/equipmentItems";

export type ItemBalanceEntry = SharedItemBalanceEntry;
export type ItemBalanceConfig = Record<ItemId, ItemBalanceEntry>;

export const DEFAULT_ITEM_BALANCE_CONFIG =
  SHARED_DEFAULT_ITEM_BALANCE_CONFIG as ItemBalanceConfig;

export function cloneItemBalanceConfig(
  config: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
): ItemBalanceConfig {
  return cloneSharedItemBalanceConfig(config) as ItemBalanceConfig;
}

export function getItemBalanceEntry(
  itemId: ItemId,
  config: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
): ItemBalanceEntry {
  return config[itemId] ?? DEFAULT_ITEM_BALANCE_CONFIG[itemId];
}

export function getResolvedItemValue(
  itemId: ItemId,
  config: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
  quantity = 1,
) {
  return getItemBalanceEntry(itemId, config).value * Math.max(1, quantity);
}

export function getResolvedItemTooltipStats(
  itemId: ItemId,
  config: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
) {
  const tooltipStats = getItemBalanceEntry(itemId, config).tooltipStats;
  return tooltipStats.length > 0 ? tooltipStats : ["No stat bonuses"];
}
