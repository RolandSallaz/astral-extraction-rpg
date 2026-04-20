'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import { ItemTile } from '@/components/game-hud/ItemTile';
import { SlotIcon } from '@/components/game-hud/SlotIcon';
import { CONSUMABLE_COOLDOWN_MS } from '@/components/game-hud/cooldownConstants';
import {
  getEquipmentSocketGemIds,
  getItemSocketColors,
  getItemTierStyle,
  getSocketColors,
  type ItemTintOverrides,
} from '@/components/game-hud/itemSocketHelpers';
import { canSocketGemIntoSlot } from '@/components/game-hud/inventoryHelpers';
import type {
  ActionBarBinding,
  ActionSlotKey,
  ConsumableCooldownState,
  DragSource,
  DragState,
  HoveredItemState,
  HoveredSkillState,
  SkillCooldownState,
  SkillId,
} from '@/components/game-hud/types';
import {
  HUD_CONTAINER_SLOT_CLASS,
  HUD_GRID_SLOT_CLASS,
  SKILL_BAR_SLOT_CLASS,
  SKILL_COOLDOWN_MS,
  SKILL_ICONS,
} from '@/components/game-hud/skillConstants';
import {
  EQUIPMENT_ITEMS,
  type BaseEquipmentSlot,
  type ConsumableItemId,
  type EquipmentSlot,
  type GemItemId,
  getInventoryItemId,
  parseInventoryItem,
  serializeInventoryItem,
} from '@/lib/items/equipmentItems';
import type { EquipmentState, InventoryState } from '@/lib/playerProfile';

type ContainerLike = {
  id: string;
  slots: InventoryState;
} | null;

type ActiveTargetingState =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;

type TooltipScope = HoveredItemState['scope'];
type SkillTooltipScope = HoveredSkillState['scope'];

