'use client';

import { useEffect, useState } from 'react';
import {
  ActionBarPanel,
  ContainerPanel,
  EquipmentPanel,
  HudSidebar,
  InventoryPanel,
} from '@/components/game-hud/HudPanels';
import { HudTabIcon } from '@/components/game-hud/HudTabIcon';
import { ItemTile } from '@/components/game-hud/ItemTile';
import {
  HudDragPreview,
  HudInspectWindow,
  HudItemContextMenu,
  HudItemTooltip,
  HudSkillTooltip,
} from '@/components/game-hud/HudOverlays';
import type {
  ActionSlotKey,
  ConsumableCooldownState,
  ConsumableUseRequest,
  DragSource,
  MouseActionSlotKey,
  MouseSkillBindings,
  SkillCooldownState,
  SkillId,
} from '@/components/game-hud/types';
import { useDragAndDrop } from '@/components/game-hud/useDragAndDrop';
import { useActionBar } from '@/components/game-hud/useActionBar';
import { buildInspectSocketHandlers, useSocketMutations } from '@/components/game-hud/useSocketMutations';
import { useInventoryInteractions } from '@/components/game-hud/useInventoryInteractions';
import { useSlotRenderers } from '@/components/game-hud/useSlotRenderers';
import { useHudViews } from '@/components/game-hud/useHudViews';
import { SKILL_ICONS } from '@/components/game-hud/skillConstants';
import { type ItemTintOverrides } from '@/components/game-hud/itemSocketHelpers';
import {
  formatGoldValue,
  getItemContextPrimaryActionLabel,
} from '@/components/game-hud/tooltipHelpers';
import { shouldIgnoreHudHotkey } from '@/components/game-hud/hotkeyHelpers';
import {
  ACTION_BAR_SLOTS,
  KEYBOARD_ACTION_SLOTS,
  MOUSE_ACTION_SLOTS,
} from '@/components/game-hud/actionBarHelpers';
import {
  DEFAULT_ITEM_BALANCE_CONFIG,
  type ItemBalanceConfig,
} from '@/lib/itemBalance';
import { type BaseEquipmentSlot } from '@/lib/items/equipmentItems';
import {
  type EquipmentItemProgressionState,
  type EquipmentState,
  type InventoryState,
} from '@/lib/playerProfile';

export type ContainerView = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  slots: InventoryState;
};

type EquipSlotId = BaseEquipmentSlot;
export type { MouseActionSlotKey, MouseSkillBindings, SkillId };

type HudPanel = 'inventory' | 'equipment';

const EQUIP_SLOTS: Array<{ id: EquipSlotId; label: string }> = [
  { id: 'head', label: 'Head' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'body', label: 'Body' },
  { id: 'weapon', label: 'Weapon' },
  { id: 'offhand', label: 'Offhand' },
  { id: 'ring-1', label: 'Ring I' },
  { id: 'ring-2', label: 'Ring II' },
];

const HUD_WINDOW_GREEN_CLASS =
  'border-[#d9efbd]/35 bg-[#17320d]/82';
const HUD_SECTION_CLASS =
  'rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3';
type ActiveTargetingState =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;

