'use client';

import type { SkillId } from '@/components/game-hud/types';

export const SKILL_ICONS: Partial<Record<SkillId, { src: string; alt: string }>> = {
  woodStaffStrike: {
    src: '/items/equipment/wood_staff.png',
    alt: 'Wood Staff Strike',
  },
  woodStaffDash: {
    src: '/items/equipment/wood_staff.png',
    alt: 'Wood Staff Dash',
  },
  fireball: {
    src: '/ui/skills/fireball-skill-16x16.png',
    alt: 'Fireball',
  },
  fireNova: {
    src: '/ui/skills/fire-nova-skill-16x16.png',
    alt: 'Fire Nova',
  },
  fireField: {
    src: '/ui/skills/fire-field-skill-16x16.png',
    alt: 'Fire Field',
  },
};

export const SKILL_COOLDOWN_MS: Record<SkillId, number> = {
  woodStaffStrike: 450,
  woodStaffDash: 2000,
  fireball: 1000,
  fireNova: 10000,
  fireField: 12000,
};

export const SKILL_TOOLTIP_STATS: Record<SkillId, string[]> = {
  woodStaffStrike: ['Close-range strike', 'Cooldown: 0.45s'],
  woodStaffDash: ['Dash like a skeleton', 'Physical hit on impact', 'Cooldown: 2s'],
  fireball: ['20 damage', 'Applies burning', 'Cooldown: 1s'],
  fireNova: ['12 projectiles around you', 'Applies burning', 'Cooldown: 10s'],
  fireField: ['3x3 burning ground', '10s duration', 'Cooldown: 12s'],
};

export const SKILL_BAR_SLOT_CLASS =
  'group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9efbd]/28 bg-[linear-gradient(180deg,rgba(41,68,24,0.88),rgba(20,34,12,0.92))] shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(232,255,211,0.07)]';

export const HUD_GRID_SLOT_CLASS =
  'flex aspect-square items-center justify-center rounded-lg border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.68),rgba(28,48,16,0.72))] shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition hover:border-[#cfe8ab]/35';

export const HUD_CONTAINER_SLOT_CLASS =
  'flex aspect-square items-center justify-center rounded-lg border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.68),rgba(28,48,16,0.72))] shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition hover:border-[#cfe8ab]/35';