export type UseSlotRenderersParams = {
  equipment: EquipmentState;
  inventory: InventoryState;
  container: ContainerLike;
  dragState: DragState | null;
  cooldownNow: number;
  skillCooldowns: SkillCooldownState;
  consumableCooldowns: ConsumableCooldownState;
  availableSkills: SkillId[];
  activeSkillTargeting: ActiveTargetingState;
  itemTintOverrides: ItemTintOverrides;
  getActionBarBinding: (slotKey: ActionSlotKey) => ActionBarBinding | null;
  getActionBarItemQuantity: (itemId: ConsumableItemId) => number;
  setActionBarBinding: (slotKey: ActionSlotKey, binding: ActionBarBinding | null) => void;
  triggerActionBarBinding: (binding: ActionBarBinding | null) => void;
  assignSkillToFirstAvailableActionSlot: (skillId: SkillId) => void;
  beginItemDrag: (
    event: ReactMouseEvent<HTMLButtonElement>,
    itemValue: string,
    source: DragSource,
  ) => void;
  beginSkillDrag: (
    event: ReactMouseEvent<HTMLButtonElement>,
    skillId: SkillId,
    source: DragSource,
  ) => void;
  beginActionBarDrag: (
    event: ReactMouseEvent<HTMLButtonElement>,
    slotKey: ActionSlotKey,
    binding: ActionBarBinding | null,
  ) => void;
  quickTransferItem: (source: DragSource) => boolean;
  handleEquipFromSource: (source: DragSource, itemValue: string) => void;
  dropOnInventory: (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  dropOnEquipment: (slot: BaseEquipmentSlot) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  dropOnContainer: (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  dropOnActionBar: (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  showItemTooltip: (
    itemValue: string,
    scope: TooltipScope,
  ) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  moveItemTooltip: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  hideItemTooltip: () => void;
  showSkillTooltip: (
    skillId: SkillId,
    scope?: SkillTooltipScope,
  ) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  moveSkillTooltip: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  moveActionBarTooltip: (
    binding: ActionBarBinding,
  ) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
  hideSkillTooltip: () => void;
  syncActionBarTooltip: (
    binding: ActionBarBinding | null,
    pointerX: number,
    pointerY: number,
  ) => void;
  openItemContextMenu: (
    itemValue: string,
    source: DragSource,
  ) => (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export type EquipSlotDescriptor = { id: BaseEquipmentSlot; label: string };

export function useSlotRenderers({
  equipment,
  inventory,
  container,
  dragState,
  cooldownNow,
  skillCooldowns,
  consumableCooldowns,
  availableSkills,
  activeSkillTargeting,
  itemTintOverrides,
  getActionBarBinding,
  getActionBarItemQuantity,
  setActionBarBinding,
  triggerActionBarBinding,
  assignSkillToFirstAvailableActionSlot,
  beginItemDrag,
  beginSkillDrag,
  beginActionBarDrag,
  quickTransferItem,
  handleEquipFromSource,
  dropOnInventory,
  dropOnEquipment,
  dropOnContainer,
  dropOnActionBar,
  showItemTooltip,
  moveItemTooltip,
  hideItemTooltip,
  showSkillTooltip,
  moveSkillTooltip,
  moveActionBarTooltip,
  hideSkillTooltip,
  syncActionBarTooltip,
  openItemContextMenu,
}: UseSlotRenderersParams) {
  const preventPrimaryDefault = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button === 0) {
      event.preventDefault();
    }
  };

  const startInventoryDrag =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = inventory[index];
      if (!itemId || event.button !== 0) {
        return;
      }

      if (event.ctrlKey && quickTransferItem({ type: 'inventory', index })) {
        event.preventDefault();
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        handleEquipFromSource({ type: 'inventory', index }, itemId);
        return;
      }

      beginItemDrag(event, itemId, { type: 'inventory', index });
    };

  const startEquipmentDrag =
    (slot: EquipmentSlot) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = equipment[slot];
      if (!itemId || event.button !== 0) {
        return;
      }

      beginItemDrag(event, itemId, { type: 'equipment', slot });
    };

  const startContainerDrag =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = container?.slots[index];
      if (!itemId || event.button !== 0) {
        return;
      }

      if (event.ctrlKey && quickTransferItem({ type: 'container', index })) {
        event.preventDefault();
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        handleEquipFromSource({ type: 'container', index }, itemId);
        return;
      }

      beginItemDrag(event, itemId, { type: 'container', index });
    };

  const startSkillLibraryDrag =
    (skillId: SkillId) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      beginSkillDrag(event, skillId, { type: 'skill-library', skillId });
    };

  const startActionBarDrag =
    (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const binding = getActionBarBinding(slotKey);
      beginActionBarDrag(event, slotKey, binding);
    };

  const clearActionBarSlot =
    (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setActionBarBinding(slotKey, null);
      syncActionBarTooltip(null, event.clientX, event.clientY);
    };

  const renderActionBarSlot = (slotKey: ActionSlotKey, label: string) => {
    const binding = getActionBarBinding(slotKey);
    const isSkillBinding = binding?.kind === 'skill';
    const isItemBinding = binding?.kind === 'item';
    const skillId = isSkillBinding ? binding.skillId : null;
    const itemId = isItemBinding ? binding.itemId : null;
    const skillIcon = skillId ? SKILL_ICONS[skillId] : null;
    const itemQuantity = itemId ? getActionBarItemQuantity(itemId) : 0;
    const readyAt =
      skillId
        ? (skillCooldowns[skillId] ?? 0)
        : itemId
          ? (consumableCooldowns[itemId] ?? 0)
          : 0;
    const cooldownDuration =
      skillId
        ? SKILL_COOLDOWN_MS[skillId]
        : itemId
          ? (CONSUMABLE_COOLDOWN_MS[itemId] ?? 0)
          : 0;
    const remainingMs = Math.max(0, readyAt - cooldownNow);
    const isCoolingDown = cooldownDuration > 0 && remainingMs > 0;
    const cooldownProgress =
      cooldownDuration > 0
        ? Math.max(0, Math.min(1, remainingMs / cooldownDuration))
        : 0;
    const isBindingAvailable =
      skillId
        ? availableSkills.includes(skillId)
        : itemId
          ? itemQuantity > 0
          : false;

    return (
      <button
        key={slotKey}
        type="button"
        onMouseDown={binding ? startActionBarDrag(slotKey) : preventPrimaryDefault}
        onMouseUp={dropOnActionBar(slotKey)}
        onMouseEnter={
          skillId
            ? showSkillTooltip(skillId, 'action-bar')
            : itemId
              ? showItemTooltip(serializeInventoryItem(itemId, Math.max(1, itemQuantity)), 'action-bar')
              : undefined
        }
        onMouseMove={binding ? moveActionBarTooltip(binding) : undefined}
        onMouseLeave={binding ? (skillId ? hideSkillTooltip : hideItemTooltip) : undefined}
        onClick={() => triggerActionBarBinding(binding)}
        onContextMenu={binding ? clearActionBarSlot(slotKey) : undefined}
        className={`${SKILL_BAR_SLOT_CLASS} ${
          skillId
            ? 'border-[#f4b36b]/40 bg-[linear-gradient(180deg,rgba(89,49,20,0.92),rgba(39,21,10,0.96))]'
            : ''
        } ${
          ((skillId &&
            activeSkillTargeting?.type === 'skill' &&
            activeSkillTargeting.skillId === skillId) ||
            (itemId === 'healing_potion' &&
              activeSkillTargeting?.type === 'consumable' &&
              activeSkillTargeting.itemId === itemId))
            ? 'ring-2 ring-[#ffd18a]/70 ring-offset-2 ring-offset-transparent'
            : ''
        } ${binding && !isBindingAvailable ? 'opacity-55' : ''} ${isCoolingDown ? 'opacity-90' : ''}`}
      >
        <div className="absolute left-1.5 top-1.5 z-10 rounded-md border border-[#d9efbd]/24 bg-[#102008]/72 px-1.5 py-[2px] text-[10px] font-bold leading-none text-[#f4ffe8]">
          {label}
        </div>
        {binding ? (
          <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))] text-[#ffe7b8] shadow-[inset_0_1px_0_rgba(255,236,195,0.08)]">
            {skillId && skillIcon ? (
              <img
                src={skillIcon.src}
                alt={skillIcon.alt}
                draggable={false}
                className="pixelated h-full w-full object-contain"
              />
            ) : itemId ? (
              <div className="flex h-full w-full items-center justify-center">
                <ItemTile
                  itemValue={serializeInventoryItem(itemId, Math.max(1, itemQuantity))}
                  compact
                  itemTintOverrides={itemTintOverrides}
                  cooldownEndsAt={consumableCooldowns[itemId] ?? 0}
                  cooldownNow={cooldownNow}
                />
              </div>
            ) : null}
            {itemId && itemQuantity > 1 ? (
              <div className="absolute bottom-1 right-1 rounded-md bg-[rgba(12,18,8,0.7)] px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
                {itemQuantity}
              </div>
            ) : null}
            {isCoolingDown ? (
              <>
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: `conic-gradient(from -90deg, rgba(12,18,8,0.12) 0deg, rgba(12,18,8,0.12) ${
                      360 - cooldownProgress * 360
                    }deg, rgba(8,12,6,0.72) ${360 - cooldownProgress * 360}deg, rgba(8,12,6,0.72) 360deg)`,
                  }}
                />
                <div className="absolute inset-[5px] rounded-lg bg-[rgba(10,14,8,0.26)]" />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-[rgba(12,18,8,0.55)] px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
                  {(remainingMs / 1000).toFixed(1)}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-[#d9efbd]/16 bg-[#102008]/50 text-[#bfd8a4]/70">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              --
            </span>
          </div>
        )}
      </button>
    );
  };

  const renderInventorySlot = (itemId: string | null, index: number) => {
    const isDraggingThisItem =
      dragState?.source.type === 'inventory' &&
      dragState.source.index === index;

    return (
      <button
        key={index}
        type="button"
        onMouseDown={itemId ? startInventoryDrag(index) : preventPrimaryDefault}
        onMouseEnter={itemId ? showItemTooltip(itemId, 'inventory') : undefined}
        onMouseMove={itemId ? moveItemTooltip : undefined}
        onMouseLeave={itemId ? hideItemTooltip : undefined}
        onContextMenu={itemId ? openItemContextMenu(itemId, { type: 'inventory', index }) : undefined}
        onMouseUp={dropOnInventory(index)}
        className={HUD_GRID_SLOT_CLASS}
      >
        {itemId ? (
          <ItemTile
            itemValue={itemId}
            compact
            faded={Boolean(isDraggingThisItem)}
            itemTintOverrides={itemTintOverrides}
            cooldownEndsAt={consumableCooldowns[getInventoryItemId(itemId) as keyof ConsumableCooldownState] ?? 0}
            cooldownNow={cooldownNow}
            socketCount={(() => {
              const parsed = parseInventoryItem(itemId);
              return parsed ? (EQUIPMENT_ITEMS[parsed.itemId].socketCount ?? 0) : 0;
            })()}
            socketColors={getItemSocketColors(itemId, equipment, itemTintOverrides)}
          />
        ) : null}
      </button>
    );
  };

  const renderEquipmentSlot = (slot: EquipSlotDescriptor) => {
    const equippedId = equipment[slot.id];
    const isDraggingThisItem =
      dragState?.source.type === 'equipment' &&
      dragState.source.slot === slot.id;
    const dragItemId = dragState ? getInventoryItemId(dragState.itemId) : null;
    const dragItem = dragItemId ? EQUIPMENT_ITEMS[dragItemId] : null;
    const canSocketDraggedGem =
      dragItem?.type === 'gem' &&
      canSocketGemIntoSlot(dragItem.id as GemItemId, slot.id, equipment);
    const equippedTierStyle = getItemTierStyle(equippedId);
    const dropAllowed =
      dragItem !== null &&
      (canSocketDraggedGem || (dragItem.type === 'equipment' && dragItem.slot === slot.id));

    return (
      <button
        key={slot.id}
        type="button"
        onMouseDown={equippedId ? startEquipmentDrag(slot.id) : preventPrimaryDefault}
        onMouseEnter={equippedId ? showItemTooltip(equippedId, 'equipment') : undefined}
        onMouseMove={equippedId ? moveItemTooltip : undefined}
        onMouseLeave={equippedId ? hideItemTooltip : undefined}
        onContextMenu={equippedId ? openItemContextMenu(equippedId, { type: 'equipment', slot: slot.id }) : undefined}
        onMouseUp={dropOnEquipment(slot.id)}
        className={`group rounded-lg border p-1 text-left shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition ${
          dropAllowed
            ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.7),rgba(35,60,19,0.78))]'
            : 'border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.56),rgba(28,48,16,0.68))]'
        }`}
      >
        <div className="flex h-12 items-center justify-center rounded-md border border-dashed border-[#d5edbb]/18 bg-[#14240d]/55">
          {equippedId ? (
            <ItemTile
              itemValue={equippedId}
              compact
              faded={Boolean(isDraggingThisItem)}
              itemTintOverrides={itemTintOverrides}
              socketCount={EQUIPMENT_ITEMS[equippedId].socketCount ?? 0}
              socketColors={getSocketColors(getEquipmentSocketGemIds(slot.id, equipment), itemTintOverrides)}
            />
          ) : (
            <SlotIcon slot={slot.id} />
          )}
        </div>
        <div
          className="mt-1 text-center text-[8px] font-medium uppercase tracking-[0.08em]"
          style={{ color: equippedTierStyle?.textColor ?? '#bfd8a4' }}
        >
          {slot.label}
        </div>
      </button>
    );
  };

  const renderContainerSlot = (itemId: string | null, index: number) => {
    if (!container) {
      return null;
    }

    const isDraggingThisItem =
      dragState?.source.type === 'container' &&
      dragState.source.index === index;
    const containerItemId = itemId ? parseInventoryItem(itemId)?.itemId ?? null : null;

    return (
      <button
        key={`${container.id}-${index}`}
        type="button"
        data-container-id={container.id}
        data-slot-index={index}
        data-item-id={containerItemId ?? undefined}
        onMouseDown={itemId ? startContainerDrag(index) : preventPrimaryDefault}
        onMouseEnter={itemId ? showItemTooltip(itemId, 'container') : undefined}
        onMouseMove={itemId ? moveItemTooltip : undefined}
        onMouseLeave={itemId ? hideItemTooltip : undefined}
        onContextMenu={itemId ? openItemContextMenu(itemId, { type: 'container', index }) : undefined}
        onMouseUp={dropOnContainer(index)}
        className={HUD_CONTAINER_SLOT_CLASS}
      >
        {itemId ? (
          <ItemTile
            itemValue={itemId}
            compact
            faded={Boolean(isDraggingThisItem)}
            itemTintOverrides={itemTintOverrides}
            socketCount={(() => {
              const parsed = parseInventoryItem(itemId);
              return parsed ? (EQUIPMENT_ITEMS[parsed.itemId].socketCount ?? 0) : 0;
            })()}
            socketColors={getItemSocketColors(itemId, equipment, itemTintOverrides)}
          />
        ) : null}
      </button>
    );
  };

  const renderSkillLibraryButton = (skillId: SkillId) => {
    const skillIcon = SKILL_ICONS[skillId];

    return (
      <button
        key={skillId}
        type="button"
        onMouseDown={startSkillLibraryDrag(skillId)}
        onMouseEnter={showSkillTooltip(skillId)}
        onMouseMove={moveSkillTooltip}
        onMouseLeave={hideSkillTooltip}
        onClick={() => assignSkillToFirstAvailableActionSlot(skillId)}
        className={`${SKILL_BAR_SLOT_CLASS} border-[#f4b36b]/40 bg-[linear-gradient(180deg,rgba(89,49,20,0.92),rgba(39,21,10,0.96))]`}
      >
        <div className="absolute left-1.5 top-1.5 z-10 rounded-md border border-[#d9efbd]/24 bg-[#102008]/72 px-1.5 py-[2px] text-[9px] font-bold leading-none text-[#f4ffe8]">
          Drag
        </div>
        <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))] text-[#ffe7b8] shadow-[inset_0_1px_0_rgba(255,236,195,0.08)]">
          {skillIcon ? (
            <img
              src={skillIcon.src}
              alt={skillIcon.alt}
              draggable={false}
              className="pixelated h-full w-full object-contain"
            />
          ) : null}
        </div>
      </button>
    );
  };

  return {
    preventPrimaryDefault,
    renderActionBarSlot,
    renderInventorySlot,
    renderEquipmentSlot,
    renderContainerSlot,
    renderSkillLibraryButton,
  };
}
