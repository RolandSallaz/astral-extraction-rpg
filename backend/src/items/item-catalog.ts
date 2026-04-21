import {
  ITEM_DEFINITIONS,
  ITEM_IDS,
  type ItemId,
  type SharedItemDefinition,
} from '@mmorpg/shared/items/catalog';

export type ItemCatalogEntry = SharedItemDefinition;

export const ITEM_CATALOG: Partial<Record<ItemId, ItemCatalogEntry>> = Object.fromEntries(
  ITEM_IDS.map((itemId) => [itemId, ITEM_DEFINITIONS[itemId]]),
);
