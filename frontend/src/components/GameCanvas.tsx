'use client';

import { useEffect, useRef } from 'react';
import { useRefSync } from '@/components/game-canvas/useRefSync';
import type { MouseActionSlotKey, MouseSkillBindings, SkillId } from '@/components/game-hud/types';
import {
  DEFAULT_MOB_BALANCE_CONFIG,
  DEFAULT_SKILL_BALANCE_CONFIG,
  type MobBalanceConfig,
  type SkillBalanceConfig,
} from '@mmorpg/shared';
import {
  RAID_GAMEPLAY_PROFILE,
  WORLD_GAMEPLAY_PROFILE,
} from '@mmorpg/shared/gameplay/profiles';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import type { QuestLog } from '@mmorpg/shared/quests/core';
import {
  DEFAULT_PLAYER_VISUALS,
  type PlayerAnimationState,
} from '@mmorpg/shared/player/visuals';
import type {
  ChatInputMessage,
  DiedMessage,
  MoveMessage,
  RaidExitStateMessage,
  RaidRoomJoinOptions,
  RealtimeChatMessage,
  RespawnedMessage,
  ThrownConsumableMessage,
  UseExitMessage,
  WorldRoomJoinOptions,
} from '@mmorpg/shared/realtime/contracts';
import { FIREBALL_BASE_CAST_TIME_MS } from '@mmorpg/shared/skills/fireball';
import { SKELETON_DASH_SKILL_ID } from '@mmorpg/shared/mobs/skills';
import {
  createDefaultMeadowMapAsset,
  createMeadowDecorations,
  createMeadowDecorationsFromAsset,
  createMeadowMapFromAsset,
  createMeadowMobsFromAsset,
  createMeadowStampsFromAsset,
  createMeadowTradersFromAsset,
  ensureWorldWorkbenchStamp,
  isBlockingMeadowStamp,
  isBlockedMeadowTile,
  type MeadowMapAsset,
  type MeadowMobAsset,
  type MeadowOverlayAsset,
  type MeadowTile,
  type MeadowTraderAsset,
  resolveGroundOverlaysFromAsset,
  resolveMeadowTexture,
} from '@/lib/maps/meadowMap';
import {
  EQUIPMENT_ITEMS,
  getItemIconTintValue,
  type ConsumableItemId,
  type EquipmentItemId,
} from '@/lib/items/equipmentItems';
import {
  BODY_EQUIPMENT_IDS,
  getEquipmentBodyTexturePath,
  getEquipmentVisual,
} from '@mmorpg/shared/visuals/equipmentVisuals';
import {
  DEFAULT_SKILL_EFFECT_OVERRIDES,
  type SkillEffectOverrides,
} from '@/lib/skillEffects';
import {
  getStoredSessionToken,
  loadRaidRun,
} from '@/lib/playerStorage';

type ActiveTargetingState =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;
import {
  createDefaultMobVisualConfig,
  type MobAnimationState,
  type MobAnimationClipDefinition,
  type MobVisualConfig,
} from '@mmorpg/shared/mobs/visuals';
import type { MobKind } from '@mmorpg/shared/mobs/catalog';
import {
  getAnimationFrameAtState,
  isDeathAnimationComplete,
  syncAnimationState,
  syncDeathState,
} from '@/lib/animations/entities';
import {
  getSpriteSheetAnimationDurationMs,
  getSpriteSheetAnimationFrame,
  getSpriteSheetAnimationFrameOffset,
  loadSpriteSheetAnimation,
  resolveSpriteSheetAnimationColumns,
  type SpriteSheetAnimation,
} from '@/lib/animations/runtime';
import { getProjectileAnimation, getProjectileDisplaySize } from '@/components/game-canvas/projectileHelpers';
import {
  applyCharacterHealthToVisual,
  applyMobHealthToVisual,
  layoutHealthSegments,
  MAX_HEALTH_BAR_SEGMENTS,
} from '@/components/game-canvas/healthBarHelpers';
import {
  applyRaidPredictedMovement,
  applyWorldPredictedMovement,
} from '@/components/game-canvas/movementPrediction';
import {
  clampTargetToCastRange,
  getCharacterCastRange,
} from '@/components/game-canvas/castHelpers';
import { createWorldEditorInputHandler } from '@/components/game-canvas/worldEditorInput';
import {
  createBaseProfileMessage,
  createWorldProfileMessage,
  type ProfileSnapshot,
} from '@/components/game-canvas/profileMessages';
import {
  createTimedCastSkillMessage,
  handleCanvasPointerDown,
} from '@/components/game-canvas/mouseInput';
import {
  applyBurningToCharacterVisual,
  applyBurningToMobVisual,
  applyCastingToCharacterVisual,
  applyHealingToCharacterVisual,
  getHeldCastConsumableItemId,
  getHeldTargetingConsumableItemId,
  hideStatusIcon,
  updateCharacterEffectDisplay,
  updateMobEffectDisplay,
} from '@/components/game-canvas/statusEffectHelpers';
import {
  createFloatingCombatText,
  createThrownConsumableVisual,
  playThrownConsumableImpact,
  type ThrownConsumableVisual,
} from '@/components/game-canvas/overlayEffects';
import {
  getWorldTraderAnimationKey,
  getWorldTraderBodyOverlayAnimation,
  getWorldTraderSpriteSheetKey,
} from '@/components/game-canvas/worldTraderHelpers';
import {
  getAnimatedMobTexture,
  getMobRenderScale,
  getMobVisualKind,
  toRuntimeAnimationFromMobClip,
} from '@/components/game-canvas/mobRenderHelpers';
import {
  computeRaidVisibleTiles,
  getRaidTilePositionFromWorld,
} from '@/components/game-canvas/raidVisibility';
import {
  getCharacterFootY,
  getEntitySortDepth,
  getEquippedItemHandPosition,
  getEyeLocalPosition,
  getEyeLookDirection,
  getHandDisplaySize,
  getHandLocalPosition,
  getMobDeathAnimationCenterY,
  getMobFootY,
  getPlayerHeadOffsetY,
  getSharedDeathAnimationScale,
  getVisualDisplaySize,
  getVisualPixelSize,
  getWorldTraderFootY,
  syncCharacterWeaponLayering,
} from '@/components/game-canvas/renderGeometry';
import { renderWorldMap as renderWorldMapScene } from '@/components/game-canvas/worldMapRenderer';
import { useGameCanvasRoomSync } from '@/components/game-canvas/useGameCanvasRoomSync';
import { createMinimapEmitter, type MinimapSnapshot } from '@/components/game-canvas/minimapEmitter';
import {
  getRaidExploredStorageKey,
  loadStoredRaidExploredTiles,
  saveStoredRaidExploredTiles,
} from '@/components/game-canvas/raidStorageHelpers';
import {
  createSkillAnimation,
  getPlayerMobCollisionCenterY,
  getRealtimeEndpoint,
  loadWorldMapAsset,
  resolveCryptTexture,
  toConsumableItemId,
  toEquipmentItemId,
} from '@/components/game-canvas/gameCanvasHelpers';
import {
  getChestTextureKey,
  getWorldStampTextureKey,
  type NetworkChestState,
  type NetworkGroundEffectState,
  type NetworkMobState,
  type NetworkPlayerState,
  type NetworkProjectileState,
  type PendingRaidInputSample,
  type PendingWorldInputSample,
  type RaidNetworkPlayerState,
  type RaidRoom,
  type RealtimeRoom,
  type WorldRoom,
} from '@/components/game-canvas/networkTypes';
import {
  getBodyAnimationForEquipment,
  hasDominantFireEquipment,
  PLAYER_ANIMATIONS,
  PLAYER_EYE_COLOR,
  PLAYER_FIRE_EYE_COLOR,
  PLAYER_HAND_ANIMATION_OFFSETS,
  SHARED_DEATH_ANIMATION,
  toPlayerAnimationFromEquipmentClip,
  type HandAnimationOffsets,
  type PlayerSheetAnimation,
  type SheetAnimation,
} from '@/components/game-canvas/playerAnimationHelpers';
import {
  applyEquipmentToVisual,
  type PlayerVisualRefs,
} from '@/components/game-canvas/equipmentVisualHelpers';
import type {
  CharacterStatusIconVisual,
  CharacterVisual,
  GroundEffectVisual,
  MobVisual,
  ObjectiveTarget,
  ProjectileVisual,
  RaidTileSpriteVisual,
  WorldMobVisual,
  WorldTraderVisual,
} from '@/components/game-canvas/gameCanvasVisualTypes';
import {
  createCharacterVisual,
  createMobVisual,
  destroyCharacterVisual,
  destroyMobVisual,
} from '@/components/game-canvas/characterVisualFactory';
import { updateCharacterPose as updateCharacterPoseImpl } from '@/components/game-canvas/characterPoseUpdater';
import {
  reconcileRaidLocalCharacter as reconcileRaidLocalCharacterImpl,
  reconcileWorldLocalCharacter as reconcileWorldLocalCharacterImpl,
} from '@/components/game-canvas/reconcileHelpers';
import {
  castFireball as castFireballImpl,
  castFireField as castFireFieldImpl,
  castFireNova as castFireNovaImpl,
  castMouseBoundSkill as castMouseBoundSkillImpl,
  castWoodStaffDash as castWoodStaffDashImpl,
  castWoodStaffStrike as castWoodStaffStrikeImpl,
  getMouseBoundSkill as getMouseBoundSkillImpl,
  type CastContext,
} from '@/components/game-canvas/castHandlers';

type PhaserGame = import('phaser').Game;
const PLAYER_BODY_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.body.key;
const PLAYER_HEAD_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.head.key;
const PLAYER_BODY_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.body.defaultFrame;
const PLAYER_HEAD_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.head.defaultFrame;
const PLAYER_HANDS_TEXTURE_KEY = 'player-hands';
const PLAYER_HANDS_TEXTURE_PATH = '/character/character_hand.png';
const PLAYER_HANDS_FRAME_WIDTH = 4;
const PLAYER_HANDS_FRAME_HEIGHT = 4;
const PLAYER_HANDS_DEFAULT_FRAME = 0;
const WOOD_STAFF_ITEM_ID = 'wood_staff' as const;
const PLAYER_HAND_BASE_OFFSETS = {
  right: { x: 1, y: 11 },
  left: { x: 11, y: 11 },
};
const TRADER_BODY_TEXTURE_KEY = 'body-torso-8x8';
const TRADER_HEAD_TEXTURE_KEY = 'body-head-8x8';

const ENTITY_SORT_SHADOW_OFFSET = 0.24;
const ENTITY_SORT_AURA_OFFSET = 0.12;
const ENTITY_SORT_LABEL_OFFSET = 0.16;
const ENTITY_SORT_EFFECT_OFFSET = 0.04;
const DEBUG_COLLISION_OVERLAY_DEPTH = 4.4;
const DEBUG_COLLISION_TILE_COLOR = 0xff6b6b;
const DEBUG_COLLISION_CHEST_TILE_COLOR = 0xffc857;
const DEBUG_COLLISION_PLAYER_COLOR = 0x5edfff;
const DEBUG_COLLISION_REMOTE_PLAYER_COLOR = 0x8af28a;
const DEBUG_COLLISION_MOB_COLOR = 0xffa552;

export type PlayerEquipment = EquipmentState;
export type ContainerSnapshot = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  slots: Array<string | null>;
};
export type { RealtimeChatMessage };
export type { MinimapSnapshot };

export type WorldTraderInteraction = MeadowTraderAsset;
export type WorldWorkbenchInteraction = {
  id: string;
  x: number;
  y: number;
};
export type TraderQuestMarker = {
  symbol: '!' | '?';
  color: string;
  state: 'available' | 'active' | 'ready';
} | null;

type CharacterEquipment = EquipmentState;




export type ObjectiveArrowState = {
  visible: boolean;
  screenX: number;
  screenY: number;
  rotation: number;
  label: string;
  isOnScreen: boolean;
} | null;





const CLIENT_PLAYER_SPEED = WORLD_GAMEPLAY_PROFILE.playerMoveSpeed;
const CLIENT_RAID_PLAYER_SPEED = RAID_GAMEPLAY_PROFILE.playerMoveSpeed;
const FIRE_TRAIL_CAST_PENALTY_MS = WORLD_GAMEPLAY_PROFILE.fireTrailCastPenaltyMs;
const FIRE_BURST_EXTRA_LOCK_MS = 200;
const FIRE_RANGE_GEM_ID = 'fire_range_gem';
const DEFAULT_MOB_BURN_SCALE = 1;
const STAFF_CAST_RANGE = WORLD_GAMEPLAY_PROFILE.staffCastRange;
const CAST_HELPERS_CONFIG = {
  fireballBaseCastTimeMs: FIREBALL_BASE_CAST_TIME_MS,
  fireTrailCastPenaltyMs: FIRE_TRAIL_CAST_PENALTY_MS,
  fireBurstExtraLockMs: FIRE_BURST_EXTRA_LOCK_MS,
  staffCastRange: STAFF_CAST_RANGE,
  fireRangeGemId: FIRE_RANGE_GEM_ID,
  woodStaffItemId: WOOD_STAFF_ITEM_ID,
};
const RAID_VISIBILITY_UPDATE_INTERVAL_MS = 90;
const RAID_MINIMAP_UPDATE_INTERVAL_MS = 260;
const RAID_OBJECT_VISIBILITY_UPDATE_INTERVAL_MS = 140;
const WORLD_CLIENT_SIMULATION_STEP_MS = 1000 / WORLD_GAMEPLAY_PROFILE.networkTickRate;
const RAID_CLIENT_SIMULATION_STEP_MS = 1000 / RAID_GAMEPLAY_PROFILE.networkTickRate;
const WORLD_REMOTE_INTERPOLATION_DELAY_MS = WORLD_GAMEPLAY_PROFILE.remoteInterpolationDelayMs;
const RAID_REMOTE_INTERPOLATION_DELAY_MS = RAID_GAMEPLAY_PROFILE.remoteInterpolationDelayMs;
const LOCAL_PLAYER_STRONG_DESYNC_TELEPORT_DISTANCE_TILES = 6;
const RAID_VISION_RADIUS_TILES = 6;









