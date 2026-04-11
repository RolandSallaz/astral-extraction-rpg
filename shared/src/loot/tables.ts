export type LootTableDrop = {
  itemCode: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
};

export type LootTableDefinition = {
  id: string;
  drops: LootTableDrop[];
};

export const LOOT_TABLE_DEFINITIONS: Record<string, LootTableDefinition> = {
  mob_rat: {
    id: "mob_rat",
    drops: [],
  },
  mob_bat: {
    id: "mob_bat",
    drops: [],
  },
};

export function getLootTableDefinition(id: string | null | undefined): LootTableDefinition | null {
  if (!id) {
    return null;
  }

  return LOOT_TABLE_DEFINITIONS[id] ?? null;
}
