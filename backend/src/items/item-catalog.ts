import {
  ITEM_DEFINITIONS,
  type ItemId,
  type SharedItemDefinition,
} from '@mmorpg/shared/items/catalog';

export type ItemCatalogEntry = {
  code: string;
  name: string;
  slot: string | null;
  iconPath: string | null;
  value: number;
  stackable: boolean;
  maxStack: number;
  data: Record<string, unknown>;
};

function toCatalogEntry(definition: SharedItemDefinition): ItemCatalogEntry {
  return {
    code: definition.id,
    name: definition.name,
    slot: definition.slot ?? null,
    iconPath: null,
    value: definition.value ?? 0,
    stackable: definition.stackable ?? false,
    maxStack: definition.maxStack ?? 1,
    data: {
      type: definition.type,
      tier: definition.tier ?? null,
      socketType: definition.socketType ?? null,
      gemType: definition.gemType ?? null,
      socketableInto: definition.socketableInto ?? [],
      socketCount: definition.socketCount ?? 0,
      tooltipStats: definition.tooltipStats ?? [],
      fireResistancePercent: definition.fireResistancePercent ?? 0,
    },
  };
}

export const ITEM_CATALOG: Record<ItemId, ItemCatalogEntry> = Object.fromEntries(
  (Object.values(ITEM_DEFINITIONS) as SharedItemDefinition[]).map((definition) => [
    definition.id,
    toCatalogEntry(definition),
  ]),
) as Record<ItemId, ItemCatalogEntry>;