export function GameHud({
  equipment,
  equipmentItemProgression,
  inventory,
  container,
  playerGold,
  playerStrength,
  playerAgility,
  playerIntellect,
  activeSkillTargeting,
  skillCooldowns,
  consumableCooldowns,
  onSkillTrigger,
  onActionBarConsumableTrigger,
  onMouseSkillBindingsChange,
  onEquipmentChange,
  onInventoryChange,
  onInventoryUse,
  onContainerChange,
  onCloseContainer,
  isQuestLogOpen = false,
  onToggleQuestLog,
  itemTintOverrides = {},
  itemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
}: {
  equipment: EquipmentState;
  equipmentItemProgression: EquipmentItemProgressionState;
  inventory: InventoryState;
  container: ContainerView | null;
  playerGold: number;
  playerStrength: number;
  playerAgility: number;
  playerIntellect: number;
  activeSkillTargeting: ActiveTargetingState;
  skillCooldowns: SkillCooldownState;
  consumableCooldowns: ConsumableCooldownState;
  onSkillTrigger: (skillId: SkillId) => void;
  onActionBarConsumableTrigger: (itemId: 'healing_potion') => void;
  onMouseSkillBindingsChange?: (bindings: MouseSkillBindings) => void;
  onEquipmentChange: (
    equipment: EquipmentState,
    equipmentItemProgression: EquipmentItemProgressionState,
  ) => void;
  onInventoryChange: (inventory: InventoryState) => void;
  onInventoryUse: (request: ConsumableUseRequest) => void;
  onContainerChange: (slots: InventoryState) => void;
  onCloseContainer: () => void;
  isQuestLogOpen?: boolean;
  onToggleQuestLog?: () => void;
  itemTintOverrides?: ItemTintOverrides;
  itemBalanceConfig?: ItemBalanceConfig;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);
  const {
    actionBarBindings,
    availableSkills,
    getActionBarBinding,
    setActionBarBinding,
    updateActionBarBindings,
    assignSkillToFirstAvailableActionSlot,
    triggerActionBarBinding,
    getActionBarItemQuantity,
    getDraggedActionBarBinding,
  } = useActionBar({
    equipment,
    equipmentItemProgression,
    inventory,
    skillCooldowns,
    consumableCooldowns,
    onSkillTrigger,
    onInventoryUse,
    onActionBarConsumableTrigger,
    onMouseSkillBindingsChange,
  });
  const clearContainerUiState = () => {
    clearHoveredItemScope('container');
    setItemContextMenu((current) =>
      current?.source.type === 'container' ? null : current,
    );
    setInspectItem((current) =>
      current?.source.type === 'container' ? null : current,
    );
    setDragState((current) => {
      if (!current) {
        return current;
      }

      if (current.source.type === 'container') {
        return null;
      }

      if (
        current.source.type === 'inspect-socket' &&
        current.source.itemSource.type === 'container'
      ) {
        return null;
      }

      return current;
    });
  };
  const handleAltItemAction = (source: DragSource, itemValue: string) => {
    handleEquipFromSource(source, itemValue);
  };
  const {
    dragState,
    setDragState,
    hoveredItem,
    setHoveredItem,
    hoveredSkill,
    setHoveredSkill,
    itemContextMenu,
    setItemContextMenu,
    inspectItem,
    setInspectItem,
    clearHoveredItemScope,
    beginItemDrag,
    beginSkillDrag,
    beginActionBarDrag,
    showItemTooltip,
    moveItemTooltip,
    hideItemTooltip,
    showSkillTooltip,
    moveSkillTooltip,
    hideSkillTooltip,
    syncActionBarTooltip,
    moveActionBarTooltip,
    openItemContextMenu,
    openInspectItem,
    closeInspectItem,
    markActionBarDragHandled,
  } = useDragAndDrop({
    getActionBarItemQuantity,
    onAltItemAction: handleAltItemAction,
    onUnhandledActionBarDragRelease: (slotKey) => setActionBarBinding(slotKey, null),
  });
  const {
    socketGemIntoInspectItem,
    removeGemFromInspectItem,
    buildRemoveGemFromItemSourceResult,
  } = useSocketMutations({
    equipment,
    equipmentItemProgression,
    inventory,
    container,
    inspectItem,
    setInspectItem,
    setHoveredItem,
    onEquipmentChange,
    onInventoryChange,
    onContainerChange,
  });
  const {
    handleDropItem,
    quickTransferItem,
    dropOnActionBar,
    dropOnInventory,
    dropOnEquipment,
    dropOnContainer,
    dropIntoBackpackZone,
    handleEquipFromSource,
  } = useInventoryInteractions({
    equipment,
    equipmentItemProgression,
    inventory,
    container,
    dragState,
    setDragState,
    setItemContextMenu,
    setInspectItem,
    markActionBarDragHandled,
    syncActionBarTooltip,
    getActionBarBinding,
    setActionBarBinding,
    updateActionBarBindings,
    getDraggedActionBarBinding,
    buildRemoveGemFromItemSourceResult,
    onEquipmentChange,
    onInventoryChange,
    onContainerChange,
    onInventoryUse,
  });
  const {
    renderActionBarSlot,
    renderInventorySlot,
    renderEquipmentSlot,
    renderContainerSlot,
    renderSkillLibraryButton,
  } = useSlotRenderers({
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
  });
  const {
    visibleInspectItem,
    visibleItemContextMenu,
    visibleHoveredItem,
    visibleHoveredItemView,
    hoveredItemPosition,
    hoveredSkillView,
    hoveredSkillPosition,
    itemContextMenuPosition,
    visibleInspectItemView,
  } = useHudViews({
    equipment,
    container,
    hoveredItem,
    hoveredSkill,
    inspectItem,
    itemContextMenu,
    itemBalanceConfig,
    itemTintOverrides,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (shouldIgnoreHudHotkey(event.target)) {
        return;
      }

      if (event.code === 'KeyI') {
        event.preventDefault();
        if (inventoryOpen) {
          clearHoveredItemScope('inventory');
        }
        setInventoryOpen((current) => !current);
        return;
      }

      if (event.code === 'Tab') {
        event.preventDefault();
        if (equipmentOpen) {
          clearHoveredItemScope('equipment');
        }
        setEquipmentOpen((current) => !current);
        return;
      }

      const slotConfig = ACTION_BAR_SLOTS.find(({ code }) => code === event.code);
      if (!slotConfig) {
        return;
      }

      const binding = getActionBarBinding(slotConfig.key);
      if (!binding) {
        return;
      }

      if (binding.kind === 'skill') {
        if (!availableSkills.includes(binding.skillId)) {
          return;
        }
      }

      event.preventDefault();
      triggerActionBarBinding(binding);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionBarBindings, availableSkills, clearHoveredItemScope, consumableCooldowns, equipmentOpen, inventory, inventoryOpen, onInventoryUse, onSkillTrigger, skillCooldowns]);

  const togglePanel = (panel: HudPanel) => {
    if (panel === 'inventory') {
      if (inventoryOpen) {
        clearHoveredItemScope('inventory');
      }
      setInventoryOpen((current) => !current);
      return;
    }

    if (equipmentOpen) {
      clearHoveredItemScope('equipment');
    }
    setEquipmentOpen((current) => !current);
  };

  const { handleInspectSocketMouseDown, handleInspectSocketMouseUp } = buildInspectSocketHandlers({
    dragState,
    setDragState,
    inspectItem,
    socketGemIntoInspectItem,
  });

  const renderOverlayItemTile = ({
    itemValue,
    compact = false,
    socketCount = 0,
    socketColors = [],
  }: {
    itemValue: string;
    compact?: boolean;
    socketCount?: number;
    socketColors?: Array<string | null>;
  }) => (
    <ItemTile
      itemValue={itemValue}
      compact={compact}
      socketCount={socketCount}
      socketColors={socketColors}
      itemTintOverrides={itemTintOverrides}
    />
  );

  return (
    <>
      <HudSidebar
        goldLabel={formatGoldValue(playerGold)}
        buttons={[
          {
            key: 'inventory',
            title: 'Inventory',
            isActive: inventoryOpen,
            icon: <HudTabIcon panel="inventory" />,
            onClick: () => togglePanel('inventory'),
          },
          {
            key: 'equipment',
            title: 'Character',
            isActive: equipmentOpen,
            icon: <HudTabIcon panel="equipment" />,
            onClick: () => togglePanel('equipment'),
          },
          ...(onToggleQuestLog
            ? [{
              key: 'quests',
              title: 'Quests',
              isActive: isQuestLogOpen,
              icon: <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Q</span>,
              onClick: onToggleQuestLog,
            }]
            : []),
        ]}
      />

      <InventoryPanel
        open={inventoryOpen}
        items={inventory}
        onClose={() => {
          setInventoryOpen(false);
          clearHoveredItemScope('inventory');
        }}
        onMouseUp={dropIntoBackpackZone}
        renderSlot={renderInventorySlot}
      />

      <EquipmentPanel
        open={equipmentOpen}
        stats={[
          { label: 'GLD', value: formatGoldValue(playerGold) },
          { label: 'STR', value: playerStrength },
          { label: 'AGI', value: playerAgility },
          { label: 'INT', value: playerIntellect },
        ]}
        slots={EQUIP_SLOTS}
        onClose={() => {
          setEquipmentOpen(false);
          clearHoveredItemScope('equipment');
        }}
        renderSlot={renderEquipmentSlot}
      />

      <ContainerPanel
        container={container}
        onClose={() => {
          clearContainerUiState();
          onCloseContainer();
        }}
        renderSlot={renderContainerSlot}
      />

      <HudDragPreview
        dragState={dragState}
        renderItemTile={renderOverlayItemTile}
        skillIcons={SKILL_ICONS}
      />

      <HudItemContextMenu
        itemContextMenu={visibleItemContextMenu}
        position={itemContextMenuPosition}
        getPrimaryActionLabel={getItemContextPrimaryActionLabel}
        onPrimaryAction={(state) => handleEquipFromSource(state.source, state.itemValue)}
        onInspect={(state) => openInspectItem(state.itemValue, state.source)}
        onDrop={(state) => handleDropItem(state.source)}
      />

      <HudInspectWindow
        inspectItem={visibleInspectItem}
        inspectItemView={visibleInspectItemView}
        dragState={dragState}
        onClose={closeInspectItem}
        onInspectSocketMouseDown={handleInspectSocketMouseDown}
        onInspectSocketMouseUp={handleInspectSocketMouseUp}
        onInspectSocketClick={removeGemFromInspectItem}
        renderItemTile={renderOverlayItemTile}
        showItemTooltip={showItemTooltip}
        moveItemTooltip={moveItemTooltip}
        hideItemTooltip={hideItemTooltip}
        windowClassName={`z-40 w-[280px] ${HUD_WINDOW_GREEN_CLASS}`}
        sectionClassName={HUD_SECTION_CLASS}
      />

      <HudItemTooltip
        hoveredItem={visibleHoveredItem}
        tooltipView={visibleHoveredItemView}
        position={hoveredItemPosition}
      />

      <HudSkillTooltip
        hoveredSkill={hoveredSkill}
        tooltipView={hoveredSkillView}
        position={hoveredSkillPosition}
      />

      <ActionBarPanel
        availableSkills={availableSkills}
        skillsDrawerOpen={skillsDrawerOpen}
        onToggleSkillsDrawer={() => setSkillsDrawerOpen((current) => !current)}
        renderSkillButton={renderSkillLibraryButton}
        mouseSlots={MOUSE_ACTION_SLOTS}
        keyboardSlots={KEYBOARD_ACTION_SLOTS}
        renderActionBarSlot={(slotKey, label) => renderActionBarSlot(slotKey as ActionSlotKey, label)}
      />
    </>
  );
}
