'use client';

import type { BaseEquipmentSlot } from '@/lib/items/equipmentItems';

export function SlotIcon({ slot }: { slot: BaseEquipmentSlot }) {
  const common =
    'h-7 w-7 text-[#e5f5cf] opacity-80 transition group-hover:opacity-100';

  switch (slot) {
    case 'head':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 9a5 5 0 1 1 10 0v2H7V9Z" />
          <path d="M9 11v3m6-3v3" />
          <path d="M8 17h8" />
        </svg>
      );
    case 'amulet':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 6c1.5 2 3 3 4 3s2.5-1 4-3" />
          <path d="M12 9v4" />
          <path d="M9.5 16 12 20l2.5-4L12 13l-2.5 3Z" />
        </svg>
      );
    case 'body':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5h6l2 3-2 2v8H9v-8L7 8l2-3Z" />
          <path d="M12 5v13" />
        </svg>
      );
    case 'weapon':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m7 17 7-7" />
          <path d="m13 6 2-2 5 5-2 2" />
          <path d="m5 19 2-2 2 2-2 2-2-2Z" />
        </svg>
      );
    case 'offhand':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4 6 7v5c0 4 2.6 6.8 6 8 3.4-1.2 6-4 6-8V7l-6-3Z" />
          <path d="M12 8v8" />
        </svg>
      );
    case 'ring-1':
    case 'ring-2':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="14" r="4.5" />
          <path d="m9.5 7 2.5-3 2.5 3" />
        </svg>
      );
  }
}
