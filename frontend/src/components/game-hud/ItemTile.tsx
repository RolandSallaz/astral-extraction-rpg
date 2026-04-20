'use client';

import { ItemIcon } from '@/components/ItemIcon';
import {
  EQUIPMENT_ITEMS,
  parseInventoryItem,
  type ConsumableItemId,
} from '@/lib/items/equipmentItems';
import { CONSUMABLE_COOLDOWN_MS } from '@/components/game-hud/cooldownConstants';
import {
  getItemTierStyle,
  getResolvedItemTint,
  type ItemTintOverrides,
} from '@/components/game-hud/itemSocketHelpers';

export function ItemTile({
  itemValue,
  faded = false,
  compact = false,
  cooldownEndsAt = 0,
  cooldownNow = 0,
  socketCount = 0,
  socketColors = [],
  itemTintOverrides = {},
}: {
  itemValue: string;
  faded?: boolean;
  compact?: boolean;
  cooldownEndsAt?: number;
  cooldownNow?: number;
  socketCount?: number;
  socketColors?: Array<string | null>;
  itemTintOverrides?: ItemTintOverrides;
}) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[parsed.itemId];
  const tintOverride = getResolvedItemTint(parsed.itemId, itemTintOverrides);
  const tierStyle = getItemTierStyle(parsed.itemId);
  const frameSizeClass = compact ? 'h-10 w-10' : 'h-12 w-12';
  const isConsumable = item.type === 'consumable' && parsed.itemId in CONSUMABLE_COOLDOWN_MS;
  const remainingMs =
    isConsumable ? Math.max(0, cooldownEndsAt - cooldownNow) : 0;
  const isCoolingDown = remainingMs > 0;
  const cooldownDuration =
    isConsumable ? (CONSUMABLE_COOLDOWN_MS[parsed.itemId as ConsumableItemId] ?? 0) : 0;
  const cooldownProgress =
    isConsumable && cooldownDuration > 0
      ? Math.max(
          0,
          Math.min(1, remainingMs / cooldownDuration),
        )
      : 0;

  return (
    <span className={`relative flex items-center justify-center overflow-hidden rounded-md ${frameSizeClass}`}>
      {tierStyle ? (
        <>
          <span
            className="absolute inset-0 rounded-md"
            style={{
              background: tierStyle.slotBackground,
              boxShadow: `inset 0 0 0 1px ${tierStyle.slotBorder}`,
            }}
          />
          <span
            className="absolute inset-[1px] rounded-[5px] border border-white/5"
            style={{ backgroundColor: 'rgba(10, 16, 10, 0.22)' }}
          />
        </>
      ) : null}
      <ItemIcon
        item={item}
        compact={compact}
        tintOverride={tintOverride}
        draggable={false}
        className={`relative z-[1] ${frameSizeClass} ${faded ? 'opacity-25' : ''}`}
      />
      {parsed.quantity > 1 ? (
        <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded-sm bg-[#102008]/88 px-1 text-[10px] font-bold leading-none text-[#f4ffe8]">
          {parsed.quantity}
        </span>
      ) : null}
      {socketCount > 0 ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 flex gap-0.5">
          {Array.from({ length: socketCount }, (_, index) => (
            <span
              key={index}
              className="h-2.5 w-2.5 rounded-full border border-[#102008]/90 shadow-[0_0_0_1px_rgba(236,255,218,0.12)]"
              style={{
                backgroundColor: socketColors[index] ?? 'rgba(7,12,5,0.82)',
              }}
            />
          ))}
        </span>
      ) : null}
      {isCoolingDown ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 rounded-md"
            style={{
              background: `conic-gradient(from -90deg, rgba(12,18,8,0.12) 0deg, rgba(12,18,8,0.12) ${
                360 - cooldownProgress * 360
              }deg, rgba(8,12,6,0.72) ${360 - cooldownProgress * 360}deg, rgba(8,12,6,0.72) 360deg)`,
            }}
          />
          <span className="pointer-events-none absolute inset-[3px] rounded-md bg-[rgba(10,14,8,0.26)]" />
          <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded-sm bg-[#102008]/88 px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
            {(remainingMs / 1000).toFixed(1)}
          </span>
        </>
      ) : null}
    </span>
  );
}