export function GameCanvas({
  playerEquipment,
  playerInventory,
  playerName,
  playerPosition,
  playerHealth,
  playerMaxHealth,
  playerLevel,
  playerExperience,
  playerStrength,
  playerAgility,
  playerIntellect,
  playerGold,
  playerQuests,
  playerRole,
  activeSkillTargeting,
  mouseSkillBindings = { LMB: null, RMB: null },
  onChestInteract,
  onNearbyChestChange,
  onTraderInteract,
  onNearbyTraderChange,
  onWorkbenchInteract,
  onNearbyWorkbenchChange,
  getTraderQuestMarker,
  objectiveTarget = null,
  onObjectiveArrowChange,
  onMinimapChange,
  onSkillTargetCancel,
  onFireballCast,
  onHeldConsumableUseSelf,
  onHeldConsumableThrow,
  onSkillCooldownsChange,
  onPlayerVitalsChange,
  onPlayerProgressChange,
  onPlayerPositionChange,
  onPlayerDeath,
  onPlayerInventoryChange,
  onConsumableCooldownChange,
  onPlayerRespawn,
  onRaidExit,
  onRoomConnected,
  respawnRequestNonce,
  fireNovaCastNonce,
  woodStaffStrikeCastNonce,
  woodStaffDashCastNonce,
  useConsumableRequest = null,
  containerStates,
  onContainersStateChange,
  onChatHistory,
  onChatMessage,
  onChatSenderReady,
  skillEffectOverrides = DEFAULT_SKILL_EFFECT_OVERRIDES,
  skillBalanceConfig = DEFAULT_SKILL_BALANCE_CONFIG,
  onSkillBalanceConfigChange,
  mobBalanceConfig = DEFAULT_MOB_BALANCE_CONFIG,
  onMobBalanceConfigChange,
  mobVisualConfig = createDefaultMobVisualConfig(),
  keyboardInputEnabled = true,
  activeRoomName = 'world',
  activeRoomOptions,
  contentVersion = '',
  worldMapAssetOverride = null,
  worldEditorEnabled = false,
  worldEditorMode = 'tile',
  selectedWorldTile = 'grassGround',
  selectedWorldOverlay = { texture: 'ground-grass-edge-8x8', rotation: 0, flipX: false },
  selectedWorldSprite = { texturePath: '', rotation: 0, flipX: false, scale: 1 },
  selectedWorldMob = { kind: 'rat' },
  selectedWorldTrader = { bodyItemId: '', headItemId: '', hairTexturePath: '', hairOffsetX: 0, hairOffsetY: 0 },
  onWorldEditPaint,
  onWorldEditHoverChange,
  onWorldEditDebugChange,
  debugCollisionEnabled = false,
  locale = 'ru',
}: {
  playerEquipment: PlayerEquipment;
  playerInventory: Array<string | null>;
  playerName: string;
  playerPosition: { x: number; y: number };
  playerHealth: number;
  playerMaxHealth: number;
  playerLevel: number;
  playerExperience: number;
  playerStrength: number;
  playerAgility: number;
  playerIntellect: number;
  playerGold: number;
  playerQuests: QuestLog;
  playerRole: string;
  activeSkillTargeting: ActiveTargetingState;
  mouseSkillBindings?: MouseSkillBindings;
  onChestInteract?: (chestId: string) => void;
  onNearbyChestChange?: (chestId: string | null) => void;
  onTraderInteract?: (trader: WorldTraderInteraction) => void;
  onNearbyTraderChange?: (traderId: string | null) => void;
  onWorkbenchInteract?: (workbench: WorldWorkbenchInteraction) => void;
  onNearbyWorkbenchChange?: (workbenchId: string | null) => void;
  getTraderQuestMarker?: (trader: WorldTraderInteraction) => TraderQuestMarker;
  objectiveTarget?: ObjectiveTarget;
  onObjectiveArrowChange?: (state: ObjectiveArrowState) => void;
  onMinimapChange?: (snapshot: MinimapSnapshot | null) => void;
  onSkillTargetCancel?: () => void;
  onFireballCast?: (payload: { x: number; y: number }) => void;
  onHeldConsumableUseSelf?: (payload: { itemId: 'healing_potion' }) => void;
  onHeldConsumableThrow?: (payload: { itemId: 'healing_potion'; x: number; y: number }) => void;
  onSkillCooldownsChange?: (payload: {
    woodStaffStrike: number;
    woodStaffDash: number;
    fireball: number;
    fireNova: number;
    fireField: number;
  }) => void;
  onPlayerVitalsChange?: (payload: { health: number; maxHealth: number }) => void;
  onPlayerProgressChange?: (payload: { level: number; experience: number }) => void;
  onPlayerPositionChange?: (payload: { x: number; y: number }) => void;
  onPlayerDeath?: (payload: DiedMessage) => void;
  onPlayerRespawn?: (payload: RespawnedMessage) => void;
  onPlayerInventoryChange?: (inventory: Array<string | null>) => void;
  onConsumableCooldownChange?: (payload: { itemId: string; cooldownEndsAt: number }) => void;
  onRaidExit?: (payload: RaidExitStateMessage) => void;
  onRoomConnected?: (payload: {
    roomName: 'world' | 'raid';
    options?: Record<string, unknown>;
  }) => void;
  respawnRequestNonce: number;
  fireNovaCastNonce: number;
  woodStaffStrikeCastNonce: number;
  woodStaffDashCastNonce: number;
  useConsumableRequest?: {
    source: 'inventory' | 'container';
    slotIndex: number;
    containerId?: string;
    mode?: 'self' | 'throw';
    targetX?: number;
    targetY?: number;
    nonce: number;
  } | null;
  containerStates?: Record<string, Array<string | null>>;
  onContainersStateChange?: (containers: ContainerSnapshot[]) => void;
  onChatHistory?: (messages: RealtimeChatMessage[]) => void;
  onChatMessage?: (message: RealtimeChatMessage) => void;
  onChatSenderReady?: (sender: ((text: string) => void) | null) => void;
  skillEffectOverrides?: SkillEffectOverrides;
  skillBalanceConfig?: SkillBalanceConfig;
  onSkillBalanceConfigChange?: (config: SkillBalanceConfig) => void;
  mobBalanceConfig?: MobBalanceConfig;
  onMobBalanceConfigChange?: (config: MobBalanceConfig) => void;
  mobVisualConfig?: MobVisualConfig;
  keyboardInputEnabled?: boolean;
  activeRoomName?: 'world' | 'raid';
  activeRoomOptions?: Record<string, unknown>;
  contentVersion?: string;
  worldMapAssetOverride?: MeadowMapAsset | null;
  worldEditorEnabled?: boolean;
  worldEditorMode?: 'tile' | 'sprite' | 'mob' | 'spawn' | 'trader';
  selectedWorldTile?: MeadowTile;
  selectedWorldOverlay?: {
    texture: MeadowOverlayAsset['texture'];
    rotation: number;
    flipX: boolean;
  };
  selectedWorldSprite?: {
    texturePath: string;
    rotation: number;
    flipX: boolean;
    scale: number;
  };
  selectedWorldMob?: {
    kind: MobKind;
  };
  selectedWorldTrader?: {
    bodyItemId: string;
    headItemId: string;
    hairTexturePath: MeadowTraderAsset['hairTexturePath'];
    hairOffsetX: number;
    hairOffsetY: number;
  };
  onWorldEditPaint?: (tileX: number, tileY: number, eraseOverlay?: boolean) => void;
  onWorldEditHoverChange?: (tile: { x: number; y: number } | null) => void;
  onWorldEditDebugChange?: (debug: { textureKey: string; textureLoaded: boolean }) => void;
  debugCollisionEnabled?: boolean;
  locale?: 'ru' | 'en';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerVisualRef = useRef<PlayerVisualRefs | null>(null);
  const roomRef = useRef<RealtimeRoom | null>(null);
  const estimatedOneWayLatencyMsRef = useRef(0);
  const lastPointerWorldRef = useRef({ x: playerPosition.x, y: playerPosition.y });
  const skillCooldownsRef = useRef({
    woodStaffStrike: 0,
    woodStaffDash: 0,
    fireball: 0,
    fireNova: 0,
    fireField: 0,
  });
  const chestInteractRef = useRef(onChestInteract);
  const nearbyChestChangeRef = useRef(onNearbyChestChange);
  const traderInteractRef = useRef(onTraderInteract);
  const nearbyTraderChangeRef = useRef(onNearbyTraderChange);
  const workbenchInteractRef = useRef(onWorkbenchInteract);
  const nearbyWorkbenchChangeRef = useRef(onNearbyWorkbenchChange);
  const traderQuestMarkerRef = useRef(getTraderQuestMarker);
  const objectiveTargetRef = useRef(objectiveTarget);
  const objectiveArrowChangeRef = useRef(onObjectiveArrowChange);
  const minimapChangeRef = useRef(onMinimapChange);
  const activeSkillTargetingRef = useRef(activeSkillTargeting);
  const mouseSkillBindingsRef = useRef(mouseSkillBindings);
  const skillTargetCancelRef = useRef(onSkillTargetCancel);
  const fireballCastRef = useRef(onFireballCast);
  const heldConsumableUseSelfRef = useRef(onHeldConsumableUseSelf);
  const heldConsumableThrowRef = useRef(onHeldConsumableThrow);
  const skillCooldownsChangeRef = useRef(onSkillCooldownsChange);
  const playerVitalsChangeRef = useRef(onPlayerVitalsChange);
  const playerProgressChangeRef = useRef(onPlayerProgressChange);
  const playerPositionChangeRef = useRef(onPlayerPositionChange);
  const playerDeathRef = useRef(onPlayerDeath);
  const playerInventoryChangeRef = useRef(onPlayerInventoryChange);
  const consumableCooldownChangeRef = useRef(onConsumableCooldownChange);
  const beforePlayerRespawnRef = useRef<((payload: RespawnedMessage) => void) | undefined>(undefined);
  const playerRespawnRef = useRef(onPlayerRespawn);
  const roomConnectedRef = useRef(onRoomConnected);
  const raidExitRef = useRef(onRaidExit);
  const serverContainersRef = useRef<Record<string, Array<string | null>>>({});
  const chatHistoryRef = useRef(onChatHistory);
  const chatMessageRef = useRef(onChatMessage);
  const chatSenderReadyRef = useRef(onChatSenderReady);
  const keyboardInputEnabledRef = useRef(keyboardInputEnabled);
  const skillEffectOverridesRef = useRef(skillEffectOverrides);
  const skillBalanceConfigRef = useRef(skillBalanceConfig);
  const skillBalanceConfigChangeRef = useRef(onSkillBalanceConfigChange);
  const mobBalanceConfigRef = useRef(mobBalanceConfig);
  const mobBalanceConfigChangeRef = useRef(onMobBalanceConfigChange);
  const mobVisualConfigRef = useRef(mobVisualConfig);
  const worldEditPaintRef = useRef(onWorldEditPaint);
  const worldEditHoverChangeRef = useRef(onWorldEditHoverChange);
  const worldEditDebugChangeRef = useRef(onWorldEditDebugChange);
  const debugCollisionEnabledRef = useRef(debugCollisionEnabled);
  const worldEditorEnabledRef = useRef(worldEditorEnabled);
  const worldEditorModeRef = useRef(worldEditorMode);
  const selectedWorldTileRef = useRef(selectedWorldTile);
  const selectedWorldOverlayRef = useRef(selectedWorldOverlay);
  const selectedWorldSpriteRef = useRef(selectedWorldSprite);
  const selectedWorldMobRef = useRef(selectedWorldMob);
  const selectedWorldTraderRef = useRef(selectedWorldTrader);
  const worldMapAssetOverrideRef = useRef(worldMapAssetOverride);
  const worldMapAssetOverrideSerializedRef = useRef(JSON.stringify(worldMapAssetOverride));
  const lastNotifiedNearbyChestIdRef = useRef<string | null>(null);
  const lastNotifiedNearbyTraderIdRef = useRef<string | null>(null);
  const lastNotifiedNearbyWorkbenchIdRef = useRef<string | null>(null);
  const lastNotifiedPlayerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastWorldHoverTileRef = useRef<string | null>(null);
  const lastWorldEditDebugRef = useRef<string>('{"textureKey":"","textureLoaded":false}');
  const hasReceivedSkillBalanceRef = useRef(false);
  const lastKnownSkillBalanceSerializedRef = useRef(JSON.stringify(skillBalanceConfig));
  const hasReceivedMobBalanceRef = useRef(false);
  const lastKnownMobBalanceSerializedRef = useRef(JSON.stringify(mobBalanceConfig));
  const sessionTokenRef = useRef(getStoredSessionToken());
  const contentVersionRef = useRef(contentVersion);
  const pendingRespawnNonceRef = useRef(0);
  const lastSentRespawnNonceRef = useRef(0);
  const latestProfileRef = useRef({
    playerName,
    playerEquipment,
    playerPosition,
    playerHealth,
    playerMaxHealth,
    playerLevel,
    playerExperience,
    playerStrength,
    playerAgility,
    playerIntellect,
    playerGold,
    playerQuests,
    playerRole,
    playerInventory,
  });
  const activeRaidRunId =
    activeRoomName === 'raid' && typeof activeRoomOptions?.raidRunId === 'string'
      ? activeRoomOptions.raidRunId
      : null;

  useRefSync(chestInteractRef, onChestInteract);
  useRefSync(nearbyChestChangeRef, onNearbyChestChange);
  useRefSync(traderInteractRef, onTraderInteract);
  useRefSync(nearbyTraderChangeRef, onNearbyTraderChange);
  useRefSync(workbenchInteractRef, onWorkbenchInteract);
  useRefSync(nearbyWorkbenchChangeRef, onNearbyWorkbenchChange);
  useRefSync(traderQuestMarkerRef, getTraderQuestMarker);
  useRefSync(objectiveTargetRef, objectiveTarget);
  useRefSync(objectiveArrowChangeRef, onObjectiveArrowChange);
  useRefSync(minimapChangeRef, onMinimapChange);
  useRefSync(activeSkillTargetingRef, activeSkillTargeting);
  useRefSync(mouseSkillBindingsRef, mouseSkillBindings);
  useRefSync(skillTargetCancelRef, onSkillTargetCancel);
  useRefSync(fireballCastRef, onFireballCast);
  useRefSync(heldConsumableUseSelfRef, onHeldConsumableUseSelf);
  useRefSync(heldConsumableThrowRef, onHeldConsumableThrow);
  useRefSync(skillCooldownsChangeRef, onSkillCooldownsChange);
  useRefSync(playerVitalsChangeRef, onPlayerVitalsChange);
  useEffect(() => {
    lastPointerWorldRef.current = { x: playerPosition.x, y: playerPosition.y };
  }, [playerPosition.x, playerPosition.y]);
  useRefSync(playerProgressChangeRef, onPlayerProgressChange);
  useRefSync(playerPositionChangeRef, onPlayerPositionChange);
  useRefSync(playerDeathRef, onPlayerDeath);
  useRefSync(playerInventoryChangeRef, onPlayerInventoryChange);
  useRefSync(consumableCooldownChangeRef, onConsumableCooldownChange);
  useRefSync(playerRespawnRef, onPlayerRespawn);
  useRefSync(roomConnectedRef, onRoomConnected);
  useRefSync(raidExitRef, onRaidExit);
  useRefSync(worldEditPaintRef, onWorldEditPaint);
  useRefSync(worldEditHoverChangeRef, onWorldEditHoverChange);
  useRefSync(worldEditDebugChangeRef, onWorldEditDebugChange);
  useRefSync(debugCollisionEnabledRef, debugCollisionEnabled);
  useRefSync(worldEditorEnabledRef, worldEditorEnabled);
  useRefSync(worldEditorModeRef, worldEditorMode);
  useRefSync(selectedWorldTileRef, selectedWorldTile);
  useRefSync(selectedWorldOverlayRef, selectedWorldOverlay);
  useRefSync(selectedWorldSpriteRef, selectedWorldSprite);
  useRefSync(selectedWorldMobRef, selectedWorldMob);
  useRefSync(selectedWorldTraderRef, selectedWorldTrader);
  useEffect(() => {
    worldMapAssetOverrideRef.current = worldMapAssetOverride;
    worldMapAssetOverrideSerializedRef.current = JSON.stringify(worldMapAssetOverride);
  }, [worldMapAssetOverride]);
  useRefSync(chatHistoryRef, onChatHistory);
  useRefSync(chatMessageRef, onChatMessage);
  useRefSync(chatSenderReadyRef, onChatSenderReady);
  useRefSync(keyboardInputEnabledRef, keyboardInputEnabled);
  useRefSync(skillEffectOverridesRef, skillEffectOverrides);
  useRefSync(skillBalanceConfigRef, skillBalanceConfig);
  useRefSync(mobBalanceConfigRef, mobBalanceConfig);
  useRefSync(mobVisualConfigRef, mobVisualConfig);
  useEffect(() => {
    sessionTokenRef.current = getStoredSessionToken();
  }, [playerName]);
  useRefSync(contentVersionRef, contentVersion);
  useRefSync(skillBalanceConfigChangeRef, onSkillBalanceConfigChange);
  useRefSync(mobBalanceConfigChangeRef, onMobBalanceConfigChange);

  useEffect(() => {
    latestProfileRef.current = {
      playerName,
      playerEquipment,
      playerPosition,
      playerHealth,
      playerMaxHealth,
      playerLevel,
      playerExperience,
      playerStrength,
      playerAgility,
      playerIntellect,
      playerGold,
      playerQuests,
      playerRole,
      playerInventory,
    };
  }, [
    playerEquipment,
    playerExperience,
    playerHealth,
    playerInventory,
    playerAgility,
    playerIntellect,
    playerLevel,
    playerMaxHealth,
    playerName,
    playerPosition,
    playerRole,
    playerStrength,
    playerGold,
    playerQuests,
  ]);

  const {
    attachRoomInboundHandlers,
    syncProjectilesFromRoom: syncProjectilesFromRoomShared,
    syncGroundEffectsFromRoom: syncGroundEffectsFromRoomShared,
    syncMobsFromRoom: syncMobsFromRoomShared,
    setMobVisibility: setMobVisibilityShared,
    syncPlayersFromRoom: syncPlayersFromRoomShared,
    setCharacterVisibility: setCharacterVisibilityShared,
  } = useGameCanvasRoomSync({
    inbound: {
      chatHistoryRef,
      chatMessageRef,
      hasReceivedSkillBalanceRef,
      lastKnownSkillBalanceSerializedRef,
      skillBalanceConfigChangeRef,
      hasReceivedMobBalanceRef,
      lastKnownMobBalanceSerializedRef,
      mobBalanceConfigChangeRef,
      playerDeathRef,
      beforePlayerRespawnRef,
      playerRespawnRef,
      playerInventoryChangeRef,
      consumableCooldownChangeRef,
      raidExitRef,
    },
    outbound: {
      activeRoomName,
      playerRole,
      playerProfile: {
        playerName,
        playerRole,
        playerPosition,
        playerHealth,
        playerMaxHealth,
        playerLevel,
        playerExperience,
        playerStrength,
        playerAgility,
        playerIntellect,
        playerGold,
        playerQuests,
        playerInventory,
        playerEquipment,
      },
      roomRef,
      skillBalanceConfig,
      mobBalanceConfig,
      hasReceivedSkillBalanceRef,
      lastKnownSkillBalanceSerializedRef,
      hasReceivedMobBalanceRef,
      lastKnownMobBalanceSerializedRef,
      useConsumableRequest,
      containerStates,
      serverContainersRef,
      respawnRequestNonce,
      pendingRespawnNonceRef,
      lastSentRespawnNonceRef,
      fireNovaCastNonce,
      woodStaffStrikeCastNonce,
      woodStaffDashCastNonce,
      sessionTokenRef,
      contentVersionRef,
      estimatedOneWayLatencyMsRef,
      lastPointerWorldRef,
      skillCooldownsRef,
      createWorldProfileMessage,
      createTimedCastSkillMessage,
    },
  });

  useEffect(() => {
    let game: PhaserGame | null = null;
    let mounted = true;
    const resolvedSkillEffects = {
      fireball: { ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireball, ...skillEffectOverridesRef.current.fireball },
      fireNova: { ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireNova, ...skillEffectOverridesRef.current.fireNova },
      fireField: { ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireField, ...skillEffectOverridesRef.current.fireField },
    };
    const projectileAnimations = {
      fireball: createSkillAnimation('fireball', resolvedSkillEffects.fireball),
      fireNova: createSkillAnimation('fireNova', resolvedSkillEffects.fireNova),
    };
    const groundAnimation = createSkillAnimation('fireField', resolvedSkillEffects.fireField);

    const bootstrap = async () => {
      if (!containerRef.current) {
        return;
      }

      const Phaser = await import('phaser');
      const { Client } = await import('@colyseus/sdk');

      if (!mounted || !containerRef.current) {
        return;
      }

      const isRaidScene = activeRoomName === 'raid';
      const clientSimulationStepMs = isRaidScene
        ? RAID_CLIENT_SIMULATION_STEP_MS
        : WORLD_CLIENT_SIMULATION_STEP_MS;
      const remoteInterpolationDelayMs = isRaidScene
        ? RAID_REMOTE_INTERPOLATION_DELAY_MS
        : WORLD_REMOTE_INTERPOLATION_DELAY_MS;
      const maxPendingInputHistory = Math.max(
        90,
        Math.ceil((isRaidScene ? RAID_GAMEPLAY_PROFILE.networkTickRate : WORLD_GAMEPLAY_PROFILE.networkTickRate) * 3),
      );
      const meadowAsset =
        worldMapAssetOverride && !isRaidScene
          ? worldMapAssetOverride
          : isRaidScene
            ? createDefaultMeadowMapAsset()
            : await loadWorldMapAsset();
      const meadowMap = createMeadowMapFromAsset(meadowAsset);
      const meadowDecorations = createMeadowDecorationsFromAsset(meadowAsset);
      const meadowStamps = createMeadowStampsFromAsset(meadowAsset);
      const equipmentItems = Object.values(EQUIPMENT_ITEMS);
      const tileSize = meadowMap.tileSize;
      const raidWidth = Math.max(12, Number(activeRoomOptions?.width) || 30);
      const raidHeight = Math.max(8, Number(activeRoomOptions?.height) || 20);

      class MeadowScene extends Phaser.Scene {
        constructor() {
          super('meadow');
        }

        preload() {
          this.load.image('grass-8x8', '/sprites/terrain/grass-8x8.png');
          this.load.image('ground-8x8', '/sprites/terrain/ground-8x8.png');
          this.load.image('ground-grass-edge-8x8', '/sprites/terrain/ground-grass-top-8x8.png');
          this.load.image('ground-grass-corner-8x8', '/sprites/terrain/ground-grass-corner-tl-8x8.png');
          this.load.image('crypt-floor-8x8', '/sprites/terrain/crypt-floor-8x8.png');
          this.load.image('crypt-floor-cracked-8x8', '/sprites/terrain/crypt-floor-cracked-8x8.png');
          this.load.image('crypt-wall-8x8', '/sprites/terrain/crypt-wall-8x8.png');
          this.load.image('water-8x8', '/sprites/terrain/water-8x8.png');
          this.load.image('rock-1-8x8', '/sprites/decor/rock-1-8x8.png');
          this.load.image('rock-2-8x8', '/sprites/decor/rock-2-8x8.png');
          this.load.image('chest-8x8', '/sprites/decor/chest-8x8.png');
          this.load.image('loot-bag-8x8', '/sprites/decor/loot-bag-8x8.png');
          this.load.image('flower-pink-8x8', '/sprites/decor/flower-pink-8x8.png');
          this.load.image('flower-yellow-8x8', '/sprites/decor/flower-yellow-8x8.png');
          this.load.image('flower-blue-8x8', '/sprites/decor/flower-blue-8x8.png');
          if (DEFAULT_PLAYER_VISUALS.body.frameWidth && DEFAULT_PLAYER_VISUALS.body.frameHeight) {
            this.load.spritesheet(PLAYER_BODY_TEXTURE_KEY, DEFAULT_PLAYER_VISUALS.body.texturePath, {
              frameWidth: DEFAULT_PLAYER_VISUALS.body.frameWidth,
              frameHeight: DEFAULT_PLAYER_VISUALS.body.frameHeight,
            });
          } else {
            this.load.image(PLAYER_BODY_TEXTURE_KEY, DEFAULT_PLAYER_VISUALS.body.texturePath);
          }
          this.load.spritesheet(PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_TEXTURE_PATH, {
            frameWidth: PLAYER_HANDS_FRAME_WIDTH,
            frameHeight: PLAYER_HANDS_FRAME_HEIGHT,
          });
          if (DEFAULT_PLAYER_VISUALS.head.frameWidth && DEFAULT_PLAYER_VISUALS.head.frameHeight) {
            this.load.spritesheet(PLAYER_HEAD_TEXTURE_KEY, DEFAULT_PLAYER_VISUALS.head.texturePath, {
              frameWidth: DEFAULT_PLAYER_VISUALS.head.frameWidth,
              frameHeight: DEFAULT_PLAYER_VISUALS.head.frameHeight,
            });
          } else {
            this.load.image(PLAYER_HEAD_TEXTURE_KEY, DEFAULT_PLAYER_VISUALS.head.texturePath);
          }
          this.load.image(TRADER_HEAD_TEXTURE_KEY, '/sprites/characters/body-head-8x8.png');
          this.load.image(TRADER_BODY_TEXTURE_KEY, '/sprites/characters/body-torso-8x8.png');
          Object.values(PLAYER_ANIMATIONS).forEach((animation) => {
            loadSpriteSheetAnimation(this, animation);
          });
          const loadedEquipmentAnimationKeys = new Set<string>();
          BODY_EQUIPMENT_IDS.forEach((itemId) => {
            const visual = getEquipmentVisual(itemId);
            Object.values(visual?.animations ?? {}).forEach((clip) => {
              if (!clip || loadedEquipmentAnimationKeys.has(clip.textureKey)) {
                return;
              }

              loadedEquipmentAnimationKeys.add(clip.textureKey);
              loadSpriteSheetAnimation(this, toPlayerAnimationFromEquipmentClip(clip));
            });
          });
          loadSpriteSheetAnimation(this, SHARED_DEATH_ANIMATION);
          this.load.spritesheet('skeleton', '/npc/skeleton/skeleton.png', {
            frameWidth: 32,
            frameHeight: 32,
          });
          this.load.image('skeleton-npc-16x16', '/sprites/characters/skeleton-npc-16x16.png');
          this.load.image('bat_1', '/npc/bat/bat_1.png');
          this.load.image('bat_2', '/npc/bat/bat_2.png');
          this.load.image('rat_1', '/npc/rat/rat_1.png');
          this.load.image('rat_2', '/npc/rat/rat_2.png');
          loadSpriteSheetAnimation(this, projectileAnimations.fireball);
          loadSpriteSheetAnimation(this, projectileAnimations.fireNova);
          loadSpriteSheetAnimation(this, groundAnimation);

          equipmentItems.forEach((item) => {
            this.load.image(item.textureKey, item.texturePath);
            item.worldEffects?.forEach((effect) => {
              if (effect.frameCount && effect.frameDurationMs) {
                loadSpriteSheetAnimation(this, {
                  textureKey: effect.textureKey,
                  texturePath: effect.texturePath,
                  frameWidth: effect.frameWidth ?? 32,
                  frameHeight: effect.frameHeight ?? 32,
                });
              } else {
                this.load.image(effect.textureKey, effect.texturePath);
              }
            });
          });
        }

        create() {
          let sceneActive = true;
          resolveSpriteSheetAnimationColumns(this, projectileAnimations.fireball);
          resolveSpriteSheetAnimationColumns(this, projectileAnimations.fireNova);
          resolveSpriteSheetAnimationColumns(this, groundAnimation);
          resolveSpriteSheetAnimationColumns(this, SHARED_DEATH_ANIMATION);
          Object.values(PLAYER_ANIMATIONS).forEach((animation) => {
            resolveSpriteSheetAnimationColumns(this, animation);
          });
          const camera = this.cameras.main;
          camera.roundPixels = true;
          this.input.keyboard?.disableGlobalCapture();
          const cursors = this.input.keyboard
            ? {
              left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false, false),
              right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false, false),
              up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false, false),
              down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false, false),
            }
            : undefined;
          const interactKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.F,
            false,
            false,
          );
          const wasd = this.input.keyboard
            ? {
              up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false, false),
              down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false, false),
              left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false, false),
              right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false, false),
            }
            : undefined;

          const networkClient = new Client(getRealtimeEndpoint());
          const characters = new Map<string, CharacterVisual>();
          const mobs = new Map<string, MobVisual>();
          const getMovementMobBlockers = () =>
            Array.from(mobs.values()).flatMap((mob) =>
              mob.isDead
                ? []
                : [{
                  x: mob.sprite.x,
                  y: getPlayerMobCollisionCenterY(mob.sprite.y),
                  halfWidth: WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfWidth,
                  halfHeight: WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfHeight,
                }],
            );
          const completedDeadPlayerIds = new Set<string>();
          const completedDeadMobIds = new Set<string>();
          const groundEffects = new Map<string, GroundEffectVisual>();
          const projectileSprites = new Map<string, ProjectileVisual>();
          const chestSprites = new Map<string, Phaser.GameObjects.Image>();
          let raidBlockedTiles = new Uint8Array(0);
          let raidChestBlockedTiles = new Uint8Array(0);
          const raidTileSprites = new Map<number, RaidTileSpriteVisual>();
          const raidExitSprites = new Map<
            string,
            {
              ring: Phaser.GameObjects.Ellipse;
              core: Phaser.GameObjects.Ellipse;
              label: Phaser.GameObjects.Text;
            }
          >();
          const worldTileSprites: Phaser.GameObjects.Image[] = [];
          const worldOverlaySprites: Phaser.GameObjects.Image[] = [];
          const worldDecorationSprites: Phaser.GameObjects.Image[] = [];
          const worldStampSprites: Phaser.GameObjects.Image[] = [];
          const worldStampSpritesByTile = new Map<string, Phaser.GameObjects.Image>();
          const worldMobVisuals = new Map<string, WorldMobVisual>();
          const worldTraderVisuals = new Map<string, WorldTraderVisual>();
          const collisionDebugGraphics = this.add.graphics().setDepth(DEBUG_COLLISION_OVERLAY_DEPTH);
          const worldTradersById = new Map<string, MeadowTraderAsset>();
          const pendingWorldTextureKeys = new Set<string>();
          const pendingWorldTraderSheetKeys = new Set<string>();
          const pendingMobClipKeys = new Set<string>();
          const worldMapRenderState = {
            spawnMarker: null as Phaser.GameObjects.Container | null,
            currentAsset: meadowAsset,
          };
          let appliedWorldAssetSerialized = worldMapAssetOverrideSerializedRef.current;
          let raidTilesData: string[] = [];
          const exploredRaidTiles = new Set<number>();
          let visibleRaidTiles = new Set<number>();
          let lastStoredRaidExploredSerialized = '';
          let lastRaidVisionOriginKey = '';
          let room: RealtimeRoom | null = null;
          let localSessionId = '';
          let previousInput = '0:0';
          let lastLookX = 0;
          let lastLookY = 1;
          let lastRaidTilesWidth = 0;
          let lastRaidTilesHeight = 0;
          let lastRaidVisibilityRenderKey = '';
          let lastRaidVisibilityUpdateAt = 0;
          let lastRaidObjectVisibilityUpdateAt = 0;
          let latencyPingIntervalId: number | null = null;
          let nextRaidInputSequence = 1;
          let lastProcessedRaidInput = 0;
          let pendingRaidInputs: PendingRaidInputSample[] = [];
          let nextWorldInputSequence = 1;
          let lastProcessedWorldInput = 0;
          let pendingWorldInputs: PendingWorldInputSample[] = [];
          let movementSimulationAccumulatorMs = 0;
          let lastPositionSyncAt = 0;
          const maxCastRewindMs = Math.max(
            WORLD_GAMEPLAY_PROFILE.lagCompensationMaxRewindMs,
            RAID_GAMEPLAY_PROFILE.lagCompensationMaxRewindMs,
          );
          const stopLatencyPing = () => {
            if (latencyPingIntervalId !== null) {
              window.clearInterval(latencyPingIntervalId);
              latencyPingIntervalId = null;
            }
            estimatedOneWayLatencyMsRef.current = 0;
          };
          const sampleCastLatency = () => {
            if (!room || !sceneActive) {
              return;
            }

            room.ping((roundTripMs) => {
              if (!sceneActive) {
                return;
              }
              estimatedOneWayLatencyMsRef.current = Math.max(
                0,
                Math.min(maxCastRewindMs, Math.round(roundTripMs / 2)),
              );
            });
          };
          const startLatencyPing = () => {
            stopLatencyPing();
            sampleCastLatency();
            latencyPingIntervalId = window.setInterval(sampleCastLatency, 2000);
          };
          let lastSyncedPositionX = latestProfileRef.current.playerPosition.x;
          let lastSyncedPositionY = latestProfileRef.current.playerPosition.y;
          beforePlayerRespawnRef.current = ({ x, y }) => {
            pendingRaidInputs = [];
            pendingWorldInputs = [];
            lastProcessedRaidInput = 0;
            lastProcessedWorldInput = 0;
            movementSimulationAccumulatorMs = 0;
            previousInput = '0:0';
            lastSyncedPositionX = x;
            lastSyncedPositionY = y;
            lastPositionSyncAt = this.time.now;

            if (!localSessionId) {
              return;
            }

            const localCharacter = characters.get(localSessionId);
            if (!localCharacter) {
              return;
            }

            localCharacter.simPrevX = x;
            localCharacter.simPrevY = y;
            localCharacter.simX = x;
            localCharacter.simY = y;
            localCharacter.simErrorX = 0;
            localCharacter.simErrorY = 0;
            localCharacter.targetX = x;
            localCharacter.targetY = y;
            localCharacter.container.setPosition(x, y);
          };
          const movementState = {
            getPendingRaidInputs: () => pendingRaidInputs,
            setPendingRaidInputs: (next: PendingRaidInputSample[]) => {
              pendingRaidInputs = next;
            },
            getPendingWorldInputs: () => pendingWorldInputs,
            setPendingWorldInputs: (next: PendingWorldInputSample[]) => {
              pendingWorldInputs = next;
            },
            getLastProcessedRaidInput: () => lastProcessedRaidInput,
            setLastProcessedRaidInput: (value: number) => {
              lastProcessedRaidInput = value;
            },
            getLastProcessedWorldInput: () => lastProcessedWorldInput,
            setLastProcessedWorldInput: (value: number) => {
              lastProcessedWorldInput = value;
            },
          };
          const positionSyncState = {
            setLastSyncedPosition: (x: number, y: number, at: number) => {
              lastSyncedPositionX = x;
              lastSyncedPositionY = y;
              lastPositionSyncAt = at;
            },
          };
          let canOpenChest = false;
          let interactableChestId: string | null = null;
          let canInteractWithTrader = false;
          let interactableTraderId: string | null = null;
          let canInteractWithWorkbench = false;
          let interactableWorkbenchId: string | null = null;
          let canUseRaidExit = false;
          let interactableRaidExitId: string | null = null;
          const statusText = this.add
            .text(24, 118, isRaidScene ? 'Connecting to raid...' : 'Connecting to world...', {
              color: '#d7efc9',
              fontFamily: 'Georgia, serif',
              fontSize: '18px',
            })
            .setScrollFactor(0);
          const chestPrompt = this.add
            .text(0, 0, `F ${locale === 'en' ? 'open' : 'открыть'}`, {
              color: '#fff4cf',
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              fontStyle: 'bold',
              stroke: '#2a160a',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(30);
          chestPrompt.setText(`F ${locale === 'en' ? 'open' : 'открыть'}`);
          chestPrompt.setText(`F ${locale === 'en' ? 'open' : 'открыть'}`);
          const objectivePulse = this.add
            .circle(0, 0, Math.max(14, tileSize * 0.48), 0xffe28a, 0.14)
            .setVisible(false)
            .setDepth(18)
            .setStrokeStyle(3, 0xffe28a, 0.82);

          const targetingCursor = this.add
            .text(0, 0, 'X', {
              color: '#ffd18a',
              fontFamily: 'monospace',
              fontSize: '22px',
              fontStyle: 'bold',
              stroke: '#4a1b0c',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(40);
          const worldEditPreviewBase = this.add
            .image(0, 0, 'grass-8x8')
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(38.5)
            .setAlpha(0.72);
          const worldEditPreviewOverlay = this.add
            .image(0, 0, 'ground-grass-edge-8x8')
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(39.2)
            .setAlpha(0.9);
          const worldEditPreviewSprite = this.add
            .image(0, 0, 'ground-8x8')
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(39.2)
            .setAlpha(0.9);
          const worldEditSpawnPreview = this.add
            .container(0, 0, [
              this.add.circle(0, 0, 9, 0xd7f0b6, 0.18).setStrokeStyle(2, 0xe8ffd0, 0.95),
              this.add.circle(0, 0, 3, 0xe8ffd0, 1),
            ])
            .setVisible(false)
            .setDepth(39.4);
          const worldEditTraderShadow = this.add
            .ellipse(0, 15, 24, 8, 0x000000, 0.18)
            .setVisible(false)
            .setDepth(38.8);
          const worldEditTraderContainer = this.add.container(0, 0, []).setVisible(false).setDepth(39.3);
          const worldEditTraderEyePixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
          const worldEditTraderBodyDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, tileSize);
          const worldEditTraderHeadDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, tileSize);
          const worldEditTraderBodyBase = this.add
            .image(0, 0, PLAYER_ANIMATIONS.idle?.textureKey ?? PLAYER_BODY_TEXTURE_KEY, PLAYER_BODY_DEFAULT_FRAME)
            .setDisplaySize(worldEditTraderBodyDisplay.width, worldEditTraderBodyDisplay.height)
            .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.body.anchorY)
            .setAlpha(0.82);
          const worldEditTraderBodyLayer = this.add
            .image(0, 0, TRADER_BODY_TEXTURE_KEY)
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setAlpha(0.92);
          const worldEditTraderHeadBase = this.add
            .image(0, 0, PLAYER_HEAD_TEXTURE_KEY, PLAYER_HEAD_DEFAULT_FRAME)
            .setDisplaySize(worldEditTraderHeadDisplay.width, worldEditTraderHeadDisplay.height)
            .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.head.anchorY)
            .setAlpha(0.82);
          const worldEditTraderHairLayer = this.add
            .image(0, 0, TRADER_HEAD_TEXTURE_KEY)
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setAlpha(0.94);
          const worldEditTraderHeadLayer = this.add
            .image(0, 0, TRADER_HEAD_TEXTURE_KEY)
            .setDisplaySize(tileSize, tileSize)
            .setOrigin(0.5)
            .setVisible(false)
            .setAlpha(0.96);
          const worldEditTraderLeftEye = this.add
            .rectangle(0, 0, worldEditTraderEyePixelSize, worldEditTraderEyePixelSize, PLAYER_EYE_COLOR, 1)
            .setOrigin(0.5)
            .setAlpha(0.92);
          const worldEditTraderRightEye = this.add
            .rectangle(0, 0, worldEditTraderEyePixelSize, worldEditTraderEyePixelSize, PLAYER_EYE_COLOR, 1)
            .setOrigin(0.5)
            .setAlpha(0.92);
          const worldEditLeftEyePosition = getEyeLocalPosition('down', 'left', tileSize);
          const worldEditRightEyePosition = getEyeLocalPosition('down', 'right', tileSize);
          worldEditTraderLeftEye.setPosition(worldEditLeftEyePosition.x, worldEditLeftEyePosition.y);
          worldEditTraderRightEye.setPosition(worldEditRightEyePosition.x, worldEditRightEyePosition.y);
          worldEditTraderContainer.add([
            worldEditTraderBodyBase,
            worldEditTraderBodyLayer,
            worldEditTraderHeadBase,
            worldEditTraderHairLayer,
            worldEditTraderLeftEye,
            worldEditTraderRightEye,
            worldEditTraderHeadLayer,
          ]);
          const worldEditorInput = createWorldEditorInputHandler({
            scene: this,
            camera,
            tileSize,
            meadowWidth: meadowMap.width,
            meadowHeight: meadowMap.height,
            isRaidScene,
            worldEditorEnabledRef,
            worldEditorModeRef,
            selectedWorldSpriteRef,
            worldEditPaintRef,
            worldStampSprites,
            worldStampSpritesByTile,
            getWorldStampTextureKey,
          });
          const castRangeIndicator = this.add
            .circle(0, 0, STAFF_CAST_RANGE, 0xffb15a, 0.05)
            .setStrokeStyle(2, 0xffd59a, 0.35)
            .setVisible(false)
            .setDepth(38);
          const targetingPreviewTiles = Array.from({ length: 9 }, () =>
            this.add
              .rectangle(0, 0, tileSize, tileSize, 0xff8b2a, 0.18)
              .setStrokeStyle(1, 0xffd38a, 0.55)
              .setOrigin(0.5)
              .setVisible(false)
              .setDepth(39),
          );
          const thrownConsumables: ThrownConsumableVisual[] = [];
          const mapWidth = (isRaidScene ? raidWidth : meadowMap.width) * tileSize;
          const mapHeight = (isRaidScene ? raidHeight : meadowMap.height) * tileSize;
          const meadowMinimapTiles = meadowMap.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              if (isBlockedMeadowTile(meadowDecorations, meadowStamps, x, y)) {
                return 'blocked';
              }

              return tile;
            }),
          );
          const minimapEmitter = createMinimapEmitter({
            tileSize,
            meadowWidth: meadowMap.width,
            meadowHeight: meadowMap.height,
            meadowTiles: meadowMinimapTiles,
            raidMinimapUpdateIntervalMs: RAID_MINIMAP_UPDATE_INTERVAL_MS,
            onMinimapChange: (snapshot) => {
              minimapChangeRef.current?.(snapshot);
            },
          });
          camera.setBackgroundColor(isRaidScene ? '#1d1a16' : '#6fbe4a');
          camera.setBounds(0, 0, mapWidth, mapHeight);
          camera.setZoom(2.25);
          camera.roundPixels = true;
          camera.setDeadzone(72, 48);
          this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

          const ensureWorldTextureLoaded = (texturePath: string) => {
            const textureKey = getWorldStampTextureKey(texturePath);
            if (this.textures.exists(textureKey) || pendingWorldTextureKeys.has(textureKey)) {
              return textureKey;
            }

            pendingWorldTextureKeys.add(textureKey);
            const image = new window.Image();
            image.onload = () => {
              if (!this.textures.exists(textureKey)) {
                this.textures.addImage(textureKey, image);
              }
              pendingWorldTextureKeys.delete(textureKey);
              if (!isRaidScene) {
                renderWorldMap(worldMapAssetOverrideRef.current ?? worldMapRenderState.currentAsset);
              }
            };
            image.onerror = () => {
              pendingWorldTextureKeys.delete(textureKey);
            };
            image.src = texturePath;
            return textureKey;
          };

          const ensureWorldTraderBodyOverlayLoaded = (texturePath: string) => {
            const overlayAnimation = getWorldTraderBodyOverlayAnimation(
              texturePath,
              PLAYER_ANIMATIONS.idle,
            );
            if (!overlayAnimation) {
              return ensureWorldTextureLoaded(texturePath);
            }

            const textureKey = overlayAnimation.textureKey;
            if (this.textures.exists(textureKey) || pendingWorldTraderSheetKeys.has(textureKey)) {
              return textureKey;
            }

            pendingWorldTraderSheetKeys.add(textureKey);
            loadSpriteSheetAnimation(this, overlayAnimation);
            this.load.once('complete', () => {
              pendingWorldTraderSheetKeys.delete(textureKey);
              if (!isRaidScene) {
                renderWorldMap(worldMapAssetOverrideRef.current ?? worldMapRenderState.currentAsset);
              }
            });
            this.load.start();
            return textureKey;
          };

          const ensureWorldTraderSpriteSheetLoaded = (trader: MeadowTraderAsset) => {
            if (!trader.spriteSheetPath || !trader.frameWidth || !trader.frameHeight) {
              return '';
            }

            const textureKey = getWorldTraderSpriteSheetKey(trader.spriteSheetPath);
            if (this.textures.exists(textureKey) || pendingWorldTraderSheetKeys.has(textureKey)) {
              return textureKey;
            }

            pendingWorldTraderSheetKeys.add(textureKey);
            this.load.spritesheet(textureKey, trader.spriteSheetPath, {
              frameWidth: trader.frameWidth,
              frameHeight: trader.frameHeight,
            });
            this.load.once('complete', () => {
              pendingWorldTraderSheetKeys.delete(textureKey);
              if (!isRaidScene) {
                renderWorldMap(worldMapAssetOverrideRef.current ?? worldMapRenderState.currentAsset);
              }
            });
            this.load.start();
            return textureKey;
          };

          const getPreferredMobClip = (texture: string, state?: MobAnimationState) => {
            const kind = getMobVisualKind(texture);
            if (!kind) {
              return null;
            }

            const definition = mobVisualConfigRef.current[kind];
            const clipKey =
              (state ? definition.states[state] : undefined) ??
              definition.states.move ??
              definition.states.idle ??
              Object.keys(definition.clips)[0];
            return clipKey ? definition.clips[clipKey] ?? null : null;
          };

          const ensureMobClipLoaded = (clip: MobAnimationClipDefinition) => {
            const runtimeClip = toRuntimeAnimationFromMobClip(clip);
            if (!runtimeClip.texturePath) {
              return null;
            }
            const textureKey = runtimeClip.textureKey;
            if (this.textures.exists(textureKey) || pendingMobClipKeys.has(textureKey)) {
              return textureKey;
            }

            pendingMobClipKeys.add(textureKey);
            loadSpriteSheetAnimation(this, runtimeClip);
            this.load.once('complete', () => {
              pendingMobClipKeys.delete(textureKey);
            });
            this.load.start();
            return textureKey;
          };

          const resolveMobRenderState = (
            texture: string,
            timeMs: number,
            state?: MobAnimationState,
            animationStartedAt?: number,
          ) => {
            const kind = getMobVisualKind(texture);
            const clip = getPreferredMobClip(texture, state);
            if (kind && clip) {
              const runtimeClip = toRuntimeAnimationFromMobClip(clip);
              const textureKey = ensureMobClipLoaded(clip);
              if (textureKey && this.textures.exists(textureKey)) {
                const animationTimeMs =
                  typeof animationStartedAt === 'number' && animationStartedAt > 0
                    ? Math.max(0, timeMs - animationStartedAt)
                    : timeMs;
                const frame = getSpriteSheetAnimationFrame(runtimeClip, animationTimeMs);
                return {
                  textureKey,
                  frame,
                  renderScale: mobVisualConfigRef.current[kind].spriteScale,
                  anchorY: mobVisualConfigRef.current[kind].anchorY,
                };
              }
            }

            return {
              textureKey: getAnimatedMobTexture(texture, timeMs),
              frame: undefined,
              renderScale: getMobRenderScale(texture),
              anchorY: 0.5,
            };
          };

          const renderWorldMap = (asset: MeadowMapAsset) => {
            renderWorldMapScene({
              scene: this,
              asset,
              state: worldMapRenderState,
              tileSize,
              isAdmin: playerRole.toLowerCase() === 'admin',
              worldTileSprites,
              worldOverlaySprites,
              worldDecorationSprites,
              worldStampSprites,
              worldStampSpritesByTile,
              worldMobVisuals,
              worldTraderVisuals,
              worldTradersById,
              playerAnimations: PLAYER_ANIMATIONS,
              playerEyeColor: PLAYER_EYE_COLOR,
              playerBodyTextureKey: PLAYER_BODY_TEXTURE_KEY,
              playerBodyDefaultFrame: PLAYER_BODY_DEFAULT_FRAME ?? 0,
              playerHeadTextureKey: PLAYER_HEAD_TEXTURE_KEY,
              playerHeadDefaultFrame: PLAYER_HEAD_DEFAULT_FRAME ?? 0,
              playerHandsTextureKey: PLAYER_HANDS_TEXTURE_KEY,
              playerHandsDefaultFrame: PLAYER_HANDS_DEFAULT_FRAME,
              playerHandBaseOffsets: PLAYER_HAND_BASE_OFFSETS,
              ensureWorldTextureLoaded,
              ensureWorldTraderBodyOverlayLoaded,
              ensureWorldTraderSpriteSheetLoaded,
              resolveMobRenderState,
              getWorldTraderAnimationKey,
              getWorldTraderBodyOverlayAnimation,
              getVisualPixelSize,
              getVisualDisplaySize,
              getEyeLocalPosition,
              getHandLocalPosition,
              getHandDisplaySize,
            });
          };

          if (isRaidScene) {
            this.add
              .rectangle(mapWidth / 2, mapHeight / 2, mapWidth, mapHeight, 0x000000, 1)
              .setOrigin(0.5)
              .setDepth(-1);
          } else {
            renderWorldMap(meadowAsset);
          }

          const createCharacter = (
            x: number,
            y: number,
            name: string,
            health: number,
            maxHealth: number,
            equipment: CharacterEquipment,
          ): CharacterVisual => createCharacterVisual(this, tileSize, x, y, name, health, maxHealth, equipment);

          const createMob = (
            x: number,
            y: number,
            texture: string,
            name: string,
            health: number,
            maxHealth: number,
          ): MobVisual => createMobVisual(this, resolveMobRenderState, x, y, texture, name, health, maxHealth);

          const destroyCharacter = (sessionId: string) =>
            destroyCharacterVisual(
              sessionId,
              characters,
              localSessionId === sessionId
                ? () => { playerVisualRef.current = null; camera.stopFollow(); }
                : undefined,
            );

          const destroyMob = (mobId: string) => destroyMobVisual(mobId, mobs);

          const updateCharacterPose = (
            sessionId: string,
            character: CharacterVisual,
            isMoving: boolean,
            deltaSeconds: number,
            now: number,
            lookTargetY?: number,
            swingTarget?: { x: number; y: number },
          ) => updateCharacterPoseImpl(
            tileSize,
            sessionId,
            character,
            isMoving,
            deltaSeconds,
            now,
            sessionId === localSessionId,
            activeSkillTargetingRef.current,
            isRaidScene,
            lookTargetY,
            swingTarget,
          );

          const makeCastCtx = (): CastContext => ({
            room: roomRef.current,
            skillCooldowns: skillCooldownsRef.current,
            localSessionId,
            characters,
            equipment: latestProfileRef.current.playerEquipment,
            estimatedOneWayLatencyMs: estimatedOneWayLatencyMsRef.current,
            castHelpersConfig: CAST_HELPERS_CONFIG,
            onFireballCast: fireballCastRef.current,
            mouseSkillBindings: mouseSkillBindingsRef.current,
          });

          const castFireball = (targetX: number, targetY: number) => castFireballImpl(makeCastCtx(), targetX, targetY);
          const castFireNova = () => castFireNovaImpl(makeCastCtx());
          const castFireField = (targetX: number, targetY: number) => castFireFieldImpl(makeCastCtx(), targetX, targetY);
          const castWoodStaffDash = (targetX: number, targetY: number) => castWoodStaffDashImpl(makeCastCtx(), targetX, targetY);
          const castWoodStaffStrike = (targetX: number, targetY: number) => castWoodStaffStrikeImpl(makeCastCtx(), targetX, targetY);
          const castMouseBoundSkill = (skillId: SkillId, targetX: number, targetY: number) => castMouseBoundSkillImpl(makeCastCtx(), skillId, targetX, targetY);
          const getMouseBoundSkill = (slotKey: MouseActionSlotKey) => getMouseBoundSkillImpl(makeCastCtx(), slotKey);

          this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            handleCanvasPointerDown({
              pointer,
              camera,
              worldEditorInput,
              currentTargeting: activeSkillTargetingRef.current,
              getMouseBoundSkill,
              castMouseBoundSkill,
              castFireball,
              castFireField,
              useHeldConsumableOnSelf: (payload) => heldConsumableUseSelfRef.current?.(payload),
              throwHeldConsumable: (payload) => heldConsumableThrowRef.current?.(payload),
              cancelSkillTarget: () => skillTargetCancelRef.current?.(),
            });
          });

          this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            worldEditorInput.handlePointerMove(pointer);
          });

          this.input.on('pointerup', () => {
            worldEditorInput.handlePointerUp();
          });

          this.input.on('pointerupoutside', () => {
            worldEditorInput.handlePointerUp();
          });

          const syncPlayersFromRoom = () => {
            syncPlayersFromRoomShared({
              scene: this,
              Phaser,
              room,
              characters,
              completedDeadPlayerIds,
              localSessionId,
              isRaidScene,
              expectedServerTickMs: isRaidScene
                ? RAID_CLIENT_SIMULATION_STEP_MS
                : WORLD_CLIENT_SIMULATION_STEP_MS,
              raidWidth,
              raidHeight,
              getLastRaidTilesWidth: () => lastRaidTilesWidth,
              getLastRaidTilesHeight: () => lastRaidTilesHeight,
              tileSize,
              createCharacter,
              destroyCharacter,
              syncDeathState,
              applyCharacterHealthToVisual,
              applyBurningToCharacterVisual,
              applyHealingToCharacterVisual,
              applyCastingToCharacterVisual,
              applyEquipmentToVisual,
              toEquipmentItemId,
              playerVisualRef,
              playerVitalsChangeRef,
              playerProgressChangeRef,
              skillCooldownsRef,
              skillCooldownsChangeRef,
              latestProfileRef,
              movementState,
              positionSyncState,
              camera,
              reconcileRaidLocalCharacter,
              reconcileWorldLocalCharacter,
              hideStatusIcon,
            });
          };

          const syncRaidTilesFromRoom = () => {
            if (!isRaidScene || !room || !('tiles' in room.state)) {
              return;
            }

            const tileEntries = room.state.tiles as string[];
            const width = Number(room.state.width) || raidWidth;
            const height = Number(room.state.height) || raidHeight;
            if (tileEntries.length === 0 || width <= 0 || height <= 0) {
              return;
            }

            const layoutUnchanged =
              width === lastRaidTilesWidth &&
              height === lastRaidTilesHeight &&
              raidTilesData.length === tileEntries.length;
            if (layoutUnchanged) {
              return;
            }

            lastRaidTilesWidth = width;
            lastRaidTilesHeight = height;
            lastRaidVisibilityRenderKey = '';
            minimapEmitter.resetRaidMinimapState();
            lastRaidObjectVisibilityUpdateAt = 0;
            pendingRaidInputs = [];
            lastProcessedRaidInput = 0;
            movementSimulationAccumulatorMs = 0;

            raidTileSprites.forEach((tileVisual) => {
              tileVisual.base.destroy();
              tileVisual.overlays.forEach((overlay) => overlay.destroy());
            });
            raidTileSprites.clear();
            raidTilesData = [...tileEntries];
            raidBlockedTiles = new Uint8Array(tileEntries.length);
            for (let index = 0; index < tileEntries.length; index += 1) {
              const tile = tileEntries[index];
              raidBlockedTiles[index] = tile === 'wall' || tile === 'wallEdge' ? 1 : 0;
            }
            raidChestBlockedTiles = new Uint8Array(tileEntries.length);
            exploredRaidTiles.clear();
            if (activeRaidRunId) {
              loadStoredRaidExploredTiles(activeRaidRunId, tileEntries.length).forEach((tileIndex) => {
                exploredRaidTiles.add(tileIndex);
              });
              lastStoredRaidExploredSerialized = JSON.stringify(
                Array.from(exploredRaidTiles.values()).sort((left, right) => left - right),
              );
            } else {
              lastStoredRaidExploredSerialized = '';
            }
            visibleRaidTiles = new Set<number>();
            lastRaidVisionOriginKey = '';
          };

          const reconcileRaidLocalCharacter = (
            character: CharacterVisual,
            authoritativeX: number,
            authoritativeY: number,
            width: number,
            height: number,
          ) => reconcileRaidLocalCharacterImpl(character, authoritativeX, authoritativeY, width, height, {
            tileSize,
            pendingRaidInputs,
            raidBlockedTiles,
            raidChestBlockedTiles,
            speed: CLIENT_RAID_PLAYER_SPEED,
            strongDesyncDistance: tileSize * LOCAL_PLAYER_STRONG_DESYNC_TELEPORT_DISTANCE_TILES,
            mobBlockers: getMovementMobBlockers(),
          });

          const reconcileWorldLocalCharacter = (
            character: CharacterVisual,
            authoritativeX: number,
            authoritativeY: number,
          ) => reconcileWorldLocalCharacterImpl(character, authoritativeX, authoritativeY, {
            tileSize,
            pendingWorldInputs,
            mapWidth: meadowMap.width * tileSize,
            mapHeight: meadowMap.height * tileSize,
            meadowDecorations,
            meadowStamps: worldMapRenderState.currentAsset.stamps,
            speed: CLIENT_PLAYER_SPEED,
            strongDesyncDistance: tileSize * LOCAL_PLAYER_STRONG_DESYNC_TELEPORT_DISTANCE_TILES,
            mobBlockers: getMovementMobBlockers(),
          });

          const setCharacterVisibility = (
            character: CharacterVisual,
            visible: boolean,
            isLocalPlayer = false,
          ) => setCharacterVisibilityShared(character, visible, isLocalPlayer, hideStatusIcon);

          const setMobVisibility = (mob: MobVisual, visible: boolean) =>
            setMobVisibilityShared(mob, visible, hideStatusIcon);

          const updateRaidVisibility = (force = false) => {
            if (!isRaidScene || !room || !('tiles' in room.state)) {
              return;
            }

            const localCharacter = localSessionId ? characters.get(localSessionId) : null;
            const width = Number(room.state.width) || raidWidth;
            const height = Number(room.state.height) || raidHeight;
            const tiles = room.state.tiles as string[];
            if (!localCharacter || tiles.length === 0 || width <= 0 || height <= 0) {
              return;
            }

            const { tileX: originTileX, tileY: originTileY } = getRaidTilePositionFromWorld(
              localCharacter.container.x,
              localCharacter.container.y,
              tileSize,
              width,
              height,
            );
            const now = this.time.now;
            const visionKey = `${originTileX}:${originTileY}`;
            const visionChanged = force || visionKey !== lastRaidVisionOriginKey;
            if (visionChanged) {
              visibleRaidTiles = computeRaidVisibleTiles(
                originTileX,
                originTileY,
                RAID_VISION_RADIUS_TILES,
                tiles,
                width,
                height,
              );
              visibleRaidTiles.forEach((tileIndex) => exploredRaidTiles.add(tileIndex));
              if (activeRaidRunId) {
                const nextSerialized = JSON.stringify(
                  Array.from(exploredRaidTiles.values()).sort((left, right) => left - right),
                );
                if (nextSerialized !== lastStoredRaidExploredSerialized) {
                  saveStoredRaidExploredTiles(activeRaidRunId, exploredRaidTiles);
                  lastStoredRaidExploredSerialized = nextSerialized;
                }
              }
              lastRaidVisionOriginKey = visionKey;
            }

            const cullPadding = tileSize * 2;
            const worldView = camera.worldView;
            const cullLeft = worldView.x - cullPadding;
            const cullTop = worldView.y - cullPadding;
            const cullRight = worldView.right + cullPadding;
            const cullBottom = worldView.bottom + cullPadding;
            const cullTileLeft = Math.max(0, Math.floor(cullLeft / tileSize));
            const cullTileTop = Math.max(0, Math.floor(cullTop / tileSize));
            const cullTileRight = Math.min(width - 1, Math.floor(cullRight / tileSize));
            const cullTileBottom = Math.min(height - 1, Math.floor(cullBottom / tileSize));
            const renderKey = `${visionKey}|${cullTileLeft}:${cullTileTop}:${cullTileRight}:${cullTileBottom}`;
            if (
              !force &&
              renderKey === lastRaidVisibilityRenderKey &&
              now - lastRaidVisibilityUpdateAt < RAID_VISIBILITY_UPDATE_INTERVAL_MS
            ) {
              return;
            }

            lastRaidVisibilityRenderKey = renderKey;
            lastRaidVisibilityUpdateAt = now;
            minimapEmitter.emitRaidMinimapSnapshot({
              playerTileX: originTileX,
              playerTileY: originTileY,
              width,
              height,
              tiles,
              exploredTiles: exploredRaidTiles,
              visibleTiles: visibleRaidTiles,
              visionKey,
              now,
              force,
            });
            const isWithinCullBounds = (worldX: number, worldY: number) =>
              worldX >= cullLeft &&
              worldX <= cullRight &&
              worldY >= cullTop &&
              worldY <= cullBottom;

            const activeVisibleTiles = new Set<number>();
            for (let tileY = cullTileTop; tileY <= cullTileBottom; tileY += 1) {
              for (let tileX = cullTileLeft; tileX <= cullTileRight; tileX += 1) {
                const tileIndex = tileY * width + tileX;
                if (!visibleRaidTiles.has(tileIndex)) {
                  continue;
                }

                const tileWorldX = tileX * tileSize + tileSize / 2;
                const tileWorldY = tileY * tileSize + tileSize / 2;

                if (!isWithinCullBounds(tileWorldX, tileWorldY)) {
                  continue;
                }

                activeVisibleTiles.add(tileIndex);
                const tile = raidTilesData[tileIndex] ?? tiles[tileIndex] ?? 'wall';
                const tileRender = resolveCryptTexture(tile);
                let tileVisual = raidTileSprites.get(tileIndex);

                if (!tileVisual) {
                  const base = this.add
                    .image(tileWorldX, tileWorldY, tileRender.texture)
                    .setDisplaySize(tileSize, tileSize)
                    .setOrigin(0.5)
                    .setDepth(-0.05);
                  const overlays: Phaser.GameObjects.Image[] = [];
                  tileVisual = { base, overlays };
                  raidTileSprites.set(tileIndex, tileVisual);
                }

                tileVisual.base
                  .setPosition(tileWorldX, tileWorldY)
                  .setTexture(tileRender.texture)
                  .setTint(tileRender.tint)
                  .setAlpha(tileRender.alpha)
                  .setVisible(true);
                tileVisual.overlays.forEach((overlay) => overlay.setVisible(true));
              }
            }

            raidTileSprites.forEach((tileVisual, tileIndex) => {
              const visible = activeVisibleTiles.has(tileIndex);
              tileVisual.base.setVisible(visible);
              tileVisual.overlays.forEach((overlay) => overlay.setVisible(visible));
            });

            if (
              force ||
              visionChanged ||
              now - lastRaidObjectVisibilityUpdateAt >= RAID_OBJECT_VISIBILITY_UPDATE_INTERVAL_MS
            ) {
              lastRaidObjectVisibilityUpdateAt = now;

              characters.forEach((character, sessionId) => {
                if (sessionId === localSessionId) {
                  setCharacterVisibility(character, true, true);
                  character.isVisible = true;
                  return;
                }

                const tileX = Math.max(0, Math.min(width - 1, Math.floor(character.container.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(character.container.y / tileSize)));
                const visible = visibleRaidTiles.has(tileY * width + tileX);
                if (character.isVisible !== visible) {
                  setCharacterVisibility(character, visible);
                  character.isVisible = visible;
                }
              });

              mobs.forEach((mob) => {
                const tileX = Math.max(0, Math.min(width - 1, Math.floor(mob.sprite.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(mob.sprite.y / tileSize)));
                const visible = visibleRaidTiles.has(tileY * width + tileX);
                if (mob.isVisible !== visible) {
                  setMobVisibility(mob, visible);
                  mob.isVisible = visible;
                }
              });

              chestSprites.forEach((sprite) => {
                const tileX = Math.max(0, Math.min(width - 1, Math.floor(sprite.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(sprite.y / tileSize)));
                sprite.setVisible(
                  visibleRaidTiles.has(tileY * width + tileX) &&
                  isWithinCullBounds(sprite.x, sprite.y),
                );
              });

              raidExitSprites.forEach((exitSprite) => {
                const tileX = Math.max(0, Math.min(width - 1, Math.floor(exitSprite.ring.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(exitSprite.ring.y / tileSize)));
                const visible =
                  visibleRaidTiles.has(tileY * width + tileX) &&
                  isWithinCullBounds(exitSprite.ring.x, exitSprite.ring.y);
                exitSprite.ring.setVisible(visible);
                exitSprite.core.setVisible(visible);
                exitSprite.label.setVisible(visible);
              });

              groundEffects.forEach((effectVisual) => {
                const tileX = Math.max(0, Math.min(width - 1, Math.floor(effectVisual.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(effectVisual.y / tileSize)));
                const visible =
                  visibleRaidTiles.has(tileY * width + tileX) &&
                  isWithinCullBounds(effectVisual.x, effectVisual.y);
                if (effectVisual.isVisible !== visible) {
                  effectVisual.tile.setVisible(visible);
                  effectVisual.aura.setVisible(visible);
                  effectVisual.flames.forEach((flame) => flame.setVisible(visible));
                  effectVisual.isVisible = visible;
                }
              });

              projectileSprites.forEach((projectileVisual) => {
                const tileX = Math.max(0, Math.min(width - 1, Math.floor(projectileVisual.sprite.x / tileSize)));
                const tileY = Math.max(0, Math.min(height - 1, Math.floor(projectileVisual.sprite.y / tileSize)));
                const visible =
                  visibleRaidTiles.has(tileY * width + tileX) &&
                  isWithinCullBounds(projectileVisual.sprite.x, projectileVisual.sprite.y);
                if (projectileVisual.isVisible !== visible) {
                  projectileVisual.aura.setVisible(visible);
                  projectileVisual.sprite.setVisible(visible);
                  projectileVisual.isVisible = visible;
                }
              });
            }
          };

          const syncMobsFromRoom = () => {
            syncMobsFromRoomShared({
              scene: this,
              room,
              mobs,
              completedDeadMobIds,
              createMob,
              destroyMob,
              syncDeathState,
              applyMobHealthToVisual,
              applyBurningToMobVisual,
              hideStatusIcon,
            });
          };

          const syncChestsFromRoom = () => {
            if (!room || !('chests' in room.state)) {
              chestSprites.forEach((sprite) => sprite.destroy());
              chestSprites.clear();
              raidChestBlockedTiles = new Uint8Array(raidTilesData.length);
              onContainersStateChange?.([]);
              return;
            }

            const nextContainers: ContainerSnapshot[] = [];
            const seen = new Set<string>();
            const nextRaidChestBlockedTiles = new Uint8Array(raidTilesData.length);

            room.state.chests.forEach((networkChest, chestId) => {
              seen.add(chestId);
              const tileIndex = networkChest.y * lastRaidTilesWidth + networkChest.x;
              if (tileIndex >= 0 && tileIndex < nextRaidChestBlockedTiles.length) {
                nextRaidChestBlockedTiles[tileIndex] = 1;
              }
              const slots = networkChest.slots.map((itemId) => {
                const equipmentItemId = toEquipmentItemId(itemId);
                return equipmentItemId ?? null;
              });

              let chestSprite = chestSprites.get(chestId);
              const chestX = networkChest.x * meadowMap.tileSize + meadowMap.tileSize / 2;
              const chestY = networkChest.y * meadowMap.tileSize + meadowMap.tileSize / 2;

              const chestTexture = getChestTextureKey(networkChest);

              if (!chestSprite) {
                chestSprite = this.add
                  .image(chestX, chestY, chestTexture)
                  .setDisplaySize(meadowMap.tileSize, meadowMap.tileSize)
                  .setOrigin(0.5)
                  .setDepth(0.85)
                  .setAlpha(1);
                chestSprites.set(chestId, chestSprite);
              } else {
                chestSprite.setTexture(chestTexture);
                chestSprite.setPosition(chestX, chestY);
                chestSprite.setDepth(0.85);
                chestSprite.setAlpha(1);
              }

              serverContainersRef.current[networkChest.id] = slots;
              nextContainers.push({
                id: networkChest.id,
                title: networkChest.title,
                subtitle: networkChest.subtitle,
                columns: networkChest.columns,
                rows: networkChest.rows,
                slots,
              });
            });

            for (const [chestId, sprite] of chestSprites.entries()) {
              if (seen.has(chestId)) {
                continue;
              }

              sprite.destroy();
              chestSprites.delete(chestId);
              delete serverContainersRef.current[chestId];
            }

            raidChestBlockedTiles = nextRaidChestBlockedTiles;
            onContainersStateChange?.(nextContainers);
          };

          const syncRaidExitPointsFromRoom = () => {
            if (!room || !('exitPoints' in room.state)) {
              raidExitSprites.forEach((exitSprite) => {
                exitSprite.ring.destroy();
                exitSprite.core.destroy();
                exitSprite.label.destroy();
              });
              raidExitSprites.clear();
              return;
            }

            const seen = new Set<string>();

            room.state.exitPoints.forEach((encodedPoint) => {
              seen.add(encodedPoint);
              const [tileX, tileY] = encodedPoint.split(':').map((value) => Number.parseInt(value, 10));
              const worldX = tileX * tileSize + tileSize / 2;
              const worldY = tileY * tileSize + tileSize / 2;
              let exitSprite = raidExitSprites.get(encodedPoint);

              if (!exitSprite) {
                exitSprite = {
                  ring: this.add
                    .ellipse(worldX, worldY, tileSize * 0.72, tileSize * 0.72, 0xb6a6ff, 0.18)
                    .setStrokeStyle(2, 0xe5dcff, 0.7)
                    .setDepth(1.15),
                  core: this.add
                    .ellipse(worldX, worldY, tileSize * 0.32, tileSize * 0.32, 0xf2e9ff, 0.6)
                    .setDepth(1.16),
                  label: this.add
                    .text(worldX, worldY - 18, 'EXIT', {
                      color: '#f4eeff',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      fontStyle: 'bold',
                      stroke: '#251737',
                      strokeThickness: 2,
                    })
                    .setOrigin(0.5)
                    .setScale(0.45)
                    .setDepth(1.17),
                };
                raidExitSprites.set(encodedPoint, exitSprite);
              } else {
                exitSprite.ring.setPosition(worldX, worldY);
                exitSprite.core.setPosition(worldX, worldY);
                exitSprite.label.setPosition(worldX, worldY - 18);
              }
            });

            for (const [exitId, exitSprite] of raidExitSprites.entries()) {
              if (seen.has(exitId)) {
                continue;
              }

              exitSprite.ring.destroy();
              exitSprite.core.destroy();
              exitSprite.label.destroy();
              raidExitSprites.delete(exitId);
            }
          };

          const syncProjectilesFromRoom = () => {
            syncProjectilesFromRoomShared({
              scene: this,
              Phaser,
              room,
              projectileSprites,
              projectileAnimations,
              resolvedSkillEffects,
              getProjectileAnimation,
              getProjectileDisplaySize,
            });
          };

          const syncGroundEffectsFromRoom = () => {
            syncGroundEffectsFromRoomShared({
              scene: this,
              room,
              groundEffects,
              resolvedSkillEffects,
              groundAnimation,
              meadowMap,
            });
          };

          const isWorldPointVisible = (x: number, y: number) => {
            if (
              !isRaidScene ||
              lastRaidTilesWidth <= 0 ||
              lastRaidTilesHeight <= 0
            ) {
              return true;
            }

            const tileX = Math.max(0, Math.min(lastRaidTilesWidth - 1, Math.floor(x / tileSize)));
            const tileY = Math.max(0, Math.min(lastRaidTilesHeight - 1, Math.floor(y / tileSize)));
            return visibleRaidTiles.has(tileY * lastRaidTilesWidth + tileX);
          };

          const playThrownConsumableImpactAt = (
            itemId: ConsumableItemId,
            x: number,
            y: number,
          ) => {
            playThrownConsumableImpact({
              scene: this,
              itemId,
              x,
              y,
              tileSize,
              mapHeight,
              isWorldPointVisible,
              getEntitySortDepth,
              entitySortAuraOffset: ENTITY_SORT_AURA_OFFSET,
              entitySortEffectOffset: ENTITY_SORT_EFFECT_OFFSET,
            });
          };

          const playThrownConsumable = (payload: ThrownConsumableMessage) => {
            const sourceCharacter =
              typeof payload.sourcePlayerId === 'string'
                ? characters.get(payload.sourcePlayerId)
                : null;
            const nextVisual = createThrownConsumableVisual({
              scene: this,
              payload,
              sourceCharacter: sourceCharacter ?? null,
              tileSize,
              mapHeight,
              isWorldPointVisible,
              getEntitySortDepth,
              entitySortShadowOffset: ENTITY_SORT_SHADOW_OFFSET,
              entitySortEffectOffset: ENTITY_SORT_EFFECT_OFFSET,
              now: this.time.now,
            });
            if (nextVisual) {
              thrownConsumables.push(nextVisual);
            }
          };

          const createFloatingDamageText = (x: number, y: number, text: string, color = '#ff5959') => {
            createFloatingCombatText({
              scene: this,
              x,
              y,
              text,
              color,
              isWorldPointVisible,
            });
          };

          const latestProfileSnapshot: ProfileSnapshot = {
            playerName: latestProfileRef.current.playerName,
            playerRole: latestProfileRef.current.playerRole,
            playerPosition: latestProfileRef.current.playerPosition,
            playerHealth: latestProfileRef.current.playerHealth,
            playerMaxHealth: latestProfileRef.current.playerMaxHealth,
            playerLevel: latestProfileRef.current.playerLevel,
            playerExperience: latestProfileRef.current.playerExperience,
            playerStrength: latestProfileRef.current.playerStrength,
            playerAgility: latestProfileRef.current.playerAgility,
            playerIntellect: latestProfileRef.current.playerIntellect,
            playerGold: latestProfileRef.current.playerGold,
            playerQuests: latestProfileRef.current.playerQuests,
            playerInventory: latestProfileRef.current.playerInventory,
            playerEquipment: latestProfileRef.current.playerEquipment,
          };
          void (async () => {
            try {
              const sessionToken = sessionTokenRef.current ?? undefined;
              const resolvedContentVersion = contentVersionRef.current;
              if (!resolvedContentVersion) {
                if (sceneActive && statusText.active) {
                  statusText.setText('Syncing content snapshot...');
                }
                chatSenderReadyRef.current?.(null);
                return;
              }

              let resolvedRoomOptions = { ...(activeRoomOptions ?? {}) } as Record<string, unknown>;
              if (isRaidScene && typeof resolvedRoomOptions.raidRunId === 'string') {
                const latestRaidRun = await loadRaidRun(resolvedRoomOptions.raidRunId);
                resolvedRoomOptions = {
                  ...resolvedRoomOptions,
                  ...(latestRaidRun.realtimeRoom.options ?? {}),
                  runtimeState:
                    latestRaidRun.runtimeState ??
                    latestRaidRun.realtimeRoom.options?.runtimeState ??
                    null,
                };
              }

              const joinOptions: WorldRoomJoinOptions | RaidRoomJoinOptions = activeRoomName === 'world'
                ? {
                  ...resolvedRoomOptions,
                  ...createWorldProfileMessage(latestProfileSnapshot),
                  worldOwner: latestProfileSnapshot.playerName,
                  sessionToken,
                  contentVersion: resolvedContentVersion,
                }
                : {
                  ...resolvedRoomOptions,
                  ...createBaseProfileMessage(latestProfileSnapshot),
                  sessionToken,
                  contentVersion: resolvedContentVersion,
                };

              const joinedRoom = await networkClient.joinOrCreate(activeRoomName, joinOptions);
              room = joinedRoom as RealtimeRoom;
              roomRef.current = room;
              localSessionId = room.sessionId;
              startLatencyPing();
              if (sceneActive && statusText.active) {
                statusText.setText(isRaidScene ? 'Raid connected' : 'World connected');
              }
              roomConnectedRef.current?.({
                roomName: activeRoomName,
                options: resolvedRoomOptions,
              });

              if (!isRaidScene) {
                const profileMessage = createWorldProfileMessage(latestProfileSnapshot);
                profileMessage.sessionToken = sessionToken;
                profileMessage.contentVersion = resolvedContentVersion;
                room.send('profile', profileMessage);
                chatSenderReadyRef.current?.((text: string) => {
                  const chatInputMessage: ChatInputMessage = { text };
                  room?.send('chat', chatInputMessage);
                });
                if (
                  pendingRespawnNonceRef.current > 0 &&
                  lastSentRespawnNonceRef.current < pendingRespawnNonceRef.current
                ) {
                  room.send('respawn', {});
                  lastSentRespawnNonceRef.current = pendingRespawnNonceRef.current;
                }
              } else {
                chatSenderReadyRef.current?.(null);
              }

              room.onStateChange(() => {
                if (!sceneActive) {
                  return;
                }
                syncRaidTilesFromRoom();
                syncPlayersFromRoom();
                syncMobsFromRoom();
                syncChestsFromRoom();
                syncRaidExitPointsFromRoom();
                syncGroundEffectsFromRoom();
                syncProjectilesFromRoom();
                updateRaidVisibility(true);
              });

              room.onLeave((code) => {
                stopLatencyPing();
                if (sceneActive && statusText.active) {
                  statusText.setText(isRaidScene ? 'Disconnected from raid' : 'Disconnected from world');
                }
                chatSenderReadyRef.current?.(null);
                if (isRaidScene && code === 4002) {
                  raidExitRef.current?.({
                    raidRunId: typeof resolvedRoomOptions.raidRunId === 'string'
                      ? resolvedRoomOptions.raidRunId
                      : undefined,
                    reason: 'expired',
                  });
                }
              });
              attachRoomInboundHandlers(
                room,
                {
                  syncRaidTilesFromRoom,
                  syncPlayersFromRoom,
                  syncMobsFromRoom,
                  syncChestsFromRoom,
                  syncRaidExitPointsFromRoom,
                  syncGroundEffectsFromRoom,
                  syncProjectilesFromRoom,
                  updateRaidVisibility,
                  createFloatingDamageText,
                  playThrownConsumable,
                },
                true,
              );
            } catch (error) {
              const message =
                error instanceof Error && error.message
                  ? error.message
                  : 'Realtime server offline. Start realtime on :2567';
              if (isRaidScene && /expired|4002/i.test(message)) {
                raidExitRef.current?.({
                  raidRunId: typeof activeRoomOptions?.raidRunId === 'string'
                    ? activeRoomOptions.raidRunId
                    : undefined,
                  reason: 'expired',
                });
              }
              if (sceneActive && statusText.active) {
                statusText.setText(message);
              }
              chatSenderReadyRef.current?.(null);
            }
          })();

          this.add
            .text(24, 24, isRaidScene ? String(activeRoomOptions?.templateName ?? 'Raid Instance') : 'Personal World', {
              color: '#f4ffe8',
              fontFamily: 'Georgia, serif',
              fontSize: '30px',
              fontStyle: 'bold',
            })
            .setScrollFactor(0);

          this.add
            .text(24, 64, isRaidScene ? `Seed ${String(activeRoomOptions?.seed ?? '')}` : 'Private world instance with personal storage', {
              color: '#d7efc9',
              fontFamily: 'Georgia, serif',
              fontSize: '18px',
            })
            .setScrollFactor(0);

          this.add
            .text(24, 90, isRaidScene ? 'Solo raid instance through Colyseus' : 'Movement and visible equipment sync through Colyseus', {
              color: '#d7efc9',
              fontFamily: 'Georgia, serif',
              fontSize: '18px',
            })
            .setScrollFactor(0);

          this.events.on('update', (_time: number, delta: number) => {
            const deltaSeconds = delta / 1000;
            let moveX = 0;
            let moveY = 0;
            const keyboardEnabled = keyboardInputEnabledRef.current;

            if (keyboardEnabled && (cursors?.left.isDown || wasd?.left.isDown)) {
              moveX -= 1;
            }
            if (keyboardEnabled && (cursors?.right.isDown || wasd?.right.isDown)) {
              moveX += 1;
            }
            if (keyboardEnabled && (cursors?.up.isDown || wasd?.up.isDown)) {
              moveY -= 1;
            }
            if (keyboardEnabled && (cursors?.down.isDown || wasd?.down.isDown)) {
              moveY += 1;
            }

            const length = Math.hypot(moveX, moveY);
            let normalizedX = length > 0 ? moveX / length : 0;
            let normalizedY = length > 0 ? moveY / length : 0;
            const raidCollisionWidth =
              room && 'width' in room.state ? Number(room.state.width) || raidWidth : raidWidth;
            const raidCollisionHeight =
              room && 'height' in room.state ? Number(room.state.height) || raidHeight : raidHeight;
            const localCharacter = localSessionId
              ? characters.get(localSessionId)
              : undefined;
            let localLookTargetY: number | undefined;

            if (localCharacter) {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              lastPointerWorldRef.current = {
                x: pointerWorld.x,
                y: pointerWorld.y,
              };
              localLookTargetY = pointerWorld.y;
              const pointerDeltaX = pointerWorld.x - localCharacter.container.x;
              const pointerDeltaY = pointerWorld.y - localCharacter.container.y;
              const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);

              if (pointerDistance > 0.001) {
                lastLookX = pointerDeltaX / pointerDistance;
                lastLookY = pointerDeltaY / pointerDistance;
              }

              if (pointerDeltaX < -1) {
                localCharacter.facingX = -1;
              } else if (pointerDeltaX > 1) {
                localCharacter.facingX = 1;
              }

              if (localCharacter.currentCastEndsAt > Date.now()) {
                normalizedX = 0;
                normalizedY = 0;
              }
            }

            const inputSignature = `${normalizedX.toFixed(2)}:${normalizedY.toFixed(2)}`;
            movementSimulationAccumulatorMs = Math.min(
              clientSimulationStepMs * 6,
              movementSimulationAccumulatorMs + delta,
            );

            while (localCharacter && movementSimulationAccumulatorMs >= clientSimulationStepMs) {
              movementSimulationAccumulatorMs -= clientSimulationStepMs;
              const inputChanged = inputSignature !== previousInput;
              const hasMotion = normalizedX !== 0 || normalizedY !== 0;
              const shouldSendInput = hasMotion || inputChanged;
              const mobBlockers = getMovementMobBlockers();

              if (room && shouldSendInput) {
                previousInput = inputSignature;

                if (isRaidScene) {
                  const sequence = nextRaidInputSequence;
                  nextRaidInputSequence += 1;
                  const moveMessage: MoveMessage = {
                    x: normalizedX,
                    y: normalizedY,
                    sequence,
                    clientEstimatedLatencyMs: estimatedOneWayLatencyMsRef.current,
                  };
                  room.send('move', moveMessage);

                  pendingRaidInputs.push({
                    sequence,
                    x: normalizedX,
                    y: normalizedY,
                    durationMs: clientSimulationStepMs,
                  });

                  if (pendingRaidInputs.length > maxPendingInputHistory) {
                    pendingRaidInputs = pendingRaidInputs.slice(-maxPendingInputHistory);
                  }
                } else {
                  const sequence = nextWorldInputSequence;
                  nextWorldInputSequence += 1;
                  const moveMessage: MoveMessage = {
                    x: normalizedX,
                    y: normalizedY,
                    sequence,
                    clientEstimatedLatencyMs: estimatedOneWayLatencyMsRef.current,
                  };
                  room.send('move', moveMessage);

                  pendingWorldInputs.push({
                    sequence,
                    x: normalizedX,
                    y: normalizedY,
                    durationMs: clientSimulationStepMs,
                  });

                  if (pendingWorldInputs.length > maxPendingInputHistory) {
                    pendingWorldInputs = pendingWorldInputs.slice(-maxPendingInputHistory);
                  }
                }
              }

              if (!hasMotion) {
                continue;
              }

              if (isRaidScene) {
                const replayed = applyRaidPredictedMovement(
                  localCharacter.simX,
                  localCharacter.simY,
                  normalizedX,
                  normalizedY,
                  clientSimulationStepMs / 1000,
                  tileSize,
                  mapWidth,
                  mapHeight,
                  raidBlockedTiles,
                  raidCollisionWidth,
                  raidCollisionHeight,
                  raidChestBlockedTiles,
                  CLIENT_RAID_PLAYER_SPEED,
                  mobBlockers,
                );
                localCharacter.simPrevX = localCharacter.simX;
                localCharacter.simPrevY = localCharacter.simY;
                localCharacter.simX = replayed.x;
                localCharacter.simY = replayed.y;
              } else {
                const replayed = applyWorldPredictedMovement(
                  localCharacter.simX,
                  localCharacter.simY,
                  normalizedX,
                  normalizedY,
                  clientSimulationStepMs,
                  tileSize,
                  mapWidth,
                  mapHeight,
                  meadowDecorations,
                  worldMapRenderState.currentAsset.stamps,
                  CLIENT_PLAYER_SPEED,
                  mobBlockers,
                );
                localCharacter.simPrevX = localCharacter.simX;
                localCharacter.simPrevY = localCharacter.simY;
                localCharacter.simX = replayed.x;
                localCharacter.simY = replayed.y;
              }
            }

            const localInterpolationAlpha = localCharacter
              ? Phaser.Math.Clamp(
                movementSimulationAccumulatorMs / clientSimulationStepMs,
                0,
                1,
              )
              : 0;

            characters.forEach((character, sessionId) => {
              const isLocalPlayer = sessionId === localSessionId;
              let localMovementSignal = false;
              if (isLocalPlayer) {
                const hasInput = normalizedX !== 0 || normalizedY !== 0;
                const pendingInputs = isRaidScene ? pendingRaidInputs.length : pendingWorldInputs.length;
                const pendingHasMotion = isRaidScene
                  ? pendingRaidInputs.some((input) => input.x !== 0 || input.y !== 0)
                  : pendingWorldInputs.some((input) => input.x !== 0 || input.y !== 0);

                const decayFactor = Math.exp(-12 * deltaSeconds);
                character.simErrorX *= decayFactor;
                character.simErrorY *= decayFactor;
                if (Math.abs(character.simErrorX) < 0.05) character.simErrorX = 0;
                if (Math.abs(character.simErrorY) < 0.05) character.simErrorY = 0;

                if (!hasInput && pendingInputs === 0) {
                  character.simPrevX = character.simX;
                  character.simPrevY = character.simY;
                }

                const stepDistance = Phaser.Math.Distance.Between(
                  character.simPrevX,
                  character.simPrevY,
                  character.simX,
                  character.simY,
                );
                if (hasInput || pendingHasMotion || stepDistance > 0.6) {
                  character.idleGraceUntil = this.time.now + 140;
                }
                localMovementSignal = this.time.now <= character.idleGraceUntil;
                character.container.setPosition(
                  Phaser.Math.Linear(character.simPrevX, character.simX, localInterpolationAlpha) + character.simErrorX,
                  Phaser.Math.Linear(character.simPrevY, character.simY, localInterpolationAlpha) + character.simErrorY,
                );
              } else {
                const distanceToTarget = Phaser.Math.Distance.Between(
                  character.container.x,
                  character.container.y,
                  character.targetX,
                  character.targetY,
                );

                if (distanceToTarget > 64) {
                  character.container.setPosition(
                    character.targetX,
                    character.targetY,
                  );
                } else {
                  const renderTime = this.time.now - remoteInterpolationDelayMs;
                  const span = Math.max(1, character.interpNextAt - character.interpPrevAt);
                  const t = Phaser.Math.Clamp(
                    (renderTime - character.interpPrevAt) / span,
                    0,
                    1,
                  );
                  character.container.x = Phaser.Math.Linear(
                    character.interpPrevX,
                    character.interpNextX,
                    t,
                  );
                  character.container.y = Phaser.Math.Linear(
                    character.interpPrevY,
                    character.interpNextY,
                    t,
                  );
                }
              }

              const movedDeltaX = character.container.x - character.lastX;
              if (!isLocalPlayer) {
                if (movedDeltaX < -0.05) {
                  character.facingX = -1;
                } else if (movedDeltaX > 0.05) {
                  character.facingX = 1;
                }
              }

              character.container.setScale(character.facingX, 1);
              character.shadow.setPosition(
                character.container.x,
                character.container.y + 15,
              );
              const characterDepth = getEntitySortDepth(
                getCharacterFootY(character, tileSize),
                mapHeight,
              );
              character.shadow.setDepth(characterDepth - ENTITY_SORT_SHADOW_OFFSET);
              character.burnAura.setDepth(characterDepth - ENTITY_SORT_AURA_OFFSET);
              character.container.setDepth(characterDepth);
              character.deathEffect.setDepth(characterDepth + ENTITY_SORT_EFFECT_OFFSET);
              character.nameplate.setPosition(
                character.container.x,
                character.container.y - 24,
              );
              character.healthBarFrame.setPosition(
                character.container.x,
                character.container.y + 22,
              );
              character.healthBarBack.setPosition(
                character.container.x,
                character.container.y + 22,
              );
              character.healthBarFill.setPosition(
                character.container.x - 12,
                character.container.y + 22,
              );
              character.castBarFrame.setPosition(
                character.container.x,
                character.container.y + 30,
              );
              character.castBarBack.setPosition(
                character.container.x,
                character.container.y + 30,
              );
              character.castBarFill.setPosition(
                character.container.x - 12,
                character.container.y + 30,
              );
              layoutHealthSegments(
                character.healthSegments,
                character.container.x,
                character.container.y + 22,
                character.currentHealthSegmentCount,
              );

              if (character.isDead) {
                setCharacterVisibility(character, character.isVisible ?? true, isLocalPlayer);
                character.deathEffect
                  .setPosition(character.container.x, character.container.y)
                  .setScale(getSharedDeathAnimationScale(meadowMap.tileSize))
                  .setFrame(
                    getSpriteSheetAnimationFrame(
                      SHARED_DEATH_ANIMATION,
                      Math.max(0, this.time.now - character.deathStartedAt),
                    ),
                  );
                if (isDeathAnimationComplete(SHARED_DEATH_ANIMATION, character, this.time.now)) {
                  completedDeadPlayerIds.add(sessionId);
                  destroyCharacter(sessionId);
                  return;
                }

                character.lastX = character.container.x;
                character.lastY = character.container.y;
                return;
              }

              const isCasting =
                character.currentCastingSkillId.length > 0 &&
                character.currentCastEndsAt > Date.now() &&
                character.currentCastEndsAt > character.currentCastStartedAt;
              if (isCasting) {
                const castDuration = Math.max(1, character.currentCastEndsAt - character.currentCastStartedAt);
                const castProgress = Phaser.Math.Clamp(
                  (Date.now() - character.currentCastStartedAt) / castDuration,
                  0,
                  1,
                );
                character.castBarFill.width = 24 * castProgress;
                character.castBarFrame.setVisible(true);
                character.castBarBack.setVisible(true);
                character.castBarFill.setVisible(true);
              } else {
                character.castBarFrame.setVisible(false);
                character.castBarBack.setVisible(false);
                character.castBarFill.setVisible(false);
              }

              const moved =
                Math.abs(character.container.x - character.lastX) > 0.1 ||
                Math.abs(character.container.y - character.lastY) > 0.1;
              const movementSignal = isLocalPlayer ? localMovementSignal : moved;
              if (movementSignal) {
                character.lastMovedAt = this.time.now;
              }
              const shouldAnimateMove =
                movementSignal || this.time.now - character.lastMovedAt <= 120;

              updateCharacterPose(
                sessionId,
                character,
                shouldAnimateMove,
                deltaSeconds,
                this.time.now,
                isLocalPlayer ? localLookTargetY : undefined,
                isLocalPlayer ? lastPointerWorldRef.current : undefined,
              );
              character.burnAura.setVisible(
                character.currentBurnTicksRemaining > 0 &&
                  character.currentBurnEndsAt > Date.now() &&
                  character.container.visible,
              );
              updateCharacterEffectDisplay(character, character.container.x, character.container.y - 34);
              character.lastX = character.container.x;
              character.lastY = character.container.y;
            });

            if (localCharacter) {
              const distanceSinceLastSync = Phaser.Math.Distance.Between(
                localCharacter.container.x,
                localCharacter.container.y,
                lastSyncedPositionX,
                lastSyncedPositionY,
              );

              if (distanceSinceLastSync >= 8 && this.time.now - lastPositionSyncAt >= 1000) {
                lastSyncedPositionX = localCharacter.container.x;
                lastSyncedPositionY = localCharacter.container.y;
                lastPositionSyncAt = this.time.now;
                const nextPosition = {
                  x: Math.round(localCharacter.container.x),
                  y: Math.round(localCharacter.container.y),
                };
                if (
                  lastNotifiedPlayerPositionRef.current?.x !== nextPosition.x ||
                  lastNotifiedPlayerPositionRef.current?.y !== nextPosition.y
                ) {
                  lastNotifiedPlayerPositionRef.current = nextPosition;
                  playerPositionChangeRef.current?.(nextPosition);
                }
              }
            }

            groundEffects.forEach((effectVisual) => {
              const phase = this.time.now * 0.006 + effectVisual.x * 0.01 + effectVisual.y * 0.01;
              effectVisual.tile.setFillStyle(0xa82d12, 0.12 + Math.sin(phase) * 0.02);
              effectVisual.aura.setPosition(effectVisual.x, effectVisual.y + 7 + Math.sin(phase) * 0.8);
              effectVisual.aura.setSize(
                meadowMap.tileSize * 0.96 + Math.sin(phase * 1.7) * 3,
                meadowMap.tileSize * 0.66 + Math.cos(phase * 1.3) * 2,
              );
              effectVisual.aura.setFillStyle(0xff9a32, 0.16 + Math.sin(phase * 1.9) * 0.03);
              [
                { x: -8, y: -7, scale: 0.56, alpha: 0.9, phaseOffset: 0 },
                { x: 8, y: -7, scale: 0.56, alpha: 0.9, phaseOffset: 0.9 },
                { x: -8, y: 7, scale: 0.56, alpha: 0.86, phaseOffset: 1.8 },
                { x: 8, y: 7, scale: 0.56, alpha: 0.86, phaseOffset: 2.7 },
              ].forEach((offset, index) => {
                const flamePhase = phase + offset.phaseOffset;
                effectVisual.flames[index]
                  .setFrame(
                    getSpriteSheetAnimationFrame(groundAnimation, this.time.now, index * 90),
                  )
                  .setAlpha(offset.alpha + Math.sin(flamePhase * 2.1) * 0.05)
                  .setScale(offset.scale + Math.sin(flamePhase * 1.6) * 0.035)
                  .setPosition(
                    effectVisual.x + offset.x,
                    effectVisual.y + offset.y + Math.sin(flamePhase * 1.4) * 0.8,
                  );
              });
            });

            projectileSprites.forEach((projectileVisual) => {
              const distanceToTarget = Phaser.Math.Distance.Between(
                projectileVisual.sprite.x,
                projectileVisual.sprite.y,
                projectileVisual.targetX,
                projectileVisual.targetY,
              );

              if (distanceToTarget > 72) {
                projectileVisual.sprite.setPosition(
                  projectileVisual.targetX,
                  projectileVisual.targetY,
                );
                return;
              }

              const projectileLerp = Math.min(1, deltaSeconds * 20);
              projectileVisual.sprite.x = Phaser.Math.Linear(
                projectileVisual.sprite.x,
                projectileVisual.targetX,
                projectileLerp,
              );
              projectileVisual.sprite.y = Phaser.Math.Linear(
                projectileVisual.sprite.y,
                projectileVisual.targetY,
                projectileLerp,
              );
              projectileVisual.aura.setPosition(
                projectileVisual.sprite.x,
                projectileVisual.sprite.y,
              );
              projectileVisual.aura.setSize(
                20 + Math.sin(this.time.now * 0.02 + projectileVisual.targetX * 0.01) * 3,
                20 + Math.cos(this.time.now * 0.017 + projectileVisual.targetY * 0.01) * 3,
              );
              projectileVisual.aura.setFillStyle(
                0xff962f,
                0.22 + Math.sin(this.time.now * 0.025 + projectileVisual.targetX * 0.005) * 0.05,
              );
            });

            for (let index = thrownConsumables.length - 1; index >= 0; index -= 1) {
              const thrownVisual = thrownConsumables[index];
              const durationMs = Math.max(1, thrownVisual.endsAt - thrownVisual.startedAt);
              const progress = Phaser.Math.Clamp((this.time.now - thrownVisual.startedAt) / durationMs, 0, 1);
              const groundX = Phaser.Math.Linear(thrownVisual.startX, thrownVisual.targetX, progress);
              const groundY = Phaser.Math.Linear(thrownVisual.startY, thrownVisual.targetY, progress);
              const altitude = Math.sin(progress * Math.PI) * thrownVisual.arcHeight;
              const visible = isWorldPointVisible(groundX, groundY);

              if (progress >= 1) {
                playThrownConsumableImpactAt(thrownVisual.itemId, thrownVisual.targetX, thrownVisual.targetY);
                thrownVisual.sprite.destroy();
                thrownVisual.shadow.destroy();
                thrownConsumables.splice(index, 1);
                continue;
              }

              const altitudeFactor = thrownVisual.arcHeight > 0 ? altitude / thrownVisual.arcHeight : 0;
              const depth = getEntitySortDepth(groundY + tileSize * 0.42, mapHeight);

              thrownVisual.shadow
                .setPosition(groundX, groundY + tileSize * 0.26)
                .setSize(
                  tileSize * (0.34 - altitudeFactor * 0.08),
                  tileSize * (0.18 - altitudeFactor * 0.04),
                )
                .setAlpha(0.08 + (1 - altitudeFactor) * 0.14)
                .setDepth(depth - ENTITY_SORT_SHADOW_OFFSET)
                .setVisible(visible);

              thrownVisual.sprite
                .setPosition(groundX, groundY - altitude)
                .setScale(thrownVisual.baseScale * (1 + altitudeFactor * 0.08))
                .setAngle(-18 + progress * 540)
                .setDepth(depth + ENTITY_SORT_EFFECT_OFFSET)
                .setVisible(visible);
            }

            mobs.forEach((mob, mobId) => {
              const distanceToTarget = Phaser.Math.Distance.Between(
                mob.sprite.x,
                mob.sprite.y,
                mob.targetX,
                mob.targetY,
              );

              if (distanceToTarget > 64) {
                mob.sprite.setPosition(mob.targetX, mob.targetY);
              } else {
                const lerpFactor = Math.min(1, deltaSeconds * 10);
                mob.sprite.x = Phaser.Math.Linear(mob.sprite.x, mob.targetX, lerpFactor);
                mob.sprite.y = Phaser.Math.Linear(mob.sprite.y, mob.targetY, lerpFactor);
              }

              const movedDeltaX = mob.sprite.x - mob.lastX;
              if (movedDeltaX < -0.05) {
                mob.facingX = -1;
              } else if (movedDeltaX > 0.05) {
                mob.facingX = 1;
              }

              mob.bobPhase += deltaSeconds * 6;
              const bobOffset = Math.sin(mob.bobPhase) * 0.6;
              const serverNow = Date.now();
              const attackStartedAt = mob.currentAttackCooldownEndsAt - mob.currentAttackCooldownMs;
              const attackClip = getPreferredMobClip(mob.baseTexture, 'attack');
              const attackDurationMs = attackClip
                ? getSpriteSheetAnimationDurationMs(toRuntimeAnimationFromMobClip(attackClip))
                : 0;
              const isSkeletonDashLunging =
                mob.currentCastingSkillId === SKELETON_DASH_SKILL_ID &&
                mob.currentSkillLungeStartedAt > 0 &&
                serverNow < mob.currentSkillLungeEndsAt;
              const usesGenericAttackWindow = mob.baseTexture !== 'skeleton';
              const isAttacking =
                !mob.isDead &&
                (
                  isSkeletonDashLunging ||
                  (
                    usesGenericAttackWindow &&
                    mob.currentAttackCooldownEndsAt > 0 &&
                    serverNow >= attackStartedAt &&
                    serverNow <= attackStartedAt + Math.max(150, attackDurationMs)
                  )
                );
              const isMovingNow =
                distanceToTarget > 6 ||
                Math.abs(mob.sprite.x - mob.lastX) > 0.25 ||
                Math.abs(mob.sprite.y - mob.lastY) > 0.25;
              if (!mob.isDead && isMovingNow) {
                mob.lastMovedAt = this.time.now;
              }
              const isMoving =
                !mob.isDead &&
                (isMovingNow || this.time.now - mob.lastMovedAt <= 140);
              const animationState: MobAnimationState = isAttacking
                  ? 'attack'
                  : isMoving
                    ? 'move'
                    : 'idle';

              if (!mob.isDead) {
                syncAnimationState(mob, animationState, this.time.now);
              }

              if (mob.isDead) {
                mob.deathEffect
                  .setPosition(mob.sprite.x, getMobDeathAnimationCenterY(mob))
                  .setScale(mob.renderScale)
                  .setFrame(
                    getSpriteSheetAnimationFrame(
                      SHARED_DEATH_ANIMATION,
                      Math.max(0, this.time.now - mob.deathStartedAt),
                    ),
                  );
                if (isDeathAnimationComplete(SHARED_DEATH_ANIMATION, mob, this.time.now)) {
                  completedDeadMobIds.add(mobId);
                  destroyMob(mobId);
                  return;
                }

                mob.lastX = mob.sprite.x;
                mob.lastY = mob.sprite.y;
                return;
              }
              const renderState = resolveMobRenderState(
                mob.baseTexture,
                this.time.now,
                animationState,
                mob.animationStartedAt,
              );
              if (animationState === 'attack' && attackClip) {
                if (isSkeletonDashLunging) {
                  const totalFrames = Math.max(1, attackClip.endFrame - attackClip.startFrame + 1);
                  const lungeDuration = Math.max(1, mob.currentSkillLungeEndsAt - mob.currentSkillLungeStartedAt);
                  const lungeProgress = Phaser.Math.Clamp(
                    (serverNow - mob.currentSkillLungeStartedAt) / lungeDuration,
                    0,
                    1,
                  );
                  const lungeFrameOffset = Math.min(totalFrames - 1, Math.floor(lungeProgress * totalFrames));
                  renderState.frame = attackClip.startFrame + lungeFrameOffset;
                }
              }
              if (mob.currentTexture !== renderState.textureKey || mob.currentFrame !== renderState.frame) {
                mob.sprite.setTexture(renderState.textureKey, renderState.frame);
                mob.currentTexture = renderState.textureKey;
                mob.currentFrame = renderState.frame;
              }
              mob.renderScale = renderState.renderScale;
              mob.sprite.setOrigin(0.5, renderState.anchorY);
              if (mob.currentBurnTicksRemaining > 0 && mob.currentBurnEndsAt > Date.now()) {
                mob.burnAura.setPosition(mob.sprite.x, mob.sprite.y + 6 + bobOffset * 0.2);
                mob.burnAura.setSize(
                  25 * mob.renderScale + Math.sin(mob.bobPhase * 2.6) * 4,
                  32 * mob.renderScale + Math.cos(mob.bobPhase * 2.1) * 5,
                );
                mob.burnAura.setFillStyle(0xff962f, 0.22 + Math.sin(mob.bobPhase * 3.4) * 0.05);
                mob.burnAura.setVisible(mob.sprite.visible);
              } else {
                mob.burnAura.setVisible(false);
              }
              mob.sprite.setScale(mob.facingX * mob.renderScale, mob.renderScale);
              mob.shadow.setPosition(mob.sprite.x, mob.sprite.y + 15);
              const mobDepth = getEntitySortDepth(getMobFootY(mob), mapHeight);
              mob.shadow.setDepth(mobDepth - ENTITY_SORT_SHADOW_OFFSET);
              mob.burnAura.setDepth(mobDepth - ENTITY_SORT_AURA_OFFSET);
              mob.burnEffect.setDepth(mobDepth - ENTITY_SORT_EFFECT_OFFSET);
              mob.sprite.setDepth(mobDepth);
              mob.deathEffect.setDepth(mobDepth + ENTITY_SORT_EFFECT_OFFSET);
              mob.healthBarFrame.setPosition(mob.sprite.x, mob.sprite.y + 22 + bobOffset);
              mob.healthBarBack.setPosition(mob.sprite.x, mob.sprite.y + 22 + bobOffset);
              mob.healthBarFill.setPosition(mob.sprite.x - 12, mob.sprite.y + 22 + bobOffset);
              mob.castBarFrame.setPosition(mob.sprite.x, mob.sprite.y + 30 + bobOffset);
              mob.castBarBack.setPosition(mob.sprite.x, mob.sprite.y + 30 + bobOffset);
              mob.castBarFill.setPosition(mob.sprite.x - 12, mob.sprite.y + 30 + bobOffset);
              layoutHealthSegments(
                mob.healthSegments,
                mob.sprite.x,
                mob.sprite.y + 22 + bobOffset,
                mob.currentHealthSegmentCount,
              );
              const isCasting =
                mob.currentCastingSkillId.length > 0 &&
                mob.currentCastEndsAt > serverNow &&
                mob.currentCastEndsAt > mob.currentCastStartedAt;
              if (isCasting) {
                const castDuration = Math.max(1, mob.currentCastEndsAt - mob.currentCastStartedAt);
                const castProgress = Phaser.Math.Clamp(
                  (serverNow - mob.currentCastStartedAt) / castDuration,
                  0,
                  1,
                );
                mob.castBarFill.width = 24 * castProgress;
                mob.castBarFrame.setVisible(mob.sprite.visible);
                mob.castBarBack.setVisible(mob.sprite.visible);
                mob.castBarFill.setVisible(mob.sprite.visible);
              } else {
                mob.castBarFrame.setVisible(false);
                mob.castBarBack.setVisible(false);
                mob.castBarFill.setVisible(false);
              }
              updateMobEffectDisplay(mob, mob.sprite.x, mob.sprite.y - 30 + bobOffset * 0.25);
              mob.lastX = mob.sprite.x;
              mob.lastY = mob.sprite.y;
            });

            if (isRaidScene) {
              updateRaidVisibility();
            }

            if (localCharacter) {
              const objectiveTarget = objectiveTargetRef.current;
              const currentRoomName = isRaidScene ? 'raid' : 'world';
              if (objectiveTarget && objectiveTarget.roomName === currentRoomName) {
                const targetDeltaX = objectiveTarget.worldX - localCharacter.container.x;
                const targetDeltaY = objectiveTarget.worldY - localCharacter.container.y;
                const targetDistance = Math.hypot(targetDeltaX, targetDeltaY);
                const cameraWidth = this.scale.width;
                const cameraHeight = this.scale.height;
                const safeZonePaddingX = Math.max(56, Math.min(92, cameraWidth * 0.09));
                const safeZonePaddingY = Math.max(56, Math.min(92, cameraHeight * 0.12));
                const safeZoneLeft = safeZonePaddingX;
                const safeZoneRight = cameraWidth - safeZonePaddingX;
                const safeZoneTop = safeZonePaddingY;
                const safeZoneBottom = cameraHeight - safeZonePaddingY;
                const playerScreenX = (localCharacter.container.x - camera.worldView.x) * camera.zoom;
                const playerScreenY = (localCharacter.container.y - camera.worldView.y) * camera.zoom;
                const targetScreenX = (objectiveTarget.worldX - camera.worldView.x) * camera.zoom;
                const targetScreenY = (objectiveTarget.worldY - camera.worldView.y) * camera.zoom;
                const screenDeltaX = targetScreenX - playerScreenX;
                const screenDeltaY = targetScreenY - playerScreenY;
                const screenDeltaDistance = Math.hypot(screenDeltaX, screenDeltaY);
                const isTargetOnScreen =
                  targetScreenX >= 0 &&
                  targetScreenX <= cameraWidth &&
                  targetScreenY >= 0 &&
                  targetScreenY <= cameraHeight;
                const normalizedTargetX =
                  screenDeltaDistance > 0.001 ? screenDeltaX / screenDeltaDistance : 0;
                const normalizedTargetY =
                  screenDeltaDistance > 0.001 ? screenDeltaY / screenDeltaDistance : -1;
                const arrowSafeInset = 22;
                const safeArrowLeft = safeZoneLeft + arrowSafeInset;
                const safeArrowRight = safeZoneRight - arrowSafeInset;
                const safeArrowTop = safeZoneTop + arrowSafeInset;
                const safeArrowBottom = safeZoneBottom - arrowSafeInset;
                let arrowScreenX = targetScreenX;
                let arrowScreenY = targetScreenY;
                let arrowRotation =
                  screenDeltaDistance > 0.001 ? Math.atan2(screenDeltaY, screenDeltaX) : -Math.PI / 2;

                if (isTargetOnScreen) {
                  const onScreenOffset = 40;
                  const canPlaceAboveTarget = targetScreenY - onScreenOffset >= safeArrowTop;
                  arrowScreenX = Math.max(
                    safeArrowLeft,
                    Math.min(safeArrowRight, targetScreenX),
                  );
                  arrowScreenY = Math.max(
                    safeArrowTop,
                    Math.min(
                      safeArrowBottom,
                      targetScreenY + (canPlaceAboveTarget ? -onScreenOffset : onScreenOffset),
                    ),
                  );
                  arrowRotation = canPlaceAboveTarget ? Math.PI / 2 : -Math.PI / 2;
                } else {
                  const scaleToEdge = (dir: number, origin: number, edgeNeg: number, edgePos: number) => {
                    if (Math.abs(dir) < 0.0001) return Number.POSITIVE_INFINITY;
                    const edge = dir > 0 ? edgePos : edgeNeg;
                    const s = (edge - origin) / dir;
                    return s > 0 ? s : Number.POSITIVE_INFINITY;
                  };
                  const edgeScaleX = scaleToEdge(normalizedTargetX, playerScreenX, safeArrowLeft, safeArrowRight);
                  const edgeScaleY = scaleToEdge(normalizedTargetY, playerScreenY, safeArrowTop, safeArrowBottom);
                  const edgeScale = Math.min(edgeScaleX, edgeScaleY);
                  const safeScale = Number.isFinite(edgeScale) ? edgeScale : 0;

                  arrowScreenX = Math.max(
                    safeArrowLeft,
                    Math.min(safeArrowRight, playerScreenX + normalizedTargetX * safeScale),
                  );
                  arrowScreenY = Math.max(
                    safeArrowTop,
                    Math.min(safeArrowBottom, playerScreenY + normalizedTargetY * safeScale),
                  );
                }

                const arrowVisible = targetDistance > 4;
                const labelPrefix = targetDistance > tileSize * 1.5 ? (locale === 'en' ? 'Target: ' : 'Цель: ') : '';
                objectiveArrowChangeRef.current?.({
                  visible: arrowVisible,
                  screenX: arrowScreenX,
                  screenY: arrowScreenY,
                  rotation: arrowRotation,
                  label: `${labelPrefix}${objectiveTarget.label}`,
                  isOnScreen: isTargetOnScreen,
                });
                objectivePulse
                  .setPosition(objectiveTarget.worldX, objectiveTarget.worldY)
                  .setScale(1 + Math.sin(_time / 180) * 0.16)
                  .setAlpha(0.16 + Math.sin(_time / 140) * 0.05)
                  .setVisible(true);
              } else {
                objectiveArrowChangeRef.current?.(null);
                objectivePulse.setVisible(false);
              }

              if (!isRaidScene) {
                minimapEmitter.emitLobbyMinimapSnapshot(localCharacter.container.x, localCharacter.container.y);
              }

              let closestChest:
                | {
                  id: string;
                  x: number;
                  y: number;
                  distance: number;
                  title: string;
                }
                | null = null;

              if (room && 'chests' in room.state) {
                room.state.chests.forEach((networkChest, chestId) => {
                  const chestX = networkChest.x * tileSize + tileSize / 2;
                  const chestY = networkChest.y * tileSize + tileSize / 2;
                  const dx = chestX - localCharacter.container.x;
                  const dy = chestY - localCharacter.container.y;
                  const distance = Math.hypot(dx, dy);

                  if (!closestChest || distance < closestChest.distance) {
                    closestChest = {
                      id: chestId,
                      x: chestX,
                      y: chestY,
                      distance,
                      title: networkChest.title,
                    };
                  }
                });
              }

              const resolvedChest = closestChest as
                | {
                  id: string;
                  x: number;
                  y: number;
                  distance: number;
                  title: string;
                }
                | null;

              if (resolvedChest) {
                const dx = resolvedChest.x - localCharacter.container.x;
                const dy = resolvedChest.y - localCharacter.container.y;
                const directionLength = Math.hypot(dx, dy) || 1;
                const lookDot =
                  (lastLookX * (dx / directionLength)) +
                  (lastLookY * (dy / directionLength));

                canOpenChest =
                  resolvedChest.distance <= meadowMap.tileSize * 1.5 &&
                  (lookDot >= 0.15 ||
                    Math.abs(dx) <= meadowMap.tileSize * 0.65 ||
                    Math.abs(dy) <= meadowMap.tileSize * 0.65);
                interactableChestId = canOpenChest ? resolvedChest.id : null;
                if (lastNotifiedNearbyChestIdRef.current !== interactableChestId) {
                  lastNotifiedNearbyChestIdRef.current = interactableChestId;
                  nearbyChestChangeRef.current?.(interactableChestId);
                }
                chestPrompt.setText(`F ${resolvedChest.title === 'Loot Bag' ? (locale === 'en' ? 'inspect' : 'осмотреть') : (locale === 'en' ? 'open' : 'открыть')}`);
                chestPrompt.setPosition(
                  localCharacter.container.x,
                  localCharacter.container.y - 42,
                );
                chestPrompt.setVisible(canOpenChest);
              } else {
                interactableChestId = null;
                canOpenChest = false;
                if (lastNotifiedNearbyChestIdRef.current !== null) {
                  lastNotifiedNearbyChestIdRef.current = null;
                  nearbyChestChangeRef.current?.(null);
                }
                chestPrompt.setVisible(false);
              }

              if (!isRaidScene) {
                let closestTrader:
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                    name: string;
                  }
                  | null = null;

                worldTradersById.forEach((trader) => {
                  const traderX = trader.x * tileSize + tileSize / 2;
                  const traderY = trader.y * tileSize + tileSize / 2;
                  const traderVisual = worldTraderVisuals.get(trader.id);
                  const questMarker = traderQuestMarkerRef.current?.(trader) ?? null;
                  if (traderVisual) {
                    if (
                      traderVisual.body &&
                      traderVisual.head &&
                      traderVisual.leftEye &&
                      traderVisual.rightEye &&
                      traderVisual.leftHand &&
                      traderVisual.rightHand
                    ) {
                      const traderBodyAnimation = PLAYER_ANIMATIONS.idle;
                      const traderAnimationStartedAt = traderVisual.animationStartedAt ?? this.time.now;
                      if (traderBodyAnimation) {
                        const bodyFrame = getAnimationFrameAtState(
                          traderBodyAnimation,
                          { animationStartedAt: traderAnimationStartedAt },
                          this.time.now,
                        );
                        traderVisual.body.setTexture(traderBodyAnimation.textureKey, bodyFrame);
                        if (traderVisual.bodyOverlay && traderVisual.bodyOverlayAnimation) {
                          const overlayFrame = getAnimationFrameAtState(
                            traderVisual.bodyOverlayAnimation,
                            { animationStartedAt: traderAnimationStartedAt },
                            this.time.now,
                          );
                          traderVisual.bodyOverlay.setTexture(
                            traderVisual.bodyOverlayAnimation.textureKey,
                            overlayFrame,
                          );
                        }
                        const bodyPixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
                        const headAnimationOffsetY = getPlayerHeadOffsetY(
                          traderBodyAnimation,
                          traderAnimationStartedAt,
                          this.time.now,
                          bodyPixelSize,
                        );
                        traderVisual.head.y = DEFAULT_PLAYER_VISUALS.head.offsetY + headAnimationOffsetY;
                        if (traderVisual.hairOverlay) {
                          traderVisual.hairOverlay.x = trader.hairOffsetX ?? 0;
                          traderVisual.hairOverlay.y =
                            DEFAULT_PLAYER_VISUALS.head.offsetY +
                            headAnimationOffsetY +
                            (trader.hairOffsetY ?? 0);
                        }
                        if (traderVisual.headOverlay) {
                          traderVisual.headOverlay.y = DEFAULT_PLAYER_VISUALS.head.offsetY + headAnimationOffsetY;
                        }
                        const traderEyeDirection = getEyeLookDirection(
                          localCharacter?.container.y,
                          traderVisual.container.y,
                        );
                        const leftEyePosition = getEyeLocalPosition(traderEyeDirection, 'left', tileSize);
                        const rightEyePosition = getEyeLocalPosition(traderEyeDirection, 'right', tileSize);
                        traderVisual.leftEye.setPosition(
                          leftEyePosition.x,
                          leftEyePosition.y + headAnimationOffsetY,
                        );
                        traderVisual.rightEye.setPosition(
                          rightEyePosition.x,
                          rightEyePosition.y + headAnimationOffsetY,
                        );
                        const handOffsets = PLAYER_HAND_ANIMATION_OFFSETS.idle;
                        const handFrameOffset = getSpriteSheetAnimationFrameOffset(
                          traderBodyAnimation,
                          Math.max(0, this.time.now - traderAnimationStartedAt),
                        );
                        const handFrameIndex =
                          handOffsets && handOffsets.leftX.length > 0
                            ? handFrameOffset % handOffsets.leftX.length
                            : 0;
                        const leftHandPosition = getHandLocalPosition(
                          PLAYER_HAND_BASE_OFFSETS.left,
                          {
                            x: handOffsets?.leftX[handFrameIndex] ?? 0,
                            y: handOffsets?.leftY[handFrameIndex] ?? 0,
                          },
                          tileSize,
                        );
                        const rightHandPosition = getHandLocalPosition(
                          PLAYER_HAND_BASE_OFFSETS.right,
                          {
                            x: handOffsets?.rightX[handFrameIndex] ?? 0,
                            y: handOffsets?.rightY[handFrameIndex] ?? 0,
                          },
                          tileSize,
                        );
                        traderVisual.leftHand.setPosition(leftHandPosition.x, leftHandPosition.y);
                        traderVisual.rightHand.setPosition(rightHandPosition.x, rightHandPosition.y);
                      }
                    }
                    const markerVisible = Boolean(questMarker);
                    const bounceOffset = markerVisible ? Math.sin(this.time.now / 180) * 3 : 0;
                    const pulseScale = markerVisible ? 0.6 + (Math.sin(this.time.now / 180) + 1) * 0.04 : 0.6;
                    traderVisual.questMarker
                      .setPosition(traderX, traderY - 36 + bounceOffset)
                      .setText(questMarker?.symbol ?? '')
                      .setColor(questMarker?.color ?? '#ffe699')
                      .setScale(pulseScale)
                      .setAlpha(markerVisible ? 0.9 : 0)
                      .setVisible(markerVisible);
                  }
                  const dx = traderX - localCharacter.container.x;
                  const dy = traderY - localCharacter.container.y;
                  const distance = Math.hypot(dx, dy);

                  if (!closestTrader || distance < closestTrader.distance) {
                    closestTrader = {
                      id: trader.id,
                      x: traderX,
                      y: traderY,
                      distance,
                      name: trader.name,
                    };
                  }
                });

                const resolvedTrader = closestTrader as
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                    name: string;
                  }
                  | null;

                if (resolvedTrader) {
                  const dx = resolvedTrader.x - localCharacter.container.x;
                  const dy = resolvedTrader.y - localCharacter.container.y;
                  const directionLength = Math.hypot(dx, dy) || 1;
                  const lookDot =
                    (lastLookX * (dx / directionLength)) +
                    (lastLookY * (dy / directionLength));

                  canInteractWithTrader =
                    resolvedTrader.distance <= meadowMap.tileSize * 1.5 &&
                    (lookDot >= 0.15 ||
                      Math.abs(dx) <= meadowMap.tileSize * 0.65 ||
                      Math.abs(dy) <= meadowMap.tileSize * 0.65);
                  interactableTraderId = canInteractWithTrader ? resolvedTrader.id : null;
                  if (lastNotifiedNearbyTraderIdRef.current !== interactableTraderId) {
                    lastNotifiedNearbyTraderIdRef.current = interactableTraderId;
                    nearbyTraderChangeRef.current?.(interactableTraderId);
                  }

                  if (!canOpenChest && canInteractWithTrader) {
                    chestPrompt.setText('F TALK');
                    chestPrompt.setPosition(
                      localCharacter.container.x,
                      localCharacter.container.y - 42,
                    );
                    chestPrompt.setVisible(true);
                  }
                } else {
                  interactableTraderId = null;
                  canInteractWithTrader = false;
                  if (lastNotifiedNearbyTraderIdRef.current !== null) {
                    lastNotifiedNearbyTraderIdRef.current = null;
                    nearbyTraderChangeRef.current?.(null);
                  }
                }
              } else {
                interactableTraderId = null;
                canInteractWithTrader = false;
                if (lastNotifiedNearbyTraderIdRef.current !== null) {
                  lastNotifiedNearbyTraderIdRef.current = null;
                  nearbyTraderChangeRef.current?.(null);
                }
              }

              if (!isRaidScene) {
                let closestWorkbench:
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                  }
                  | null = null;

                worldMapRenderState.currentAsset.stamps
                  .filter((stamp) => isBlockingMeadowStamp(stamp))
                  .forEach((stamp) => {
                    const workbenchX = stamp.x * tileSize + tileSize / 2;
                    const workbenchY = stamp.y * tileSize + tileSize / 2;
                    const dx = workbenchX - localCharacter.container.x;
                    const dy = workbenchY - localCharacter.container.y;
                    const distance = Math.hypot(dx, dy);

                    if (!closestWorkbench || distance < closestWorkbench.distance) {
                      closestWorkbench = {
                        id: `workbench:${stamp.x}:${stamp.y}`,
                        x: workbenchX,
                        y: workbenchY,
                        distance,
                      };
                    }
                  });

                const resolvedWorkbench = closestWorkbench as
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                  }
                  | null;

                if (resolvedWorkbench) {
                  const dx = resolvedWorkbench.x - localCharacter.container.x;
                  const dy = resolvedWorkbench.y - localCharacter.container.y;
                  const directionLength = Math.hypot(dx, dy) || 1;
                  const lookDot =
                    (lastLookX * (dx / directionLength)) +
                    (lastLookY * (dy / directionLength));

                  canInteractWithWorkbench =
                    resolvedWorkbench.distance <= meadowMap.tileSize * 1.6 &&
                    (lookDot >= 0.15 ||
                      Math.abs(dx) <= meadowMap.tileSize * 0.75 ||
                      Math.abs(dy) <= meadowMap.tileSize * 0.75);
                  interactableWorkbenchId = canInteractWithWorkbench ? resolvedWorkbench.id : null;
                  if (lastNotifiedNearbyWorkbenchIdRef.current !== interactableWorkbenchId) {
                    lastNotifiedNearbyWorkbenchIdRef.current = interactableWorkbenchId;
                    nearbyWorkbenchChangeRef.current?.(interactableWorkbenchId);
                  }

                  if (!canOpenChest && !canInteractWithTrader && canInteractWithWorkbench) {
                    chestPrompt.setText('F CRAFT');
                    chestPrompt.setPosition(
                      localCharacter.container.x,
                      localCharacter.container.y - 42,
                    );
                    chestPrompt.setVisible(true);
                  }
                } else {
                  interactableWorkbenchId = null;
                  canInteractWithWorkbench = false;
                  if (lastNotifiedNearbyWorkbenchIdRef.current !== null) {
                    lastNotifiedNearbyWorkbenchIdRef.current = null;
                    nearbyWorkbenchChangeRef.current?.(null);
                  }
                }
              } else {
                interactableWorkbenchId = null;
                canInteractWithWorkbench = false;
                if (lastNotifiedNearbyWorkbenchIdRef.current !== null) {
                  lastNotifiedNearbyWorkbenchIdRef.current = null;
                  nearbyWorkbenchChangeRef.current?.(null);
                }
              }

              if (isRaidScene) {
                let closestExit:
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                  }
                  | null = null;

                raidExitSprites.forEach((exitSprite, exitId) => {
                  const dx = exitSprite.ring.x - localCharacter.container.x;
                  const dy = exitSprite.ring.y - localCharacter.container.y;
                  const distance = Math.hypot(dx, dy);

                  if (!closestExit || distance < closestExit.distance) {
                    closestExit = {
                      id: exitId,
                      x: exitSprite.ring.x,
                      y: exitSprite.ring.y,
                      distance,
                    };
                  }
                });

                const resolvedExit = closestExit as
                  | {
                    id: string;
                    x: number;
                    y: number;
                    distance: number;
                  }
                  | null;

                if (resolvedExit && resolvedExit.distance <= meadowMap.tileSize * 1.5) {
                  canUseRaidExit = true;
                  interactableRaidExitId = resolvedExit.id;
                  chestPrompt.setText('F EXIT');
                  chestPrompt.setPosition(
                    localCharacter.container.x,
                    localCharacter.container.y - 42,
                  );
                  chestPrompt.setVisible(true);
                } else {
                  canUseRaidExit = false;
                  interactableRaidExitId = null;
                }
              } else {
                canUseRaidExit = false;
                interactableRaidExitId = null;
              }
            } else {
              interactableChestId = null;
              canOpenChest = false;
              interactableTraderId = null;
              canInteractWithTrader = false;
              interactableWorkbenchId = null;
              canInteractWithWorkbench = false;
              canUseRaidExit = false;
              interactableRaidExitId = null;
              if (lastNotifiedNearbyChestIdRef.current !== null) {
                lastNotifiedNearbyChestIdRef.current = null;
                nearbyChestChangeRef.current?.(null);
              }
              if (lastNotifiedNearbyTraderIdRef.current !== null) {
                lastNotifiedNearbyTraderIdRef.current = null;
                nearbyTraderChangeRef.current?.(null);
              }
              if (lastNotifiedNearbyWorkbenchIdRef.current !== null) {
                lastNotifiedNearbyWorkbenchIdRef.current = null;
                nearbyWorkbenchChangeRef.current?.(null);
              }
              chestPrompt.setVisible(false);
              objectiveArrowChangeRef.current?.(null);
              objectivePulse.setVisible(false);
            }

            if (localCharacter && activeSkillTargetingRef.current) {
              castRangeIndicator.setPosition(localCharacter.container.x, localCharacter.container.y);
              castRangeIndicator.setRadius(
                getCharacterCastRange(latestProfileRef.current.playerEquipment, CAST_HELPERS_CONFIG),
              );
              castRangeIndicator.setVisible(true);
            } else {
              castRangeIndicator.setVisible(false);
            }

            if (!isRaidScene) {
              const latestWorldAssetSerialized = worldMapAssetOverrideSerializedRef.current;
              const latestWorldAsset = worldMapAssetOverrideRef.current;
              if (latestWorldAsset && latestWorldAssetSerialized !== appliedWorldAssetSerialized) {
                appliedWorldAssetSerialized = latestWorldAssetSerialized;
                renderWorldMap(latestWorldAsset);
              }
            }

            if (!isRaidScene && worldEditorEnabledRef.current) {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const tileX = Math.max(0, Math.min(meadowMap.width - 1, Math.floor(pointerWorld.x / tileSize)));
              const tileY = Math.max(0, Math.min(meadowMap.height - 1, Math.floor(pointerWorld.y / tileSize)));
              const previewX = tileX * tileSize + tileSize / 2;
              const previewY = tileY * tileSize + tileSize / 2;
              const currentEditorMode = worldEditorModeRef.current;
              const currentSelectedWorldTile = selectedWorldTileRef.current;
              const currentSelectedWorldSprite = selectedWorldSpriteRef.current;
              const currentSelectedWorldMob = selectedWorldMobRef.current;
              const currentSelectedWorldTrader = selectedWorldTraderRef.current;
              const hoverTileKey = `${tileX}:${tileY}`;
              if (lastWorldHoverTileRef.current !== hoverTileKey) {
                lastWorldHoverTileRef.current = hoverTileKey;
                worldEditHoverChangeRef.current?.({ x: tileX, y: tileY });
              }
              if (currentEditorMode === 'sprite') {
                const previewTextureKey = currentSelectedWorldSprite.texturePath
                  ? getWorldStampTextureKey(currentSelectedWorldSprite.texturePath)
                  : '';
                const nextDebug = {
                  textureKey: previewTextureKey,
                  textureLoaded: previewTextureKey ? this.textures.exists(previewTextureKey) : false,
                };
                const nextDebugSerialized = JSON.stringify(nextDebug);
                if (lastWorldEditDebugRef.current !== nextDebugSerialized) {
                  lastWorldEditDebugRef.current = nextDebugSerialized;
                  worldEditDebugChangeRef.current?.(nextDebug);
                }
              } else if (currentEditorMode === 'mob') {
                const nextDebug = {
                  textureKey: currentSelectedWorldMob.kind,
                  textureLoaded: this.textures.exists(currentSelectedWorldMob.kind),
                };
                const nextDebugSerialized = JSON.stringify(nextDebug);
                if (lastWorldEditDebugRef.current !== nextDebugSerialized) {
                  lastWorldEditDebugRef.current = nextDebugSerialized;
                  worldEditDebugChangeRef.current?.(nextDebug);
                }
              } else if (currentEditorMode === 'trader') {
                const resolvedBodyTexturePath = currentSelectedWorldTrader.bodyItemId
                  ? getEquipmentBodyTexturePath(currentSelectedWorldTrader.bodyItemId)
                  : undefined;
                const resolvedHeadTexturePath = currentSelectedWorldTrader.headItemId
                  ? getEquipmentBodyTexturePath(currentSelectedWorldTrader.headItemId)
                  : undefined;
                const bodyTextureKey = resolvedBodyTexturePath
                  ? getWorldStampTextureKey(resolvedBodyTexturePath)
                  : '';
                const headTextureKey = resolvedHeadTexturePath
                  ? getWorldStampTextureKey(resolvedHeadTexturePath)
                  : '';
                const nextDebug = {
                  textureKey: [bodyTextureKey, headTextureKey].filter(Boolean).join(' + '),
                  textureLoaded:
                    (!bodyTextureKey || this.textures.exists(bodyTextureKey)) &&
                    (!headTextureKey || this.textures.exists(headTextureKey)),
                };
                const nextDebugSerialized = JSON.stringify(nextDebug);
                if (lastWorldEditDebugRef.current !== nextDebugSerialized) {
                  lastWorldEditDebugRef.current = nextDebugSerialized;
                  worldEditDebugChangeRef.current?.(nextDebug);
                }
              } else {
                const nextDebug = {
                  textureKey: '',
                  textureLoaded: false,
                };
                const nextDebugSerialized = JSON.stringify(nextDebug);
                if (lastWorldEditDebugRef.current !== nextDebugSerialized) {
                  lastWorldEditDebugRef.current = nextDebugSerialized;
                  worldEditDebugChangeRef.current?.(nextDebug);
                }
              }

              const previewTexture =
                currentSelectedWorldTile === 'ground'
                  ? 'ground-8x8'
                  : currentSelectedWorldTile === 'water'
                    ? 'water-8x8'
                    : 'grass-8x8';

              worldEditPreviewBase
                .setTexture(previewTexture)
                .setPosition(previewX, previewY)
                .setVisible(currentEditorMode === 'tile');
              worldEditSpawnPreview
                .setPosition(previewX, previewY)
                .setVisible(currentEditorMode === 'spawn');
              worldEditTraderShadow
                .setPosition(previewX, previewY + 15)
                .setVisible(false);
              worldEditTraderContainer
                .setPosition(previewX, previewY)
                .setVisible(false);
              if (currentEditorMode === 'sprite' && currentSelectedWorldSprite.texturePath) {
                const previewTextureKey = getWorldStampTextureKey(currentSelectedWorldSprite.texturePath);
                if (this.textures.exists(previewTextureKey)) {
                  worldEditPreviewSprite
                    .setTexture(previewTextureKey)
                    .setDisplaySize(tileSize * currentSelectedWorldSprite.scale, tileSize * currentSelectedWorldSprite.scale)
                    .setAngle(currentSelectedWorldSprite.rotation)
                    .setFlipX(currentSelectedWorldSprite.flipX)
                    .setPosition(previewX, previewY)
                    .setVisible(true);
                } else if (!pendingWorldTextureKeys.has(previewTextureKey)) {
                  ensureWorldTextureLoaded(currentSelectedWorldSprite.texturePath);
                  worldEditPreviewSprite.setVisible(false);
                } else {
                  worldEditPreviewSprite.setVisible(false);
                }
              } else {
                worldEditPreviewSprite.setVisible(false);
              }
              if (currentEditorMode === 'trader') {
                const resolvedBodyTexturePath = currentSelectedWorldTrader.bodyItemId
                  ? getEquipmentBodyTexturePath(currentSelectedWorldTrader.bodyItemId)
                  : undefined;
                const resolvedHeadTexturePath = currentSelectedWorldTrader.headItemId
                  ? getEquipmentBodyTexturePath(currentSelectedWorldTrader.headItemId)
                  : undefined;
                const traderBodyOverlayAnimation = getWorldTraderBodyOverlayAnimation(
                  resolvedBodyTexturePath,
                  PLAYER_ANIMATIONS.idle,
                );
                const bodyTextureKey = resolvedBodyTexturePath
                  ? traderBodyOverlayAnimation
                    ? traderBodyOverlayAnimation.textureKey
                    : getWorldStampTextureKey(resolvedBodyTexturePath)
                  : '';
                const hairTextureKey = currentSelectedWorldTrader.hairTexturePath
                  ? getWorldStampTextureKey(currentSelectedWorldTrader.hairTexturePath)
                  : '';
                const headTextureKey = resolvedHeadTexturePath
                  ? getWorldStampTextureKey(resolvedHeadTexturePath)
                  : '';
                if (
                  bodyTextureKey &&
                  !this.textures.exists(bodyTextureKey) &&
                  !pendingWorldTextureKeys.has(bodyTextureKey) &&
                  !pendingWorldTraderSheetKeys.has(bodyTextureKey)
                ) {
                  if (resolvedBodyTexturePath) {
                    if (traderBodyOverlayAnimation) {
                      ensureWorldTraderBodyOverlayLoaded(resolvedBodyTexturePath);
                    } else {
                      ensureWorldTextureLoaded(resolvedBodyTexturePath);
                    }
                  }
                }
                if (headTextureKey && !this.textures.exists(headTextureKey) && !pendingWorldTextureKeys.has(headTextureKey)) {
                  if (resolvedHeadTexturePath) {
                    ensureWorldTextureLoaded(resolvedHeadTexturePath);
                  }
                }
                if (hairTextureKey && !this.textures.exists(hairTextureKey) && !pendingWorldTextureKeys.has(hairTextureKey)) {
                  ensureWorldTextureLoaded(currentSelectedWorldTrader.hairTexturePath ?? '');
                }
                if (
                  (!bodyTextureKey || this.textures.exists(bodyTextureKey)) &&
                  (!hairTextureKey || this.textures.exists(hairTextureKey)) &&
                  (!headTextureKey || this.textures.exists(headTextureKey))
                ) {
                  if (bodyTextureKey) {
                    worldEditTraderBodyLayer
                      .setTexture(
                        bodyTextureKey,
                        traderBodyOverlayAnimation ? traderBodyOverlayAnimation.startFrame : undefined,
                      )
                      .setVisible(true);
                  } else {
                    worldEditTraderBodyLayer.setVisible(false);
                  }
                  if (hairTextureKey) {
                    worldEditTraderHairLayer
                      .setTexture(hairTextureKey)
                      .setPosition(
                        currentSelectedWorldTrader.hairOffsetX ?? 0,
                        currentSelectedWorldTrader.hairOffsetY ?? 0,
                      )
                      .setVisible(true);
                  } else {
                    worldEditTraderHairLayer.setVisible(false);
                  }
                  if (headTextureKey) {
                    worldEditTraderHeadLayer
                      .setTexture(headTextureKey)
                      .setVisible(true);
                  } else {
                    worldEditTraderHeadLayer.setVisible(false);
                  }
                  worldEditTraderShadow
                    .setPosition(previewX, previewY + 15)
                    .setVisible(true);
                  worldEditTraderContainer
                    .setPosition(previewX, previewY)
                    .setVisible(true);
                } else {
                  worldEditTraderBodyLayer.setVisible(false);
                  worldEditTraderHairLayer.setVisible(false);
                  worldEditTraderHeadLayer.setVisible(false);
                }
              } else {
                worldEditTraderBodyLayer.setVisible(false);
                worldEditTraderHairLayer.setVisible(false);
                worldEditTraderHeadLayer.setVisible(false);
              }
              worldEditPreviewOverlay.setVisible(false);

              targetingPreviewTiles.forEach((tile) => tile.setVisible(false));
              targetingCursor.setPosition(previewX, previewY);
              targetingCursor.setText('+');
              targetingCursor.setColor('#d7f0b6');
              targetingCursor.setVisible(true);
            } else if (activeSkillTargetingRef.current?.type === 'skill' && activeSkillTargetingRef.current.skillId === 'fireball') {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const originX = localCharacter?.container.x ?? pointerWorld.x;
              const originY = localCharacter?.container.y ?? pointerWorld.y;
              const resolvedTarget = clampTargetToCastRange(
                latestProfileRef.current.playerEquipment,
                originX,
                originY,
                pointerWorld.x,
                pointerWorld.y,
                CAST_HELPERS_CONFIG,
              );
              targetingPreviewTiles.forEach((tile) => tile.setVisible(false));
              targetingCursor.setPosition(pointerWorld.x, pointerWorld.y);
              targetingCursor.setText('+');
              targetingCursor.setColor(resolvedTarget.clamped ? '#ff9a7a' : '#ffd18a');
              targetingCursor.setVisible(true);
            } else if (activeSkillTargetingRef.current?.type === 'skill' && activeSkillTargetingRef.current.skillId === 'fireField') {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const originX = localCharacter?.container.x ?? pointerWorld.x;
              const originY = localCharacter?.container.y ?? pointerWorld.y;
              const resolvedTarget = clampTargetToCastRange(
                latestProfileRef.current.playerEquipment,
                originX,
                originY,
                pointerWorld.x,
                pointerWorld.y,
                CAST_HELPERS_CONFIG,
              );
              const tileX = Math.floor(resolvedTarget.x / meadowMap.tileSize);
              const tileY = Math.floor(resolvedTarget.y / meadowMap.tileSize);
              let previewIndex = 0;

              for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                  const previewTile = targetingPreviewTiles[previewIndex];
                  const previewX = (tileX + offsetX) * meadowMap.tileSize + meadowMap.tileSize / 2;
                  const previewY = (tileY + offsetY) * meadowMap.tileSize + meadowMap.tileSize / 2;
                  previewTile.setPosition(previewX, previewY);
                  previewTile.setFillStyle(resolvedTarget.clamped ? 0xc85a2a : 0xff8b2a, resolvedTarget.clamped ? 0.22 : 0.18);
                  previewTile.setStrokeStyle(1, resolvedTarget.clamped ? 0xffa28a : 0xffd38a, 0.55);
                  previewTile.setVisible(true);
                  previewIndex += 1;
                }
              }

              targetingCursor.setPosition(pointerWorld.x, pointerWorld.y);
              targetingCursor.setText('+');
              targetingCursor.setColor(resolvedTarget.clamped ? '#ff9a7a' : '#ffd18a');
              targetingCursor.setVisible(true);
            } else if (activeSkillTargetingRef.current?.type === 'consumable') {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const tileX = Math.floor(pointerWorld.x / meadowMap.tileSize);
              const tileY = Math.floor(pointerWorld.y / meadowMap.tileSize);
              let previewIndex = 0;

              for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                  const previewTile = targetingPreviewTiles[previewIndex];
                  const previewX = (tileX + offsetX) * meadowMap.tileSize + meadowMap.tileSize / 2;
                  const previewY = (tileY + offsetY) * meadowMap.tileSize + meadowMap.tileSize / 2;
                  previewTile.setPosition(previewX, previewY);
                  previewTile.setFillStyle(0x7ddf8a, 0.16);
                  previewTile.setStrokeStyle(1, 0xc8ffd1, 0.5);
                  previewTile.setVisible(true);
                  previewIndex += 1;
                }
              }

              targetingCursor.setPosition(pointerWorld.x, pointerWorld.y);
              targetingCursor.setText('!');
              targetingCursor.setColor('#c8ffd1');
              targetingCursor.setVisible(true);
            } else {
              if (lastWorldHoverTileRef.current !== null) {
                lastWorldHoverTileRef.current = null;
                worldEditHoverChangeRef.current?.(null);
              }
              const nextDebug = {
                textureKey: '',
                textureLoaded: false,
              };
              const nextDebugSerialized = JSON.stringify(nextDebug);
              if (lastWorldEditDebugRef.current !== nextDebugSerialized) {
                lastWorldEditDebugRef.current = nextDebugSerialized;
                worldEditDebugChangeRef.current?.(nextDebug);
              }
              worldEditPreviewBase.setVisible(false);
              worldEditPreviewOverlay.setVisible(false);
              worldEditPreviewSprite.setVisible(false);
              worldEditSpawnPreview.setVisible(false);
              worldEditTraderShadow.setVisible(false);
              worldEditTraderContainer.setVisible(false);
              worldEditTraderBodyLayer.setVisible(false);
              worldEditTraderHeadLayer.setVisible(false);
              targetingCursor.setVisible(false);
              targetingPreviewTiles.forEach((tile) => tile.setVisible(false));
            }

            if (!isRaidScene) {
              worldMobVisuals.forEach((mobVisual) => {
                const renderState = resolveMobRenderState(mobVisual.kind, this.time.now);
                const mobDepth = getEntitySortDepth(getMobFootY({ sprite: mobVisual.sprite }), mapHeight);
                mobVisual.sprite.setTexture(renderState.textureKey, renderState.frame);
                mobVisual.sprite.setScale(renderState.renderScale);
                mobVisual.sprite.setOrigin(0.5, renderState.anchorY);
                mobVisual.shadow.setPosition(mobVisual.sprite.x, mobVisual.sprite.y + 15);
                mobVisual.shadow.setDepth(mobDepth - ENTITY_SORT_SHADOW_OFFSET);
                mobVisual.sprite.setDepth(mobDepth);
                mobVisual.nameplate.setPosition(mobVisual.sprite.x, mobVisual.sprite.y - 24);
                mobVisual.nameplate.setDepth(mobDepth + ENTITY_SORT_LABEL_OFFSET);
              });
            }

            if (!isRaidScene) {
              worldTraderVisuals.forEach((traderVisual) => {
                const traderDepth = getEntitySortDepth(
                  getWorldTraderFootY(traderVisual, tileSize),
                  mapHeight,
                );
                traderVisual.shadow.setDepth(traderDepth - ENTITY_SORT_SHADOW_OFFSET);
                traderVisual.container.setDepth(traderDepth);
                traderVisual.nameplate.setDepth(traderDepth + ENTITY_SORT_LABEL_OFFSET);
                traderVisual.questMarker.setDepth(traderDepth + ENTITY_SORT_LABEL_OFFSET + 0.02);
              });
            }

            collisionDebugGraphics.clear();
            if (debugCollisionEnabledRef.current) {
              const tileBounds = {
                minX: Math.max(0, Math.floor(camera.worldView.x / tileSize) - 1),
                maxX: Math.min(
                  (isRaidScene ? raidCollisionWidth : meadowMap.width) - 1,
                  Math.ceil((camera.worldView.right ?? (camera.worldView.x + camera.worldView.width)) / tileSize) + 1,
                ),
                minY: Math.max(0, Math.floor(camera.worldView.y / tileSize) - 1),
                maxY: Math.min(
                  (isRaidScene ? raidCollisionHeight : meadowMap.height) - 1,
                  Math.ceil((camera.worldView.bottom ?? (camera.worldView.y + camera.worldView.height)) / tileSize) + 1,
                ),
              };

              for (let tileY = tileBounds.minY; tileY <= tileBounds.maxY; tileY += 1) {
                for (let tileX = tileBounds.minX; tileX <= tileBounds.maxX; tileX += 1) {
                  const tileLeft = tileX * tileSize;
                  const tileTop = tileY * tileSize;
                  if (isRaidScene) {
                    const tileIndex = tileY * raidCollisionWidth + tileX;
                    const isBlocked = raidBlockedTiles[tileIndex] === 1;
                    const isChestBlocked = raidChestBlockedTiles[tileIndex] === 1;
                    if (isBlocked || isChestBlocked) {
                      const color = isChestBlocked ? DEBUG_COLLISION_CHEST_TILE_COLOR : DEBUG_COLLISION_TILE_COLOR;
                      collisionDebugGraphics.fillStyle(color, isChestBlocked ? 0.22 : 0.16);
                      collisionDebugGraphics.fillRect(tileLeft, tileTop, tileSize, tileSize);
                      collisionDebugGraphics.lineStyle(1, color, 0.9);
                      collisionDebugGraphics.strokeRect(tileLeft + 0.5, tileTop + 0.5, tileSize - 1, tileSize - 1);
                    }
                    continue;
                  }

                  if (isBlockedMeadowTile(meadowDecorations, meadowStamps, tileX, tileY)) {
                    collisionDebugGraphics.fillStyle(DEBUG_COLLISION_TILE_COLOR, 0.16);
                    collisionDebugGraphics.fillRect(tileLeft, tileTop, tileSize, tileSize);
                    collisionDebugGraphics.lineStyle(1, DEBUG_COLLISION_TILE_COLOR, 0.9);
                    collisionDebugGraphics.strokeRect(tileLeft + 0.5, tileTop + 0.5, tileSize - 1, tileSize - 1);
                  }
                }
              }

              characters.forEach((character, sessionId) => {
                if (character.isDead || character.isVisible === false) {
                  return;
                }

                const color =
                  sessionId === localSessionId
                    ? DEBUG_COLLISION_PLAYER_COLOR
                    : DEBUG_COLLISION_REMOTE_PLAYER_COLOR;
                collisionDebugGraphics.lineStyle(2, color, 0.95);
                collisionDebugGraphics.strokeEllipse(
                  character.container.x,
                  getPlayerMobCollisionCenterY(character.container.y),
                  WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfWidth * 2,
                  WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfHeight * 2,
                );
              });

              mobs.forEach((mob) => {
                if (mob.isDead || mob.isVisible === false) {
                  return;
                }

                collisionDebugGraphics.lineStyle(2, DEBUG_COLLISION_MOB_COLOR, 0.95);
                collisionDebugGraphics.strokeEllipse(
                  mob.sprite.x,
                  getPlayerMobCollisionCenterY(mob.sprite.y),
                  WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfWidth * 2,
                  WORLD_GAMEPLAY_PROFILE.playerMobCollisionHalfHeight * 2,
                );
              });
            }

            if (
              keyboardEnabled &&
              activeSkillTargetingRef.current === null &&
              interactKey &&
              Phaser.Input.Keyboard.JustDown(interactKey)
            ) {
              if (isRaidScene && canUseRaidExit && interactableRaidExitId) {
                const useExitMessage: UseExitMessage = {
                  exitId: interactableRaidExitId,
                };
                roomRef.current?.send('useExit', useExitMessage);
              } else if (canOpenChest && interactableChestId) {
                chestInteractRef.current?.(interactableChestId);
              } else if (!isRaidScene && canInteractWithTrader && interactableTraderId) {
                const trader = worldTradersById.get(interactableTraderId);
                if (trader) {
                  traderInteractRef.current?.(trader);
                }
              } else if (!isRaidScene && canInteractWithWorkbench && interactableWorkbenchId) {
                const [, tileX, tileY] = interactableWorkbenchId.split(':');
                workbenchInteractRef.current?.({
                  id: interactableWorkbenchId,
                  x: Number(tileX) * tileSize + tileSize / 2,
                  y: Number(tileY) * tileSize + tileSize / 2,
                });
              }
            }
          });

          this.events.once('shutdown', () => {
            sceneActive = false;
            stopLatencyPing();
            chatSenderReadyRef.current?.(null);
            mobs.forEach((_mob, mobId) => destroyMob(mobId));
            projectileSprites.forEach((projectileVisual) => {
              projectileVisual.aura.destroy();
              projectileVisual.sprite.destroy();
            });
            projectileSprites.clear();
            groundEffects.forEach((effectVisual) => {
              effectVisual.tile.destroy();
              effectVisual.aura.destroy();
              effectVisual.flames.forEach((flame) => flame.destroy());
            });
            groundEffects.clear();
            thrownConsumables.forEach((thrownVisual) => {
              thrownVisual.sprite.destroy();
              thrownVisual.shadow.destroy();
            });
            thrownConsumables.length = 0;
            raidTilesData = [];
            raidTileSprites.forEach((tileVisual) => {
              tileVisual.base.destroy();
              tileVisual.overlays.forEach((overlay) => overlay.destroy());
            });
            raidTileSprites.clear();
            chestSprites.forEach((sprite) => sprite.destroy());
            chestSprites.clear();
            raidExitSprites.forEach((exitSprite) => {
              exitSprite.ring.destroy();
              exitSprite.core.destroy();
              exitSprite.label.destroy();
            });
            raidExitSprites.clear();
            worldTraderVisuals.forEach((traderVisual) => {
              traderVisual.shadow.destroy();
              traderVisual.container.destroy();
              traderVisual.nameplate.destroy();
              traderVisual.questMarker.destroy();
            });
            worldTraderVisuals.clear();
            worldMobVisuals.forEach((mobVisual) => {
              mobVisual.shadow.destroy();
              mobVisual.sprite.destroy();
              mobVisual.nameplate.destroy();
            });
            worldMobVisuals.clear();
            minimapChangeRef.current?.(null);
            castRangeIndicator.destroy();
            targetingPreviewTiles.forEach((tile) => tile.destroy());
            targetingCursor.destroy();
            worldEditPreviewBase.destroy();
            worldEditPreviewOverlay.destroy();
            worldEditPreviewSprite.destroy();
            worldEditSpawnPreview.destroy();
            worldEditTraderShadow.destroy();
            worldEditTraderContainer.destroy();
            collisionDebugGraphics.destroy();
            room?.leave();
            roomRef.current = null;
            playerVisualRef.current = null;
            beforePlayerRespawnRef.current = undefined;
            characters.forEach((_character, sessionId) => {
              destroyCharacter(sessionId);
            });
          });
        }
      }

      containerRef.current.replaceChildren();
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: '#6fbe4a',
        pixelArt: true,
        audio: {
          noAudio: true,
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        },
        physics: {
          default: 'arcade',
          arcade: {
            debug: false,
          },
        },
        scene: [MeadowScene],
      });
    };

    void bootstrap();

    return () => {
      mounted = false;
      chatSenderReadyRef.current?.(null);
      roomRef.current?.leave();
      roomRef.current = null;
      playerVisualRef.current = null;
      beforePlayerRespawnRef.current = undefined;
      estimatedOneWayLatencyMsRef.current = 0;
      game?.destroy(true);
    };
  }, [activeRoomName, JSON.stringify(activeRoomOptions), playerName, contentVersion, JSON.stringify(skillEffectOverrides)]);

  return (
    <div
      ref={containerRef}
      data-game-canvas-root="true"
      onContextMenu={(event) => event.preventDefault()}
      className="h-full w-full"
    />
  );
}
