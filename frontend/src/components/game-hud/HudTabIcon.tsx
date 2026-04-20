'use client';

export type HudTabPanel = 'inventory' | 'equipment';

export function HudTabIcon({ panel }: { panel: HudTabPanel }) {
  const src = panel === 'inventory' ? '/ui/panels/inventory-8bit.png' : '/ui/panels/equipment-8bit.png';
  const alt = panel === 'inventory' ? 'Inventory' : 'Character';

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="pixelated h-8 w-8 object-contain"
    />
  );
}
