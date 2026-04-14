'use client';

import { HudWindow } from './ui/HudWindow';
import { ItemIcon } from './ItemIcon';
import { ITEM_DEFINITIONS } from '@/lib/items/equipmentItems';

export type WorkbenchTab = 'craft' | 'upgrade';

type WorkbenchWindowProps = {
  isOpen: boolean;
  tab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  woodCount: number;
  canCraft: boolean;
  isCrafting: boolean;
  hasPendingPickup: boolean;
  progress: number;
  status: string;
  onCraft: () => void;
  onCollect: () => void;
  onClose: () => void;
};

export function WorkbenchWindow({
  isOpen,
  tab,
  onTabChange,
  woodCount,
  canCraft,
  isCrafting,
  hasPendingPickup,
  progress,
  status,
  onCraft,
  onCollect,
  onClose,
}: WorkbenchWindowProps) {
  if (!isOpen) {
    return null;
  }

  const craftButtonEnabled = hasPendingPickup || canCraft;
  const craftButtonLabel = hasPendingPickup ? 'Collect' : isCrafting ? 'Crafting...' : 'Craft';
  const craftButtonAction = hasPendingPickup ? onCollect : onCraft;

  return (
    <HudWindow
      title="Workbench"
      subtitle="Crafting"
      storageKey="mmorpg.ui.workbench.position.v1"
      defaultPosition={{ left: 420, top: 180 }}
      onClose={onClose}
      className="z-30 w-[420px] max-w-[92vw] border-[#d9efbd]/35 bg-[#17320d]/82"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onTabChange('craft')}
            className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              tab === 'craft'
                ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#cfe1ba] hover:bg-[#294816]/72'
            }`}
          >
            Craft
          </button>
          <button
            type="button"
            onClick={() => onTabChange('upgrade')}
            className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              tab === 'upgrade'
                ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#cfe1ba] hover:bg-[#294816]/72'
            }`}
          >
            Upgrade
          </button>
        </div>

        {tab === 'craft' ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Recipe</div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d9efbd]/20 bg-[#102108]/60">
                    <ItemIcon item={ITEM_DEFINITIONS.wood_staff} className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#f4ffe8]">Wood Staff</div>
                    <div className="text-xs text-[#cfe1ba]">Craft time: 10s</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!craftButtonEnabled}
                  onClick={craftButtonAction}
                  className={`rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    craftButtonEnabled
                      ? 'border-[#d9efbd]/30 bg-[#d7f0b6] text-[#18310d] hover:bg-[#e7f8cf]'
                      : 'cursor-not-allowed border-[#d9efbd]/14 bg-[#203b11]/35 text-[#88a26e]'
                  }`}
                >
                  {craftButtonLabel}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60">
                    <ItemIcon item={ITEM_DEFINITIONS.wood} className="h-6 w-6" />
                  </div>
                  <div className="text-sm text-[#d8ebc7]">Wood</div>
                </div>
                <div className={`text-xs font-semibold ${woodCount >= 5 ? 'text-[#d7f0b6]' : 'text-[#ffcf8a]'}`}>
                  {woodCount} / 5
                </div>
              </div>

              {isCrafting ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">
                    <span>Progress</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full border border-[#d9efbd]/20 bg-[#102108]/60">
                    <div
                      className="h-full rounded-full bg-[#d7f0b6]"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {status ? (
              <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3 text-sm text-[#d8ebc7]">
                {status}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Upgrade</div>
            <div className="mt-3 text-sm text-[#d8ebc7]">
              Upgrade recipes will appear here.
            </div>
          </div>
        )}
      </div>
    </HudWindow>
  );
}
