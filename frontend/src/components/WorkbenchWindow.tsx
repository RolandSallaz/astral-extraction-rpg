'use client';

import { HudWindow } from './ui/HudWindow';
import { ItemIcon } from './ItemIcon';
import { ITEM_DEFINITIONS } from '@/lib/items/equipmentItems';
import type { ItemProgressionTier } from '@mmorpg/shared';

export type WorkbenchTab = 'craft' | 'upgrade';
export type WorkbenchUpgradeChoiceView = {
  id: string;
  level: ItemProgressionTier;
  title: string;
  description: string;
  isPlaceholder?: boolean;
  isAvailable: boolean;
};

export type WorkbenchUpgradeableWeaponView = {
  key: string;
  sourceLabel: string;
  title: string;
  subtitle: string;
  level: number;
  selectedUpgradeTitles: string[];
  nextChoices: WorkbenchUpgradeChoiceView[];
};

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
  upgradeableWeapons: WorkbenchUpgradeableWeaponView[];
  selectedUpgradeableWeaponKey: string | null;
  onSelectUpgradeableWeapon: (weaponKey: string) => void;
  onApplyUpgradeChoice: (choiceId: string) => void;
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
  upgradeableWeapons,
  selectedUpgradeableWeaponKey,
  onSelectUpgradeableWeapon,
  onApplyUpgradeChoice,
  onClose,
}: WorkbenchWindowProps) {
  if (!isOpen) {
    return null;
  }

  const craftButtonEnabled = hasPendingPickup || canCraft;
  const craftButtonLabel = hasPendingPickup ? 'Collect' : isCrafting ? 'Crafting...' : 'Craft';
  const craftButtonAction = hasPendingPickup ? onCollect : onCraft;
  const selectedUpgradeableWeapon = selectedUpgradeableWeaponKey
    ? upgradeableWeapons.find((weapon) => weapon.key === selectedUpgradeableWeaponKey) ?? null
    : upgradeableWeapons[0] ?? null;

  return (
    <HudWindow
      title="Workbench"
      subtitle="Crafting"
      storageKey="mmorpg.ui.workbench.position.v1"
      defaultPosition={{ left: 420, top: 180 }}
      onClose={onClose}
      headerActions={
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/items/equipment/workbench-16x16.png"
          alt="Workbench"
          draggable={false}
          className="pixelated h-8 w-8 rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60 p-1"
        />
      }
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
          <div className="grid gap-4 md:grid-cols-[168px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Weapons</div>
              <div className="mt-3 space-y-2">
                {upgradeableWeapons.length > 0 ? upgradeableWeapons.map((weapon) => {
                  const isSelected = selectedUpgradeableWeapon?.key === weapon.key;
                  return (
                    <button
                      key={weapon.key}
                      type="button"
                      onClick={() => onSelectUpgradeableWeapon(weapon.key)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#d9efbd]/55 bg-[#d7f0b6] text-[#18310d]'
                          : 'border-[#d9efbd]/18 bg-[#203b11]/45 text-[#d8ebc7] hover:bg-[#294816]/72'
                      }`}
                    >
                      <div className="text-sm font-semibold">{weapon.title}</div>
                      <div className={`mt-1 text-[10px] uppercase tracking-[0.18em] ${isSelected ? 'text-[#35511e]' : 'text-[#9fbc7e]'}`}>
                        {weapon.sourceLabel}
                      </div>
                      <div className={`mt-2 text-xs ${isSelected ? 'text-[#264116]' : 'text-[#cfe1ba]'}`}>
                        Level {weapon.level}
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-3 text-sm text-[#9fbc7e]">
                    No upgradeable weapons found.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Upgrade Tree</div>

              {selectedUpgradeableWeapon ? (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d9efbd]/20 bg-[#102108]/60">
                      <ItemIcon item={ITEM_DEFINITIONS.wood_staff} className="h-8 w-8" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#f4ffe8]">{selectedUpgradeableWeapon.title}</div>
                      <div className="mt-1 text-xs text-[#cfe1ba]">{selectedUpgradeableWeapon.subtitle}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">Current Level</div>
                      <div className="mt-2 text-2xl font-semibold text-[#f4ffe8]">{selectedUpgradeableWeapon.level}</div>
                    </div>
                    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">Chosen Upgrades</div>
                      <div className="mt-2 text-sm text-[#d8ebc7]">
                        {selectedUpgradeableWeapon.selectedUpgradeTitles.length > 0
                          ? selectedUpgradeableWeapon.selectedUpgradeTitles.join(', ')
                          : 'No upgrades selected yet.'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">Next Choice</div>
                    <div className="mt-3 space-y-2">
                      {selectedUpgradeableWeapon.nextChoices.length > 0 ? selectedUpgradeableWeapon.nextChoices.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => onApplyUpgradeChoice(choice.id)}
                          disabled={!choice.isAvailable}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            choice.isAvailable
                              ? 'border-[#d9efbd]/24 bg-[#284715]/62 text-[#f4ffe8] hover:bg-[#355d1d]/78'
                              : 'cursor-not-allowed border-[#d9efbd]/12 bg-[#203b11]/30 text-[#88a26e]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold">{choice.title}</div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">Lv {choice.level}</div>
                          </div>
                          <div className="mt-2 text-xs text-[#cfe1ba]">{choice.description}</div>
                        </button>
                      )) : (
                        <div className="text-sm text-[#d8ebc7]">
                          This weapon already reached the final skill choice.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#d8ebc7]">
                  Bring a wood staff to the workbench to start upgrading it.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </HudWindow>
  );
}
