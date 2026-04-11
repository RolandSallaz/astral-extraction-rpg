import {
  ITEM_DEFINITIONS,
  type ItemId,
  type SharedItemDefinition,
} from '@mmorpg/shared/items/catalog';

export type ItemCatalogEntry = SharedItemDefinition;

export const ITEM_CATALOG: Record<ItemId, ItemCatalogEntry> = ITEM_DEFINITIONS;
