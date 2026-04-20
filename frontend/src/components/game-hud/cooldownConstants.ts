import type { ConsumableItemId } from '@/lib/items/equipmentItems';

export const CONSUMABLE_COOLDOWN_MS: Partial<Record<ConsumableItemId, number>> = {
  healing_potion: 20000,
};
