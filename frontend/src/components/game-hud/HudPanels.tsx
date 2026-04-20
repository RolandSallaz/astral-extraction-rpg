'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { HudWindow } from '@/components/ui/HudWindow';
import type { SkillId } from '@/components/game-hud/types';

type EquipmentPanelSlotId = 'head' | 'amulet' | 'body' | 'weapon' | 'offhand' | 'ring-1' | 'ring-2';

type SidebarButton = {
  key: string;
  title: string;
  isActive: boolean;
  icon: ReactNode;
  onClick: () => void;
};

export function HudSidebar({
  goldLabel,
  buttons,
}: {
  goldLabel: string;
  buttons: SidebarButton[];
}) {
  return (
    <section className="pointer-events-auto fixed right-5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 select-none">
      <div className="rounded-2xl border border-[#d9efbd]/35 bg-[#17320d]/82 px-3 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">Gold</div>
        <div className="mt-1 font-serif text-lg font-bold text-[#ffe29c]">{goldLabel}</div>
      </div>
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={button.onClick}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition ${
            button.isActive
              ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.82),rgba(35,60,19,0.88))] text-[#f4ffe8]'
              : 'border-[#d9efbd]/35 bg-[#17320d]/82 text-[#bfd8a4] hover:bg-[#234514]/90'
          }`}
          title={button.title}
        >
          {button.icon}
        </button>
      ))}
    </section>
  );
}

export function InventoryPanel({
  open,
  items,
  onClose,
  onMouseUp,
  renderSlot,
}: {
  open: boolean;
  items: Array<string | null>;
  onClose: () => void;
  onMouseUp: MouseEventHandler<HTMLDivElement>;
  renderSlot: (itemValue: string | null, index: number) => ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <HudWindow
      title="Backpack"
      storageKey="mmorpg.ui.inventory.position.v1"
      defaultPosition={{ left: 620, top: 120 }}
      onClose={onClose}
      className="z-20 w-max border-[#d9efbd]/35 bg-[#17320d]/82"
    >
      <div
        className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3"
        onMouseUp={onMouseUp}
      >
        <div
          className="grid content-start justify-center gap-2"
          style={{ gridTemplateColumns: 'repeat(6, 40px)' }}
        >
          {items.map(renderSlot)}
        </div>
      </div>
    </HudWindow>
  );
}

export function EquipmentPanel({
  open,
  stats,
  slots,
  onClose,
  renderSlot,
}: {
  open: boolean;
  stats: Array<{ label: string; value: ReactNode }>;
  slots: Array<{ id: EquipmentPanelSlotId; label: string }>;
  onClose: () => void;
  renderSlot: (slot: { id: EquipmentPanelSlotId; label: string }) => ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <HudWindow
      title="Character"
      storageKey="mmorpg.ui.equipment.position.v1"
      defaultPosition={{ left: 860, top: 120 }}
      onClose={onClose}
      className="z-20 w-max border-[#d9efbd]/35 bg-[#17320d]/82"
    >
      <div className="flex items-start gap-4">
        <div className="order-1 w-[170px] shrink-0 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
            Stats
          </div>
          <div className="grid min-w-[170px] gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-xl border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.56),rgba(28,48,16,0.68))] px-3 py-2"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
                  {stat.label}
                </div>
                <div className="font-serif text-lg font-bold text-[#f4ffe8]">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="order-2 shrink-0 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
          <div className="grid grid-cols-2 gap-1">{slots.map(renderSlot)}</div>
        </div>
      </div>
    </HudWindow>
  );
}

export function ContainerPanel({
  container,
  onClose,
  renderSlot,
}: {
  container: {
    id: string;
    title: string;
    subtitle: string;
    columns: number;
    slots: Array<string | null>;
  } | null;
  onClose: () => void;
  renderSlot: (itemValue: string | null, index: number) => ReactNode;
}) {
  if (!container) {
    return null;
  }

  return (
    <HudWindow
      title={container.title}
      subtitle={container.subtitle}
      storageKey="mmorpg.ui.container.position.v1"
      defaultPosition={{ left: 20, top: 120 }}
      onClose={onClose}
      className="z-30 w-max border-[#d9efbd]/35 bg-[#17320d]/82"
    >
      <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
        <div
          className="grid content-start justify-center gap-2"
          style={{ gridTemplateColumns: `repeat(${container.columns}, 40px)` }}
        >
          {container.slots.map(renderSlot)}
        </div>
      </div>
    </HudWindow>
  );
}

export function ActionBarPanel({
  availableSkills,
  skillsDrawerOpen,
  onToggleSkillsDrawer,
  renderSkillButton,
  mouseSlots,
  keyboardSlots,
  renderActionBarSlot,
}: {
  availableSkills: SkillId[];
  skillsDrawerOpen: boolean;
  onToggleSkillsDrawer: () => void;
  renderSkillButton: (skillId: SkillId) => ReactNode;
  mouseSlots: Array<{ key: string; label: string }>;
  keyboardSlots: Array<{ key: string }>;
  renderActionBarSlot: (slotKey: string, label: string) => ReactNode;
}) {
  return (
    <section className="pointer-events-auto fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleSkillsDrawer}
          className="rounded-2xl border border-[#d9efbd]/24 bg-[#17320d]/76 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#dff4c6] shadow-[0_16px_32px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-[#224515]/88"
          title="Toggle skills drawer"
        >
          {skillsDrawerOpen ? 'Hide Skills' : 'Show Skills'}
        </button>

        {skillsDrawerOpen ? (
          <div className="flex items-center gap-2 rounded-[1.25rem] border border-[#d9efbd]/24 bg-[#17320d]/76 px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-md">
            {availableSkills.length > 0 ? (
              availableSkills.map(renderSkillButton)
            ) : (
              <div className="rounded-xl border border-[#d9efbd]/16 bg-[#102008]/50 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-[#bfd8a4]/70">
                No skills available
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-[1.75rem] border border-[#d9efbd]/24 bg-[#17320d]/76 px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-md">
          <div className="flex items-center gap-2 rounded-[1.2rem] border border-[#d9efbd]/16 bg-[#102008]/38 px-2 py-2">
            {mouseSlots.map(({ key, label }) => renderActionBarSlot(key, label))}
          </div>
          <div className="h-10 w-px bg-[#d9efbd]/10" />
          <div className="flex items-center gap-2">
            {keyboardSlots.map(({ key }) => renderActionBarSlot(key, key))}
          </div>
        </div>
      </div>
    </section>
  );
}
