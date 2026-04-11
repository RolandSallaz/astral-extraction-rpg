import { ITEM_DEFINITIONS, ITEM_IDS } from "../items/catalog";

export type ItemBalanceEntry = {
  value: number;
  tooltipStats: string[];
  fireResistancePercent: number;
};

export type ItemBalanceConfig = Record<string, ItemBalanceEntry>;

export const DEFAULT_ITEM_BALANCE_CONFIG: ItemBalanceConfig = Object.fromEntries(
  ITEM_IDS.map((itemId) => {
    const definition = ITEM_DEFINITIONS[itemId];
    return [
      itemId,
      {
        value: definition.value,
        tooltipStats: [...definition.tooltipStats],
        fireResistancePercent: definition.fireResistancePercent ?? 0,
      },
    ];
  }),
);

export function cloneItemBalanceConfig(config: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG): ItemBalanceConfig {
  return Object.fromEntries(
    Object.entries(config).map(([itemId, entry]) => [
      itemId,
      {
        value: entry.value,
        tooltipStats: [...entry.tooltipStats],
        fireResistancePercent: entry.fireResistancePercent,
      },
    ]),
  );
}

export function createDefaultItemFireResistanceMap() {
  return new Map(
    Object.entries(DEFAULT_ITEM_BALANCE_CONFIG).map(([itemId, entry]) => [itemId, entry.fireResistancePercent]),
  );
}

export function applyItemBalanceUpdate(
  target: Map<string, number>,
  payload?: ItemBalanceConfig | null,
) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  for (const [itemId, entry] of Object.entries(payload)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const fireResistancePercent = entry.fireResistancePercent;
    if (typeof fireResistancePercent !== "number" || !Number.isFinite(fireResistancePercent)) {
      continue;
    }

    target.set(itemId, Math.max(0, Math.min(100, Math.floor(fireResistancePercent))));
  }
}

export function getFireDamageTakenMultiplier(
  itemId: string | undefined,
  fireResistanceByItem: Map<string, number>,
) {
  if (!itemId) {
    return 1;
  }

  const fireResistancePercent = fireResistanceByItem.get(itemId) ?? 0;
  return 1 - Math.max(0, Math.min(100, fireResistancePercent)) / 100;
}
