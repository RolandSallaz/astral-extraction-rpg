'use client';

import { useEffect, useRef } from 'react';
import type { Room } from '@colyseus/sdk';
import { COMMON_DEATH_ANIMATION } from '@mmorpg/shared';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import {
  DEFAULT_PLAYER_VISUALS,
  type PlayerAnimationState,
  type PlayerEyeLookDirection,
} from '@mmorpg/shared/player/visuals';
import type {
  AdminUpdateMobBalanceMessage,
  AdminUpdateSkillBalanceMessage,
  BaseProfileMessage,
  CastSkillMessage,
  ChatInputMessage,
  ConsumableCooldownMessage,
  DamageTextMessage,
  DiedMessage,
  EquipmentSyncFields,
  InventoryUpdateMessage,
  MoveMessage,
  RaidExitStateMessage,
  RaidRoomJoinOptions,
  RealtimeChatMessage,
  RespawnedMessage,
  SyncChestMessage,
  UseConsumableMessage,
  UseExitMessage,
  WorldProfileMessage,
  WorldRoomJoinOptions,
} from '@mmorpg/shared/realtime/contracts';
import { FIREBALL_BASE_CAST_TIME_MS } from '@mmorpg/shared/skills/fireball';
import { SKELETON_DASH_SKILL_ID } from '@mmorpg/shared/mobs/skills';
import {
  createDefaultMeadowMapAsset,
  createMeadowDecorations,
  createMeadowDecorationsFromAsset,
  createMeadowMap,
  createMeadowMapFromAsset,
  createMeadowMobsFromAsset,
  createMeadowStampsFromAsset,
  createMeadowTradersFromAsset,
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
  type ConsumableItemId,
  type EquippableItemId,
  type EquipmentItemId,
} from '@/lib/items/equipmentItems';
import { getEquipmentBodyTexturePath } from '@mmorpg/shared/visuals/equipmentVisuals';
import {
  DEFAULT_SKILL_EFFECT_OVERRIDES,
  type SkillEffectConfig,
  type SkillEffectId,
  type SkillEffectOverrides,
} from '@/lib/skillEffects';
import {
  DEFAULT_SKILL_BALANCE_CONFIG,
  type SkillBalanceConfig,
} from '@/lib/skillBalance';
import {
  DEFAULT_MOB_BALANCE_CONFIG,
  type MobBalanceConfig,
} from '@/lib/mobBalance';
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

type PhaserGame = import('phaser').Game;
type PhaserImage = Phaser.GameObjects.Image;
const PLAYER_BODY_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.body.key;
const PLAYER_HEAD_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.head.key;
const PLAYER_BODY_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.body.defaultFrame;
const PLAYER_HEAD_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.head.defaultFrame;
const PLAYER_HANDS_TEXTURE_KEY = 'player-hands';
const PLAYER_HANDS_TEXTURE_PATH = '/character/character_hand.png';
const PLAYER_HANDS_FRAME_WIDTH = 4;
const PLAYER_HANDS_FRAME_HEIGHT = 4;
const PLAYER_HANDS_DEFAULT_FRAME = 0;
const PLAYER_HAND_BASE_OFFSETS = {
  right: { x: 1, y: 11 },
  left: { x: 11, y: 11 },
};
const TRADER_BODY_TEXTURE_KEY = 'body-torso-8x8';
const TRADER_HEAD_TEXTURE_KEY = 'body-head-8x8';
type SheetAnimation = SpriteSheetAnimation & {
  skillId?: SkillEffectId;
};

type PlayerSheetAnimation = SheetAnimation & {
  headOffsetYFrames?: number[];
};

type HandAnimationOffsets = {
  leftX: number[];
  leftY: number[];
  rightX: number[];
  rightY: number[];
};

const PLAYER_ANIMATIONS: Partial<Record<PlayerAnimationState, PlayerSheetAnimation>> =
  Object.fromEntries(
    Object.entries(DEFAULT_PLAYER_VISUALS.animations).map(([state, clip]) => [
      state,
      {
        textureKey: clip.textureKey,
        texturePath: clip.texturePath,
        frameWidth: clip.frameWidth,
        frameHeight: clip.frameHeight,
        startFrame: clip.startFrame,
        startRowFrames: 0,
        frameCount: clip.frameCount,
        fps: 1000 / clip.frameMs,
        columns: 1,
        loop: clip.loop,
        headOffsetYFrames: clip.headOffsetYFrames,
      },
    ]),
  ) as Partial<Record<PlayerAnimationState, PlayerSheetAnimation>>;
const PLAYER_EYE_COLOR = Number.parseInt(DEFAULT_PLAYER_VISUALS.eyes.color.replace('#', ''), 16);
const PLAYER_HAND_ANIMATION_OFFSETS: Partial<Record<PlayerAnimationState, HandAnimationOffsets>> = {
  idle: {
    leftX: [0, 0, -1, 0],
    leftY: [-1, 0, 1, 0],
    rightX: [0, 0, 1, 0],
    rightY: [-1, 0, 1, 0],
  },
  move: {
    leftX: [0, -2, 0, 2],
    leftY: [0, 0, -1, 0],
    rightX: [0, 2, 0, -2],
    rightY: [0, -1, 0, -1],
  },
};
const SHARED_DEATH_ANIMATION: SheetAnimation = {
  textureKey: COMMON_DEATH_ANIMATION.textureKey,
  texturePath: COMMON_DEATH_ANIMATION.texturePath,
  frameWidth: COMMON_DEATH_ANIMATION.frameWidth,
  frameHeight: COMMON_DEATH_ANIMATION.frameHeight,
  startFrame: COMMON_DEATH_ANIMATION.startFrame,
  startRowFrames: 0,
  frameCount: COMMON_DEATH_ANIMATION.frameCount,
  fps: 1000 / COMMON_DEATH_ANIMATION.frameMs,
  columns: 1,
  loop: COMMON_DEATH_ANIMATION.loop,
};

type MovementBlocker = {
  x: number;
  y: number;
  radius: number;
};

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

export type MinimapSnapshot = {
  roomName: 'world' | 'raid';
  width: number;
  height: number;
  tiles: string[];
  explored: number[];
  visible: number[];
  playerTile: {
    x: number;
    y: number;
  };
};

export type WorldTraderInteraction = MeadowTraderAsset;
export type TraderQuestMarker = {
  symbol: '!' | '?';
  color: string;
  state: 'available' | 'active' | 'ready';
} | null;

type CharacterEquipment = {
  body?: EquipmentItemId;
  head?: EquipmentItemId;
  weapon?: EquipmentItemId;
  'head-gem-1'?: EquippableItemId;
  'head-gem-2'?: EquippableItemId;
  'head-gem-3'?: EquippableItemId;
  'body-gem-1'?: EquippableItemId;
  'body-gem-2'?: EquippableItemId;
  'body-gem-3'?: EquippableItemId;
  'weapon-gem-1'?: EquippableItemId;
  'weapon-gem-2'?: EquippableItemId;
  'weapon-gem-3'?: EquippableItemId;
};

type NetworkPlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intellect: number;
  burnTicksRemaining: number;
  burnEndsAt: number;
  healingTicksRemaining: number;
  healingEndsAt: number;
  fireballCooldownEndsAt: number;
  fireNovaCooldownEndsAt: number;
  fireFieldCooldownEndsAt: number;
  castingSkillId?: string;
  castStartedAt?: number;
  castEndsAt?: number;
  lastProcessedInput?: number;
  dead: boolean;
  bodyItem: string;
  headItem: string;
  weaponItem: string;
  headGemItem1?: string;
  headGemItem2?: string;
  headGemItem3?: string;
  bodyGemItem1?: string;
  bodyGemItem2?: string;
  bodyGemItem3?: string;
  weaponGemItem1?: string;
  weaponGemItem2?: string;
  weaponGemItem3?: string;
};

type NetworkGroundEffectState = {
  id: string;
  ownerId: string;
  skillId: string;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  expiresAt: number;
  nextTickAt: number;
};

type NetworkChestState = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  x: number;
  y: number;
  slots: string[];
};

type NetworkMobState = {
  id: string;
  name: string;
  texture: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  maxHealth: number;
  burnTicksRemaining: number;
  burnEndsAt: number;
  castingSkillId: string;
  castStartedAt: number;
  castEndsAt: number;
  skillLungeStartedAt: number;
  skillLungeEndsAt: number;
  attackCooldownMs: number;
  attackCooldownEndsAt: number;
  dead: boolean;
};

type NetworkProjectileState = {
  id: string;
  ownerId: string;
  skillId: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  lifetime: number;
};

type ProjectileVisual = {
  aura: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  targetX: number;
  targetY: number;
  animation: SheetAnimation;
  isVisible?: boolean;
};

type GroundEffectVisual = {
  tile: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Ellipse;
  flames: Phaser.GameObjects.Image[];
  x: number;
  y: number;
  isVisible?: boolean;
};

type RaidTileSpriteVisual = {
  base: Phaser.GameObjects.Image;
  overlays: Phaser.GameObjects.Image[];
};

type CharacterStatusIconVisual = {
  back: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  timerText: Phaser.GameObjects.Text;
};

type WorldTraderVisual = {
  shadow: Phaser.GameObjects.Ellipse;
  container: Phaser.GameObjects.Container;
  actor?: Phaser.GameObjects.GameObject;
  body?: PhaserImage;
  bodyOverlay?: PhaserImage;
  bodyOverlayAnimation?: PlayerSheetAnimation;
  head?: PhaserImage;
  rightHand?: PhaserImage;
  leftHand?: PhaserImage;
  hairOverlay?: PhaserImage;
  headOverlay?: PhaserImage;
  leftEye?: Phaser.GameObjects.Rectangle;
  rightEye?: Phaser.GameObjects.Rectangle;
  animationStartedAt?: number;
  nameplate: Phaser.GameObjects.Text;
  questMarker: Phaser.GameObjects.Text;
};

type WorldMobVisual = {
  kind: MobKind;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  nameplate: Phaser.GameObjects.Text;
};

type ObjectiveTarget = {
  roomName: 'world' | 'raid';
  worldX: number;
  worldY: number;
  label: string;
} | null;

export type ObjectiveArrowState = {
  visible: boolean;
  screenX: number;
  screenY: number;
  rotation: number;
  label: string;
  isOnScreen: boolean;
} | null;

type ProfileSnapshot = {
  playerName: string;
  playerRole: string;
  playerPosition: { x: number; y: number };
  playerHealth: number;
  playerMaxHealth: number;
  playerLevel: number;
  playerExperience: number;
  playerStrength: number;
  playerAgility: number;
  playerIntellect: number;
  playerInventory: Array<string | null>;
  playerEquipment: PlayerEquipment;
};

function createEquipmentSyncFields(equipment: PlayerEquipment): EquipmentSyncFields {
  return {
    bodyItem: equipment.body ?? '',
    headItem: equipment.head ?? '',
    weaponItem: equipment.weapon ?? '',
    headGemItem1: equipment['head-gem-1'] ?? '',
    headGemItem2: equipment['head-gem-2'] ?? '',
    headGemItem3: equipment['head-gem-3'] ?? '',
    bodyGemItem1: equipment['body-gem-1'] ?? '',
    bodyGemItem2: equipment['body-gem-2'] ?? '',
    bodyGemItem3: equipment['body-gem-3'] ?? '',
    weaponGemItem1: equipment['weapon-gem-1'] ?? '',
    weaponGemItem2: equipment['weapon-gem-2'] ?? '',
    weaponGemItem3: equipment['weapon-gem-3'] ?? '',
  };
}

function createBaseProfileMessage(profile: ProfileSnapshot): BaseProfileMessage {
  return {
    name: profile.playerName,
    role: profile.playerRole,
    health: profile.playerHealth,
    maxHealth: profile.playerMaxHealth,
    level: profile.playerLevel,
    experience: profile.playerExperience,
    strength: profile.playerStrength,
    agility: profile.playerAgility,
    intellect: profile.playerIntellect,
    inventory: profile.playerInventory.map((itemId) => itemId ?? ''),
    ...createEquipmentSyncFields(profile.playerEquipment),
  };
}

function createWorldProfileMessage(
  profile: ProfileSnapshot,
  positionOverride?: { x: number; y: number },
): WorldProfileMessage {
  const message: WorldProfileMessage = {
    ...createBaseProfileMessage(profile),
  };

  if (positionOverride) {
    message.position = positionOverride;
  }

  return message;
}

function getWorldStampTextureKey(texturePath: string) {
  return `world-stamp:${encodeURIComponent(texturePath)}`;
}

type MobVisual = {
  shadow: Phaser.GameObjects.Ellipse;
  burnAura: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  deathEffect: PhaserImage;
  burnEffect: PhaserImage;
  burnStatusIcon: CharacterStatusIconVisual;
  nameplate: Phaser.GameObjects.Text;
  healthBarFrame: Phaser.GameObjects.Rectangle;
  healthBarBack: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  castBarFrame: Phaser.GameObjects.Rectangle;
  castBarBack: Phaser.GameObjects.Rectangle;
  castBarFill: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  healthSegments: Phaser.GameObjects.Rectangle[];
  targetX: number;
  targetY: number;
  lastX: number;
  lastY: number;
  bobPhase: number;
  facingX: -1 | 1;
  renderScale: number;
  burnScale: number;
  baseTexture: string;
  currentTexture: string;
  currentFrame?: number;
  currentName: string;
  currentHealth: number;
  currentMaxHealth: number;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnStartedAt: number;
  currentBurnDurationMs: number;
  currentAttackCooldownEndsAt: number;
  currentAttackCooldownMs: number;
  currentCastingSkillId: string;
  currentCastStartedAt: number;
  currentCastEndsAt: number;
  currentSkillLungeStartedAt: number;
  currentSkillLungeEndsAt: number;
  lastMovedAt: number;
  currentAnimationState: MobAnimationState;
  animationStartedAt: number;
  deathStartedAt: number;
  isDead: boolean;
  isVisible?: boolean;
};

type CharacterVisual = {
  shadow: Phaser.GameObjects.Ellipse;
  burnAura: Phaser.GameObjects.Ellipse;
  container: Phaser.GameObjects.Container;
  deathEffect: PhaserImage;
  body: PhaserImage;
  rightHand: PhaserImage;
  leftHand: PhaserImage;
  weaponItem: PhaserImage;
  castItem: PhaserImage;
  burnEffect: PhaserImage;
  weaponEffects: Array<{
    image: PhaserImage;
    aura: Phaser.GameObjects.Ellipse;
    baseX: number;
    baseY: number;
    baseAlpha: number;
    animation?: SheetAnimation;
  }>;
  head: PhaserImage;
  leftEye: Phaser.GameObjects.Rectangle;
  rightEye: Phaser.GameObjects.Rectangle;
  nameplate: Phaser.GameObjects.Text;
  burnStatusIcon: CharacterStatusIconVisual;
  healingStatusIcon: CharacterStatusIconVisual;
  healthBarFrame: Phaser.GameObjects.Rectangle;
  healthBarBack: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  castBarFrame: Phaser.GameObjects.Rectangle;
  castBarBack: Phaser.GameObjects.Rectangle;
  castBarFill: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  healthSegments: Phaser.GameObjects.Rectangle[];
  targetX: number;
  targetY: number;
  lastX: number;
  lastY: number;
  motionPhase: number;
  effectPhase: number;
  facingX: -1 | 1;
  currentName: string;
  currentHealth: number;
  currentMaxHealth: number;
  currentAnimationState: PlayerAnimationState;
  animationStartedAt: number;
  lastMovedAt: number;
  currentWeaponOffsetX: number;
  currentWeaponOffsetY: number;
  currentBodyTextureKey?: string;
  currentBodyFrame?: number;
  currentWeaponItem?: EquipmentItemId;
  currentCastItemId?: ConsumableItemId;
  isFollowTarget: boolean;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnStartedAt: number;
  currentBurnDurationMs: number;
  currentHealingTicksRemaining: number;
  currentHealingEndsAt: number;
  currentHealingStartedAt: number;
  currentHealingDurationMs: number;
  currentCastingSkillId: string;
  currentCastStartedAt: number;
  currentCastEndsAt: number;
  deathStartedAt: number;
  interpPrevX: number;
  interpPrevY: number;
  interpPrevAt: number;
  interpNextX: number;
  interpNextY: number;
  interpNextAt: number;
  simPrevX: number;
  simPrevY: number;
  simX: number;
  simY: number;
  idleGraceUntil: number;
  isDead: boolean;
  isVisible?: boolean;
};

type PlayerVisualRefs = {
  weaponItem: PhaserImage;
};

type WorldRoom = Room<{
  players: Map<string, NetworkPlayerState>;
  mobs: Map<string, NetworkMobState>;
  chests: Map<string, NetworkChestState>;
  groundEffects: Map<string, NetworkGroundEffectState>;
  projectiles: Map<string, NetworkProjectileState>;
}>;

type RaidNetworkPlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  level?: number;
  experience?: number;
  burnTicksRemaining?: number;
  burnEndsAt?: number;
  healingTicksRemaining?: number;
  healingEndsAt?: number;
  fireballCooldownEndsAt?: number;
  fireNovaCooldownEndsAt?: number;
  fireFieldCooldownEndsAt?: number;
  castingSkillId?: string;
  castStartedAt?: number;
  castEndsAt?: number;
  bodyItem?: string;
  headItem?: string;
  weaponItem?: string;
  dead?: boolean;
  lastProcessedInput?: number;
};

type PendingRaidInputSample = {
  sequence: number;
  x: number;
  y: number;
  durationMs: number;
};

type PendingWorldInputSample = {
  sequence: number;
  x: number;
  y: number;
  durationMs: number;
};

type RaidRoom = Room<{
  raidRunId: string;
  templateCode: string;
  templateName: string;
  biome: string;
  seed: string;
  status: string;
  width: number;
  height: number;
  tiles: string[];
  rooms: string[];
  spawnPoints: string[];
  exitPoints: string[];
  players: Map<string, RaidNetworkPlayerState>;
  chests: Map<string, NetworkChestState>;
  groundEffects: Map<string, NetworkGroundEffectState>;
  projectiles: Map<string, NetworkProjectileState>;
}>;

type RealtimeRoom = WorldRoom | RaidRoom;

const CLIENT_PLAYER_SPEED = 120;
const CLIENT_RAID_PLAYER_SPEED = 110;
const FIRE_TRAIL_CAST_PENALTY_MS = 200;
const FIRE_BURST_EXTRA_LOCK_MS = 200;
const FIRE_RANGE_GEM_ID = 'fire_range_gem';
const SKELETON_RENDER_SCALE = 2;
const DEFAULT_MOB_BURN_SCALE = 1;
const STAFF_CAST_RANGE = 32 * 6;
const RAID_VISIBILITY_UPDATE_INTERVAL_MS = 90;
const RAID_MINIMAP_UPDATE_INTERVAL_MS = 260;
const RAID_OBJECT_VISIBILITY_UPDATE_INTERVAL_MS = 140;
const CLIENT_SIMULATION_STEP_MS = 1000 / 30;
const RAID_VISION_RADIUS_TILES = 6;
const RAID_FOOT_TILE_OFFSET_Y = 32 * 0.375;
const RAID_MINIMAP_EXPLORED_STORAGE_PREFIX = 'mmorpg.raid-minimap-explored.v1';

function getRaidExploredStorageKey(raidRunId: string) {
  return `${RAID_MINIMAP_EXPLORED_STORAGE_PREFIX}:${raidRunId}`;
}

function loadStoredRaidExploredTiles(raidRunId: string, maxTiles: number) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getRaidExploredStorageKey(raidRunId));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < maxTiles,
    );
  } catch {
    return [];
  }
}

function saveStoredRaidExploredTiles(raidRunId: string, exploredTiles: Set<number>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const serialized = JSON.stringify(Array.from(exploredTiles.values()).sort((left, right) => left - right));
    window.localStorage.setItem(getRaidExploredStorageKey(raidRunId), serialized);
  } catch {
    // ignore storage quota / parsing failures in dev UI path
  }
}

function resolveCryptTexture(tile: string) {
  switch (tile) {
    case 'roomCracked':
      return { texture: 'crypt-floor-cracked-8x8', alpha: 1, tint: 0xffffff };
    case 'corridorFloor':
    case 'corridorCracked':
      return {
        texture: tile === 'corridorCracked' ? 'crypt-floor-cracked-8x8' : 'crypt-floor-8x8',
        alpha: 1,
        tint: tile === 'corridorCracked' ? 0xd7c8ba : 0xe7ddf2,
      };
    case 'spawnFloor':
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xe0c27a };
    case 'exitFloor':
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xa694e0 };
    case 'wall':
    case 'wallEdge':
      return { texture: 'crypt-wall-8x8', alpha: 1, tint: tile === 'wallEdge' ? 0xf0e3d4 : 0xffffff };
    default:
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xffffff };
  }
}

function getPlayerHeadOffsetY(
  animation: PlayerSheetAnimation | undefined,
  animationStartedAt: number,
  now: number,
  worldPixelSize: number,
) {
  if (!animation?.headOffsetYFrames || animation.headOffsetYFrames.length === 0) {
    return 0;
  }

  const frameOffset = getSpriteSheetAnimationFrameOffset(animation, Math.max(0, now - animationStartedAt));
  const offsetPixels =
    animation.headOffsetYFrames[frameOffset % animation.headOffsetYFrames.length] ?? 0;
  return offsetPixels * worldPixelSize;
}

function getVisualPixelSize(
  visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'displayScale'>,
  tileSize: number,
) {
  const frameWidth = visual.frameWidth ?? 16;
  const rawPixelSize = (tileSize * visual.displayScale) / Math.max(1, frameWidth);
  return Math.max(1, Math.round(rawPixelSize));
}

function getVisualDisplaySize(
  visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'frameHeight' | 'displayScale'>,
  tileSize: number,
) {
  const pixelSize = getVisualPixelSize(visual, tileSize);
  const frameWidth = visual.frameWidth ?? 16;
  const frameHeight = visual.frameHeight ?? 16;
  return {
    width: frameWidth * pixelSize,
    height: frameHeight * pixelSize,
  };
}

function getEyeLookDirection(targetY: number | null | undefined, sourceY: number): PlayerEyeLookDirection {
  if (typeof targetY !== 'number' || !Number.isFinite(targetY)) {
    return 'down';
  }

  return targetY < sourceY ? 'up' : 'down';
}

function getEyeLocalPosition(
  direction: PlayerEyeLookDirection,
  side: 'left' | 'right',
  tileSize: number,
) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
  const frameWidth = DEFAULT_PLAYER_VISUALS.head.frameWidth ?? 16;
  const frameHeight = DEFAULT_PLAYER_VISUALS.head.frameHeight ?? 16;
  const eye = DEFAULT_PLAYER_VISUALS.eyes.positions[direction][side];

  return {
    x: DEFAULT_PLAYER_VISUALS.head.offsetX + (eye.x + 0.5 - frameWidth / 2) * pixelSize,
    y: DEFAULT_PLAYER_VISUALS.head.offsetY + (eye.y + 0.5 - frameHeight / 2) * pixelSize,
  };
}

function getHandLocalPosition(
  base: { x: number; y: number },
  offset: { x: number; y: number },
  tileSize: number,
) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
  const frameWidth = PLAYER_HANDS_FRAME_WIDTH;
  const frameHeight = PLAYER_HANDS_FRAME_HEIGHT;
  const bodyFrameWidth = DEFAULT_PLAYER_VISUALS.body.frameWidth ?? 16;
  const bodyFrameHeight = DEFAULT_PLAYER_VISUALS.body.frameHeight ?? 16;
  const centerX = base.x + offset.x + frameWidth / 2;
  const centerY = base.y + offset.y + frameHeight / 2;

  return {
    x: DEFAULT_PLAYER_VISUALS.body.offsetX + (centerX - bodyFrameWidth / 2) * pixelSize,
    y: DEFAULT_PLAYER_VISUALS.body.offsetY + (centerY - bodyFrameHeight / 2) * pixelSize,
  };
}

function getHandDisplaySize(tileSize: number) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
  return {
    width: PLAYER_HANDS_FRAME_WIDTH * pixelSize,
    height: PLAYER_HANDS_FRAME_HEIGHT * pixelSize,
  };
}

function getSharedDeathAnimationScale(tileSize: number) {
  return getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
}

function getMobDeathAnimationCenterY(mob: Pick<MobVisual, 'sprite'>) {
  return mob.sprite.y + (0.5 - mob.sprite.originY) * mob.sprite.displayHeight;
}

function createSkillAnimation(skillId: SkillEffectId, config: SkillEffectConfig): SheetAnimation {
  return {
    skillId,
    textureKey: `skill-effect-${skillId}`,
    texturePath: config.texturePath,
    frameWidth: config.frameWidth,
    frameHeight: config.frameHeight,
    startFrame: config.startFrame,
    startRowFrames: config.startRowFrames,
    frameCount: config.frameCount,
    fps: config.fps,
    columns: 1,
    loop: true,
  };
}

function canMoveToWorldPosition(
  x: number,
  y: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  meadowMap: ReturnType<typeof createMeadowMap>,
  meadowDecorations: ReturnType<typeof createMeadowDecorations>,
  mobBlockers: MovementBlocker[] = [],
) {
  const clampedX = Math.max(tileSize / 2, Math.min(mapWidth - tileSize / 2, x));
  const clampedY = Math.max(tileSize / 2, Math.min(mapHeight - tileSize / 2, y));
  const tileX = Math.floor(clampedX / tileSize);
  const tileY = Math.floor(clampedY / tileSize);

  if (isBlockedMeadowTile(meadowMap, meadowDecorations, tileX, tileY)) {
    return false;
  }

  for (const blocker of mobBlockers) {
    if (Phaser.Math.Distance.Between(clampedX, clampedY, blocker.x, blocker.y) < blocker.radius) {
      return false;
    }
  }

  return true;
}

function canMoveToRaidWorldPosition(
  x: number,
  y: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  blockedTiles: Uint8Array,
  width: number,
  height: number,
  chestBlockedTiles?: Uint8Array,
  mobBlockers: MovementBlocker[] = [],
) {
  const clampedX = Math.max(tileSize / 2, Math.min(mapWidth - tileSize / 2, x));
  const clampedY = Math.max(tileSize / 2, Math.min(mapHeight - tileSize / 2, y + tileSize * 0.375));
  const tileX = Math.floor(clampedX / tileSize);
  const tileY = Math.floor(clampedY / tileSize);

  if (tileX < 0 || tileY < 0 || tileX >= width || tileY >= height) {
    return false;
  }

  const tileIndex = tileY * width + tileX;
  const blockedByChest = chestBlockedTiles?.[tileIndex] === 1;
  if (blockedTiles[tileIndex] === 1 || blockedByChest) {
    return false;
  }

  for (const blocker of mobBlockers) {
    if (Phaser.Math.Distance.Between(clampedX, y, blocker.x, blocker.y) < blocker.radius) {
      return false;
    }
  }

  return true;
}

function applyWorldPredictedMovement(
  currentX: number,
  currentY: number,
  inputX: number,
  inputY: number,
  durationMs: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  meadowMap: ReturnType<typeof createMeadowMap>,
  meadowDecorations: ReturnType<typeof createMeadowDecorations>,
  speed: number,
  mobBlockers: MovementBlocker[] = [],
) {
  const deltaSeconds = durationMs / 1000;
  const nextX = Phaser.Math.Clamp(
    currentX + inputX * speed * deltaSeconds,
    tileSize / 2,
    mapWidth - tileSize / 2,
  );
  const nextY = Phaser.Math.Clamp(
    currentY + inputY * speed * deltaSeconds,
    tileSize / 2,
    mapHeight - tileSize / 2,
  );

  if (
    canMoveToWorldPosition(
      nextX,
      nextY,
      tileSize,
      mapWidth,
      mapHeight,
      meadowMap,
      meadowDecorations,
      mobBlockers,
    )
  ) {
    return { x: nextX, y: nextY };
  }

  return { x: currentX, y: currentY };
}

function applyRaidPredictedMovement(
  currentX: number,
  currentY: number,
  inputX: number,
  inputY: number,
  deltaSeconds: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  blockedTiles: Uint8Array,
  width: number,
  height: number,
  chestBlockedTiles: Uint8Array,
  speed: number,
  mobBlockers: MovementBlocker[] = [],
) {
  const nextX = Phaser.Math.Clamp(
    currentX + inputX * speed * deltaSeconds,
    tileSize / 2,
    mapWidth - tileSize / 2,
  );
  const nextY = Phaser.Math.Clamp(
    currentY + inputY * speed * deltaSeconds,
    tileSize / 2,
    mapHeight - tileSize / 2,
  );

  let resolvedX = currentX;
  let resolvedY = currentY;

  if (
    canMoveToRaidWorldPosition(
      nextX,
      currentY,
      tileSize,
      mapWidth,
      mapHeight,
      blockedTiles,
      width,
      height,
      chestBlockedTiles,
      mobBlockers,
    )
  ) {
    resolvedX = nextX;
  }

  if (
    canMoveToRaidWorldPosition(
      resolvedX,
      nextY,
      tileSize,
      mapWidth,
      mapHeight,
      blockedTiles,
      width,
      height,
      chestBlockedTiles,
      mobBlockers,
    )
  ) {
    resolvedY = nextY;
  }

  return { x: resolvedX, y: resolvedY };
}

function isRaidBlockingTile(tile: string | undefined) {
  return tile === 'wall' || tile === 'wallEdge';
}

function getRaidTilePositionFromWorld(
  x: number,
  y: number,
  tileSize: number,
  width: number,
  height: number,
) {
  const tileX = Math.max(0, Math.min(width - 1, Math.floor(x / tileSize)));
  const tileY = Math.max(0, Math.min(height - 1, Math.floor((y + RAID_FOOT_TILE_OFFSET_Y) / tileSize)));

  return { tileX, tileY };
}

function hasRaidLineOfSight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tiles: string[],
  width: number,
  height: number,
) {
  let x0 = fromX;
  let y0 = fromY;
  const x1 = toX;
  const y1 = toY;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) {
      return false;
    }

    const tile = tiles[y0 * width + x0];
    if (x0 === x1 && y0 === y1) {
      return true;
    }

    if (isRaidBlockingTile(tile)) {
      return false;
    }
  }

  return true;
}

function computeRaidVisibleTiles(
  originTileX: number,
  originTileY: number,
  radius: number,
  tiles: string[],
  width: number,
  height: number,
) {
  const visibleTiles = new Set<number>();

  for (let y = Math.max(0, originTileY - radius); y <= Math.min(height - 1, originTileY + radius); y += 1) {
    for (let x = Math.max(0, originTileX - radius); x <= Math.min(width - 1, originTileX + radius); x += 1) {
      const dx = x - originTileX;
      const dy = y - originTileY;
      if (Math.hypot(dx, dy) > radius + 0.35) {
        continue;
      }

      if (hasRaidLineOfSight(originTileX, originTileY, x, y, tiles, width, height)) {
        visibleTiles.add(y * width + x);
      }
    }
  }

  visibleTiles.add(originTileY * width + originTileX);

  const wallRevealOffsets = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];

  for (const tileIndex of [...visibleTiles]) {
    const tileX = tileIndex % width;
    const tileY = Math.floor(tileIndex / width);

    for (const offset of wallRevealOffsets) {
      const neighborX = tileX + offset.x;
      const neighborY = tileY + offset.y;
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) {
        continue;
      }

      const neighborTile = tiles[neighborY * width + neighborX];
      if (!isRaidBlockingTile(neighborTile)) {
        continue;
      }

      const dx = neighborX - originTileX;
      const dy = neighborY - originTileY;
      if (Math.hypot(dx, dy) > radius + 0.75) {
        continue;
      }

      visibleTiles.add(neighborY * width + neighborX);
    }
  }

  return visibleTiles;
}

function toEquipmentItemId(value?: string): EquipmentItemId | undefined {
  if (value && value in EQUIPMENT_ITEMS) {
    return value as EquipmentItemId;
  }

  return undefined;
}

function toConsumableItemId(value?: string): ConsumableItemId | undefined {
  if (!value || !(value in EQUIPMENT_ITEMS)) {
    return undefined;
  }

  return EQUIPMENT_ITEMS[value as ConsumableItemId].type === 'consumable'
    ? (value as ConsumableItemId)
    : undefined;
}

function applyEquipmentToVisual(
  scene: Phaser.Scene,
  tileSize: number,
  visual: (PlayerVisualRefs & {
    container: Phaser.GameObjects.Container;
    burnEffect: PhaserImage;
    weaponEffects: Array<{
      image: PhaserImage;
      aura: Phaser.GameObjects.Ellipse;
      baseX: number;
      baseY: number;
      baseAlpha: number;
      animation?: SheetAnimation;
    }>;
    currentWeaponItem?: EquipmentItemId;
    currentWeaponOffsetX: number;
    currentWeaponOffsetY: number;
  }) | null,
  equipment: CharacterEquipment,
) {
  if (!visual) {
    return;
  }

  const weaponItemId = equipment.weapon;
  const weaponItem = weaponItemId ? EQUIPMENT_ITEMS[weaponItemId] : undefined;

  if (weaponItemId !== visual.currentWeaponItem) {
    visual.weaponEffects.forEach(({ image, aura }) => {
      image.destroy();
      aura.destroy();
    });
    visual.weaponEffects = [];

    if (weaponItemId) {
      visual.weaponItem.setTexture(weaponItem!.textureKey);
      visual.weaponItem.setAngle(weaponItem!.worldRotationDeg ?? 0);
      visual.weaponItem.setScale(weaponItem!.worldScale ?? 1);
      visual.weaponItem.setVisible(true);

      weaponItem!.worldEffects?.forEach((effect) => {
        const effectAura = scene.add
          .ellipse(effect.offsetX, effect.offsetY, tileSize * 0.95, tileSize * 0.95, 0xff9a36, 0.38)
          .setOrigin(0.5);
        const effectImage = scene.add
          .image(effect.offsetX, effect.offsetY, effect.textureKey, 0)
          .setDisplaySize(tileSize, tileSize)
          .setScale(effect.scale ?? 1)
          .setAlpha(effect.alpha ?? 1)
          .setAngle(effect.rotationDeg ?? 0)
          .setOrigin(0.5);
        visual.container.add(effectAura);
        visual.container.add(effectImage);
        visual.container.bringToTop(effectAura);
        visual.container.bringToTop(effectImage);

        visual.weaponEffects.push({
          image: effectImage,
          aura: effectAura,
          baseX: effect.offsetX,
          baseY: effect.offsetY,
          baseAlpha: effect.alpha ?? 1,
          animation:
            effect.frameCount && effect.frameDurationMs
              ? {
                textureKey: effect.textureKey,
                texturePath: effect.texturePath,
                frameWidth: effect.frameWidth ?? 32,
                frameHeight: effect.frameHeight ?? 32,
                startFrame: 0,
                startRowFrames: 0,
                frameCount: effect.frameCount,
                fps: 1000 / effect.frameDurationMs,
                columns: 1,
                loop: true,
              }
              : undefined,
        });
      });
    } else {
      visual.weaponItem.setAngle(0);
      visual.weaponItem.setScale(1);
      visual.weaponItem.setVisible(false);
    }
    visual.currentWeaponItem = weaponItemId;
  } else if (weaponItemId) {
    visual.weaponItem.setTexture(weaponItem!.textureKey);
    visual.weaponItem.setAngle(weaponItem!.worldRotationDeg ?? 0);
    visual.weaponItem.setScale(weaponItem!.worldScale ?? 1);
    visual.weaponItem.setVisible(true);
    visual.weaponEffects.forEach(({ image, aura }) => {
      visual.container.bringToTop(aura);
      visual.container.bringToTop(image);
    });
    visual.container.bringToTop(visual.burnEffect);
  }
  visual.currentWeaponOffsetX = weaponItem?.equippedOffsetX ?? 0;
  visual.currentWeaponOffsetY = weaponItem?.equippedOffsetY ?? 0;
}

function applyMobHealthToVisual(
  visual: Pick<
    MobVisual,
    'healthBarFill' | 'healthText' | 'healthSegments' | 'currentHealth' | 'currentMaxHealth'
  >,
  health: number,
  maxHealth: number,
) {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeHealth = Phaser.Math.Clamp(Math.floor(health), 0, safeMaxHealth);
  const hpRatio = Phaser.Math.Clamp(safeHealth / safeMaxHealth, 0, 1);
  const filledSegments = Math.round(hpRatio * visual.healthSegments.length);

  visual.currentHealth = safeHealth;
  visual.currentMaxHealth = safeMaxHealth;
  visual.healthBarFill.width = 24 * hpRatio;
  visual.healthText.setText(`${safeHealth}/${safeMaxHealth}`);

  visual.healthSegments.forEach((segment, index) => {
    const isFilled = index < filledSegments;
    segment.setFillStyle(isFilled ? 0xef4444 : 0x2a140f, isFilled ? 1 : 0.9);
  });
}

function applyCharacterHealthToVisual(
  visual: Pick<
    CharacterVisual,
    'healthBarFill' | 'healthText' | 'healthSegments' | 'currentHealth' | 'currentMaxHealth'
  >,
  health: number,
  maxHealth: number,
) {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeHealth = Phaser.Math.Clamp(Math.floor(health), 0, safeMaxHealth);
  const hpRatio = Phaser.Math.Clamp(safeHealth / safeMaxHealth, 0, 1);
  const filledSegments = Math.round(hpRatio * visual.healthSegments.length);

  visual.currentHealth = safeHealth;
  visual.currentMaxHealth = safeMaxHealth;
  visual.healthBarFill.width = 24 * hpRatio;
  visual.healthText.setText(`${safeHealth}/${safeMaxHealth}`);

  visual.healthSegments.forEach((segment, index) => {
    const isFilled = index < filledSegments;
    segment.setFillStyle(isFilled ? 0xef4444 : 0x2a140f, isFilled ? 1 : 0.9);
  });
}

function applyBurningToCharacterVisual(
  visual: Pick<CharacterVisual, 'burnEffect' | 'burnAura' | 'currentBurnTicksRemaining' | 'currentBurnEndsAt' | 'currentBurnStartedAt' | 'currentBurnDurationMs' | 'container'>,
  burnTicksRemaining: number,
  burnEndsAt: number,
) {
  const now = Date.now();
  const safeBurnTicks = Math.max(0, Math.floor(burnTicksRemaining));
  const safeBurnEndsAt = Math.max(0, Math.floor(burnEndsAt));
  const hasActiveBurn = safeBurnTicks > 0 && safeBurnEndsAt > now;
  const shouldResetBurnTiming =
    hasActiveBurn &&
    (
      visual.currentBurnEndsAt <= now ||
      safeBurnTicks > visual.currentBurnTicksRemaining ||
      safeBurnEndsAt > visual.currentBurnEndsAt + 150
    );

  visual.currentBurnTicksRemaining = safeBurnTicks;
  visual.currentBurnEndsAt = safeBurnEndsAt;
  if (shouldResetBurnTiming) {
    visual.currentBurnStartedAt = now;
    visual.currentBurnDurationMs = Math.max(1, safeBurnEndsAt - now);
  } else if (!hasActiveBurn) {
    visual.currentBurnStartedAt = 0;
    visual.currentBurnDurationMs = 0;
  }
  visual.burnEffect.setVisible(false);
  visual.burnAura.setVisible(hasActiveBurn && visual.container.visible);
}

function applyHealingToCharacterVisual(
  visual: Pick<CharacterVisual, 'currentHealingTicksRemaining' | 'currentHealingEndsAt' | 'currentHealingStartedAt' | 'currentHealingDurationMs'>,
  healingTicksRemaining: number,
  healingEndsAt: number,
) {
  const now = Date.now();
  const safeHealingTicks = Math.max(0, Math.floor(healingTicksRemaining));
  const safeHealingEndsAt = Math.max(0, Math.floor(healingEndsAt));
  const hasActiveHealing = safeHealingTicks > 0 && safeHealingEndsAt > now;
  const shouldResetHealingTiming =
    hasActiveHealing &&
    (
      visual.currentHealingEndsAt <= now ||
      safeHealingTicks > visual.currentHealingTicksRemaining ||
      safeHealingEndsAt > visual.currentHealingEndsAt + 150
    );

  visual.currentHealingTicksRemaining = safeHealingTicks;
  visual.currentHealingEndsAt = safeHealingEndsAt;
  if (shouldResetHealingTiming) {
    visual.currentHealingStartedAt = now;
    visual.currentHealingDurationMs = Math.max(1, safeHealingEndsAt - now);
  } else if (!hasActiveHealing) {
    visual.currentHealingStartedAt = 0;
    visual.currentHealingDurationMs = 0;
  }
}

function hideStatusIcon(icon: CharacterStatusIconVisual) {
  icon.back.setVisible(false);
  icon.cooldownOverlay.setVisible(false);
  icon.icon.setVisible(false);
  icon.timerText.setVisible(false);
}

function updateCharacterEffectDisplay(
  visual: Pick<CharacterVisual, 'container' | 'burnStatusIcon' | 'healingStatusIcon' | 'currentBurnTicksRemaining' | 'currentBurnEndsAt' | 'currentBurnDurationMs' | 'currentHealingTicksRemaining' | 'currentHealingEndsAt' | 'currentHealingDurationMs'>,
  centerX: number,
  centerY: number,
) {
  if (!visual.container.visible) {
    hideStatusIcon(visual.burnStatusIcon);
    hideStatusIcon(visual.healingStatusIcon);
    return;
  }

  const now = Date.now();
  const isBurning = visual.currentBurnTicksRemaining > 0 && visual.currentBurnEndsAt > now;
  const isHealing = visual.currentHealingTicksRemaining > 0 && visual.currentHealingEndsAt > now;
  const activeEffects: Array<{
    icon: CharacterStatusIconVisual;
    textureKey: string;
    frame?: number;
    tint: number;
    remainingSeconds: number;
    backgroundColor: number;
    totalDurationMs: number;
    endsAt: number;
  }> = [];

  if (isBurning) {
    activeEffects.push({
      icon: visual.burnStatusIcon,
      textureKey: 'effect-fire-sheet',
      frame: 0,
      tint: 0xffffff,
      remainingSeconds: Math.ceil(Math.max(0, visual.currentBurnEndsAt - now) / 1000),
      backgroundColor: 0x5a1f0f,
      totalDurationMs: visual.currentBurnDurationMs,
      endsAt: visual.currentBurnEndsAt,
    });
  }

  if (isHealing) {
    activeEffects.push({
      icon: visual.healingStatusIcon,
      textureKey: EQUIPMENT_ITEMS.healing_potion.textureKey,
      tint: 0xc7ffb0,
      remainingSeconds: Math.ceil(Math.max(0, visual.currentHealingEndsAt - now) / 1000),
      backgroundColor: 0x12350f,
      totalDurationMs: visual.currentHealingDurationMs,
      endsAt: visual.currentHealingEndsAt,
    });
  }

  if (activeEffects.length === 0) {
    hideStatusIcon(visual.burnStatusIcon);
    hideStatusIcon(visual.healingStatusIcon);
    return;
  }

  const spacing = 16;
  const iconSize = 16;
  const startX = centerX - ((activeEffects.length - 1) * spacing) / 2;
  [visual.burnStatusIcon, visual.healingStatusIcon].forEach((icon) => hideStatusIcon(icon));

  activeEffects.forEach((effect, index) => {
    const x = startX + index * spacing;
    const remainingMs = Math.max(0, effect.endsAt - now);
    const progress = effect.totalDurationMs > 0
      ? Phaser.Math.Clamp(remainingMs / effect.totalDurationMs, 0, 1)
      : 0;
    const overlayHeight = Math.max(0, iconSize * progress);
    effect.icon.back.setPosition(x, centerY);
    effect.icon.back.setFillStyle(effect.backgroundColor, 0.92);
    effect.icon.back.setVisible(true);
    effect.icon.cooldownOverlay.setPosition(x, centerY - iconSize / 2);
    effect.icon.cooldownOverlay.setSize(iconSize, overlayHeight);
    effect.icon.cooldownOverlay.setVisible(overlayHeight > 0.5);
    effect.icon.icon.setPosition(x, centerY);
    effect.icon.icon.setTexture(effect.textureKey, effect.frame);
    effect.icon.icon.setTint(effect.tint);
    effect.icon.icon.setVisible(true);
    effect.icon.timerText.setPosition(x, centerY + 0.5);
    effect.icon.timerText.setText(`${Math.max(1, effect.remainingSeconds)}`);
    effect.icon.timerText.setVisible(true);
  });
}

function getCharacterCastTimeMs(equipment: PlayerEquipment) {
  let castTimeMs = FIREBALL_BASE_CAST_TIME_MS;

  if (
    equipment['weapon-gem-1'] === 'fire_trail_gem' ||
    equipment['weapon-gem-2'] === 'fire_trail_gem' ||
    equipment['weapon-gem-3'] === 'fire_trail_gem'
  ) {
    castTimeMs += FIRE_TRAIL_CAST_PENALTY_MS;
  }

  if (
    equipment['weapon-gem-1'] === 'cast_speed_gem' ||
    equipment['weapon-gem-2'] === 'cast_speed_gem' ||
    equipment['weapon-gem-3'] === 'cast_speed_gem'
  ) {
    castTimeMs *= 0.65;
  }

  if (
    equipment['weapon-gem-1'] === 'fire_burst_gem' ||
    equipment['weapon-gem-2'] === 'fire_burst_gem' ||
    equipment['weapon-gem-3'] === 'fire_burst_gem'
  ) {
    castTimeMs += FIRE_BURST_EXTRA_LOCK_MS;
  }

  return Math.round(castTimeMs);
}

function getCharacterCastRange(equipment: PlayerEquipment) {
  if (
    equipment['weapon-gem-1'] === FIRE_RANGE_GEM_ID ||
    equipment['weapon-gem-2'] === FIRE_RANGE_GEM_ID ||
    equipment['weapon-gem-3'] === FIRE_RANGE_GEM_ID
  ) {
    return STAFF_CAST_RANGE * 1.25;
  }

  return STAFF_CAST_RANGE;
}

function applyCastingToCharacterVisual(
  visual: Pick<CharacterVisual, 'currentCastingSkillId' | 'currentCastStartedAt' | 'currentCastEndsAt'>,
  castingSkillId: string,
  castStartedAt: number,
  castEndsAt: number,
) {
  visual.currentCastingSkillId = castingSkillId;
  visual.currentCastStartedAt = Math.max(0, castStartedAt);
  visual.currentCastEndsAt = Math.max(0, castEndsAt);
}

function getHeldCastConsumableItemId(
  visual: Pick<CharacterVisual, 'currentCastingSkillId' | 'currentCastEndsAt'>,
): ConsumableItemId | undefined {
  if (visual.currentCastingSkillId.length === 0 || visual.currentCastEndsAt <= Date.now()) {
    return undefined;
  }

  return toConsumableItemId(visual.currentCastingSkillId);
}

function applyBurningToMobVisual(
  visual: Pick<MobVisual, 'burnEffect' | 'burnAura' | 'currentBurnTicksRemaining' | 'currentBurnEndsAt' | 'currentBurnStartedAt' | 'currentBurnDurationMs' | 'sprite'>,
  burnTicksRemaining: number,
  burnEndsAt: number,
) {
  const now = Date.now();
  const safeBurnTicks = Math.max(0, Math.floor(burnTicksRemaining));
  const safeBurnEndsAt = Math.max(0, Math.floor(burnEndsAt));
  const hasActiveBurn = safeBurnTicks > 0 && safeBurnEndsAt > now;
  const shouldResetBurnTiming =
    hasActiveBurn &&
    (
      visual.currentBurnEndsAt <= now ||
      safeBurnTicks > visual.currentBurnTicksRemaining ||
      safeBurnEndsAt > visual.currentBurnEndsAt + 150
    );

  visual.currentBurnTicksRemaining = safeBurnTicks;
  visual.currentBurnEndsAt = safeBurnEndsAt;
  if (shouldResetBurnTiming) {
    visual.currentBurnStartedAt = now;
    visual.currentBurnDurationMs = Math.max(1, safeBurnEndsAt - now);
  } else if (!hasActiveBurn) {
    visual.currentBurnStartedAt = 0;
    visual.currentBurnDurationMs = 0;
  }
  visual.burnEffect.setVisible(false);
  visual.burnAura.setVisible(hasActiveBurn && visual.sprite.visible);
}

function updateMobEffectDisplay(
  visual: Pick<MobVisual, 'sprite' | 'burnStatusIcon' | 'currentBurnTicksRemaining' | 'currentBurnEndsAt' | 'currentBurnDurationMs'>,
  centerX: number,
  centerY: number,
) {
  if (!visual.sprite.visible) {
    hideStatusIcon(visual.burnStatusIcon);
    return;
  }

  const now = Date.now();
  const isBurning = visual.currentBurnTicksRemaining > 0 && visual.currentBurnEndsAt > now;
  if (!isBurning) {
    hideStatusIcon(visual.burnStatusIcon);
    return;
  }

  const remainingMs = Math.max(0, visual.currentBurnEndsAt - now);
  const iconSize = 16;
  const progress = visual.currentBurnDurationMs > 0
    ? Phaser.Math.Clamp(remainingMs / visual.currentBurnDurationMs, 0, 1)
    : 0;
  const overlayHeight = Math.max(0, iconSize * progress);
  visual.burnStatusIcon.back.setPosition(centerX, centerY);
  visual.burnStatusIcon.back.setFillStyle(0x5a1f0f, 0.92);
  visual.burnStatusIcon.back.setVisible(true);
  visual.burnStatusIcon.cooldownOverlay.setPosition(centerX, centerY - iconSize / 2);
  visual.burnStatusIcon.cooldownOverlay.setSize(iconSize, overlayHeight);
  visual.burnStatusIcon.cooldownOverlay.setVisible(overlayHeight > 0.5);
  visual.burnStatusIcon.icon.setPosition(centerX, centerY);
  visual.burnStatusIcon.icon.setTexture('effect-fire-sheet', 0);
  visual.burnStatusIcon.icon.setTint(0xffffff);
  visual.burnStatusIcon.icon.setVisible(true);
  visual.burnStatusIcon.timerText.setPosition(centerX, centerY + 0.5);
  visual.burnStatusIcon.timerText.setText(`${Math.max(1, Math.ceil(remainingMs / 1000))}`);
  visual.burnStatusIcon.timerText.setVisible(true);
}

function getRealtimeEndpoint() {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_REALTIME_URL;
  }

  return 'ws://localhost:2567';
}

async function loadWorldMapAsset(): Promise<MeadowMapAsset> {
  try {
    const response = await fetch('/api/world-map', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load world map asset');
    }

    return await response.json() as MeadowMapAsset;
  } catch {
    return createDefaultMeadowMapAsset();
  }
}

function getMobRenderScale(texture: string) {
  if (texture === 'skeleton') {
    return SKELETON_RENDER_SCALE;
  }

  if (texture === 'skeleton-npc-16x16') {
    return SKELETON_RENDER_SCALE;
  }

  if (texture === 'bat') {
    return 2;
  }

  if (texture === 'rat') {
    return 2;
  }

  return 1;
}

function getAnimatedMobTexture(texture: string, timeMs: number) {
  if (texture === 'bat' || texture === 'rat') {
    const frame = Math.floor(timeMs / 240) % 2 === 0 ? 1 : 2;
    return `${texture}_${frame}`;
  }

  return texture;
}

function getMobClipTextureKey(spritesheet: string) {
  return `mob-clip:${encodeURIComponent(spritesheet)}`;
}

function getMobVisualKind(texture: string) {
  return texture === 'bat' || texture === 'rat' || texture === 'skeleton' ? texture : null;
}

function toRuntimeAnimationFromMobClip(clip: MobAnimationClipDefinition): SheetAnimation {
  return {
    textureKey: getMobClipTextureKey(clip.spritesheet),
    texturePath: clip.spritesheet,
    frameWidth: clip.frameWidth,
    frameHeight: clip.frameHeight,
    startFrame: clip.startFrame,
    startRowFrames: 0,
    frameCount: Math.max(1, clip.endFrame - clip.startFrame + 1),
    fps: Math.max(1, clip.frameRate),
    columns: Math.max(1, clip.columns),
    loop: clip.repeat !== 0,
  };
}

function getWorldTraderSpriteSheetKey(texturePath: string) {
  return `world-trader-sheet:${texturePath}`;
}

function getWorldTraderBodyOverlayTextureKey(texturePath: string) {
  return `world-trader-body-overlay:${encodeURIComponent(texturePath)}`;
}

function isAnimatedWorldTraderBodyOverlay(texturePath: string | undefined) {
  return typeof texturePath === 'string' && /^\/character\/equipment\/.+_idle\.(png|jpg|jpeg|webp|gif)$/i.test(texturePath);
}

function getWorldTraderBodyOverlayAnimation(texturePath: string | undefined): PlayerSheetAnimation | null {
  if (!texturePath || !isAnimatedWorldTraderBodyOverlay(texturePath)) {
    return null;
  }

  const idleAnimation = PLAYER_ANIMATIONS.idle;
  if (!idleAnimation) {
    return null;
  }

  return {
    ...idleAnimation,
    textureKey: getWorldTraderBodyOverlayTextureKey(texturePath),
    texturePath,
  };
}

function getWorldTraderAnimationKey(traderId: string) {
  return `world-trader-anim:${traderId}`;
}

function getProjectileAnimation(
  skillId: string,
  projectileAnimations: Pick<Record<SkillEffectId, SheetAnimation>, 'fireball' | 'fireNova'>,
) {
  return skillId === 'fireNova' ? projectileAnimations.fireNova : projectileAnimations.fireball;
}

function getProjectileDisplaySize(skillId: string, skillEffects: SkillEffectOverrides) {
  if (skillId === 'fireNova') {
    return skillEffects.fireNova.displaySize;
  }

  if (skillId === 'fireballShard') {
    return Math.max(12, Math.round(skillEffects.fireball.displaySize * 0.6));
  }

  if (skillId === 'fireballSplit') {
    return Math.max(14, Math.round(skillEffects.fireball.displaySize * 0.8));
  }

  return skillEffects.fireball.displaySize;
}

function clampTargetToCastRange(
  equipment: PlayerEquipment,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
) {
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const distance = Math.hypot(deltaX, deltaY);
  const castRange = getCharacterCastRange(equipment);

  if (distance <= castRange || distance <= 0.001) {
    return { x: targetX, y: targetY, clamped: false };
  }

  const scale = castRange / distance;
  return {
    x: originX + deltaX * scale,
    y: originY + deltaY * scale,
    clamped: true,
  };
}

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
  playerRole,
  activeSkillTargeting,
  onChestInteract,
  onNearbyChestChange,
  onTraderInteract,
  onNearbyTraderChange,
  getTraderQuestMarker,
  objectiveTarget = null,
  onObjectiveArrowChange,
  onMinimapChange,
  onSkillTargetCancel,
  onFireballCast,
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
  playerRole: string;
  activeSkillTargeting: 'fireball' | 'fireField' | null;
  onChestInteract?: (chestId: string) => void;
  onNearbyChestChange?: (chestId: string | null) => void;
  onTraderInteract?: (trader: WorldTraderInteraction) => void;
  onNearbyTraderChange?: (traderId: string | null) => void;
  getTraderQuestMarker?: (trader: WorldTraderInteraction) => TraderQuestMarker;
  objectiveTarget?: ObjectiveTarget;
  onObjectiveArrowChange?: (state: ObjectiveArrowState) => void;
  onMinimapChange?: (snapshot: MinimapSnapshot | null) => void;
  onSkillTargetCancel?: () => void;
  onFireballCast?: (payload: { x: number; y: number }) => void;
  onSkillCooldownsChange?: (payload: { fireball: number; fireNova: number; fireField: number }) => void;
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
    options?: Record<string, string | number>;
  }) => void;
  respawnRequestNonce: number;
  fireNovaCastNonce: number;
  useConsumableRequest?: {
    source: 'inventory' | 'container';
    slotIndex: number;
    containerId?: string;
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
  activeRoomOptions?: Record<string, string | number>;
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
  locale?: 'ru' | 'en';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerVisualRef = useRef<PlayerVisualRefs | null>(null);
  const roomRef = useRef<RealtimeRoom | null>(null);
  const chestInteractRef = useRef(onChestInteract);
  const nearbyChestChangeRef = useRef(onNearbyChestChange);
  const traderInteractRef = useRef(onTraderInteract);
  const nearbyTraderChangeRef = useRef(onNearbyTraderChange);
  const traderQuestMarkerRef = useRef(getTraderQuestMarker);
  const objectiveTargetRef = useRef(objectiveTarget);
  const objectiveArrowChangeRef = useRef(onObjectiveArrowChange);
  const minimapChangeRef = useRef(onMinimapChange);
  const activeSkillTargetingRef = useRef(activeSkillTargeting);
  const skillTargetCancelRef = useRef(onSkillTargetCancel);
  const fireballCastRef = useRef(onFireballCast);
  const skillCooldownsChangeRef = useRef(onSkillCooldownsChange);
  const playerVitalsChangeRef = useRef(onPlayerVitalsChange);
  const playerProgressChangeRef = useRef(onPlayerProgressChange);
  const playerPositionChangeRef = useRef(onPlayerPositionChange);
  const playerDeathRef = useRef(onPlayerDeath);
  const playerInventoryChangeRef = useRef(onPlayerInventoryChange);
  const consumableCooldownChangeRef = useRef(onConsumableCooldownChange);
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
  const lastNotifiedPlayerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastWorldHoverTileRef = useRef<string | null>(null);
  const lastWorldEditDebugRef = useRef<string>('{"textureKey":"","textureLoaded":false}');
  const hasReceivedSkillBalanceRef = useRef(false);
  const lastKnownSkillBalanceSerializedRef = useRef(JSON.stringify(skillBalanceConfig));
  const hasReceivedMobBalanceRef = useRef(false);
  const lastKnownMobBalanceSerializedRef = useRef(JSON.stringify(mobBalanceConfig));
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
    playerRole,
    playerInventory,
  });
  const activeRaidRunId =
    activeRoomName === 'raid' && typeof activeRoomOptions?.raidRunId === 'string'
      ? activeRoomOptions.raidRunId
      : null;

  useEffect(() => {
    chestInteractRef.current = onChestInteract;
  }, [onChestInteract]);

  useEffect(() => {
    nearbyChestChangeRef.current = onNearbyChestChange;
  }, [onNearbyChestChange]);

  useEffect(() => {
    traderInteractRef.current = onTraderInteract;
  }, [onTraderInteract]);

  useEffect(() => {
    nearbyTraderChangeRef.current = onNearbyTraderChange;
  }, [onNearbyTraderChange]);

  useEffect(() => {
    traderQuestMarkerRef.current = getTraderQuestMarker;
  }, [getTraderQuestMarker]);

  useEffect(() => {
    objectiveTargetRef.current = objectiveTarget;
  }, [objectiveTarget]);

  useEffect(() => {
    objectiveArrowChangeRef.current = onObjectiveArrowChange;
  }, [onObjectiveArrowChange]);

  useEffect(() => {
    minimapChangeRef.current = onMinimapChange;
  }, [onMinimapChange]);

  useEffect(() => {
    activeSkillTargetingRef.current = activeSkillTargeting;
  }, [activeSkillTargeting]);

  useEffect(() => {
    skillTargetCancelRef.current = onSkillTargetCancel;
  }, [onSkillTargetCancel]);

  useEffect(() => {
    fireballCastRef.current = onFireballCast;
  }, [onFireballCast]);

  useEffect(() => {
    skillCooldownsChangeRef.current = onSkillCooldownsChange;
  }, [onSkillCooldownsChange]);

  useEffect(() => {
    playerVitalsChangeRef.current = onPlayerVitalsChange;
  }, [onPlayerVitalsChange]);

  useEffect(() => {
    playerProgressChangeRef.current = onPlayerProgressChange;
  }, [onPlayerProgressChange]);

  useEffect(() => {
    playerPositionChangeRef.current = onPlayerPositionChange;
  }, [onPlayerPositionChange]);

  useEffect(() => {
    playerDeathRef.current = onPlayerDeath;
  }, [onPlayerDeath]);

  useEffect(() => {
    playerInventoryChangeRef.current = onPlayerInventoryChange;
  }, [onPlayerInventoryChange]);
  useEffect(() => {
    consumableCooldownChangeRef.current = onConsumableCooldownChange;
  }, [onConsumableCooldownChange]);

  useEffect(() => {
    playerRespawnRef.current = onPlayerRespawn;
  }, [onPlayerRespawn]);

  useEffect(() => {
    roomConnectedRef.current = onRoomConnected;
  }, [onRoomConnected]);

  useEffect(() => {
    raidExitRef.current = onRaidExit;
  }, [onRaidExit]);
  useEffect(() => {
    worldEditPaintRef.current = onWorldEditPaint;
  }, [onWorldEditPaint]);
  useEffect(() => {
    worldEditHoverChangeRef.current = onWorldEditHoverChange;
  }, [onWorldEditHoverChange]);
  useEffect(() => {
    worldEditDebugChangeRef.current = onWorldEditDebugChange;
  }, [onWorldEditDebugChange]);
  useEffect(() => {
    worldEditorEnabledRef.current = worldEditorEnabled;
  }, [worldEditorEnabled]);
  useEffect(() => {
    worldEditorModeRef.current = worldEditorMode;
  }, [worldEditorMode]);
  useEffect(() => {
    selectedWorldTileRef.current = selectedWorldTile;
  }, [selectedWorldTile]);
  useEffect(() => {
    selectedWorldOverlayRef.current = selectedWorldOverlay;
  }, [selectedWorldOverlay]);
  useEffect(() => {
    selectedWorldSpriteRef.current = selectedWorldSprite;
  }, [selectedWorldSprite]);
  useEffect(() => {
    selectedWorldMobRef.current = selectedWorldMob;
  }, [selectedWorldMob]);
  useEffect(() => {
    selectedWorldTraderRef.current = selectedWorldTrader;
  }, [selectedWorldTrader]);
  useEffect(() => {
    worldMapAssetOverrideRef.current = worldMapAssetOverride;
    worldMapAssetOverrideSerializedRef.current = JSON.stringify(worldMapAssetOverride);
  }, [worldMapAssetOverride]);

  useEffect(() => {
    chatHistoryRef.current = onChatHistory;
  }, [onChatHistory]);

  useEffect(() => {
    chatMessageRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    chatSenderReadyRef.current = onChatSenderReady;
  }, [onChatSenderReady]);

  useEffect(() => {
    keyboardInputEnabledRef.current = keyboardInputEnabled;
  }, [keyboardInputEnabled]);

  useEffect(() => {
    skillEffectOverridesRef.current = skillEffectOverrides;
  }, [skillEffectOverrides]);

  useEffect(() => {
    skillBalanceConfigRef.current = skillBalanceConfig;
  }, [skillBalanceConfig]);

  useEffect(() => {
    mobBalanceConfigRef.current = mobBalanceConfig;
  }, [mobBalanceConfig]);

  useEffect(() => {
    mobVisualConfigRef.current = mobVisualConfig;
  }, [mobVisualConfig]);

  useEffect(() => {
    skillBalanceConfigChangeRef.current = onSkillBalanceConfigChange;
  }, [onSkillBalanceConfigChange]);

  useEffect(() => {
    mobBalanceConfigChangeRef.current = onMobBalanceConfigChange;
  }, [onMobBalanceConfigChange]);

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
  ]);

  useEffect(() => {
    const profileMessage = createWorldProfileMessage({
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
      playerInventory,
      playerEquipment,
    });
    roomRef.current?.send('profile', profileMessage);
  }, [activeRoomName, playerAgility, playerEquipment, playerExperience, playerHealth, playerIntellect, playerInventory, playerLevel, playerMaxHealth, playerName, playerRole, playerStrength]);

  useEffect(() => {
    if (activeRoomName !== 'world' || !roomRef.current || playerRole !== 'admin' || !hasReceivedSkillBalanceRef.current) {
      return;
    }

    const nextSerialized = JSON.stringify(skillBalanceConfig);
    if (nextSerialized === lastKnownSkillBalanceSerializedRef.current) {
      return;
    }

    lastKnownSkillBalanceSerializedRef.current = nextSerialized;
    const updateMessage: AdminUpdateSkillBalanceMessage = skillBalanceConfig;
    roomRef.current.send('adminUpdateSkillBalance', updateMessage);
  }, [activeRoomName, playerRole, skillBalanceConfig]);

  useEffect(() => {
    if (activeRoomName !== 'world' || !roomRef.current || playerRole !== 'admin' || !hasReceivedMobBalanceRef.current) {
      return;
    }

    const nextSerialized = JSON.stringify(mobBalanceConfig);
    if (nextSerialized === lastKnownMobBalanceSerializedRef.current) {
      return;
    }

    lastKnownMobBalanceSerializedRef.current = nextSerialized;
    const updateMessage: AdminUpdateMobBalanceMessage = mobBalanceConfig;
    roomRef.current.send('adminUpdateMobBalance', updateMessage);
  }, [activeRoomName, playerRole, mobBalanceConfig]);

  useEffect(() => {
    if (!roomRef.current || !useConsumableRequest || useConsumableRequest.nonce <= 0) {
      return;
    }

    const useConsumableMessage: UseConsumableMessage = {
      source: useConsumableRequest.source,
      slotIndex: useConsumableRequest.slotIndex,
      containerId: useConsumableRequest.containerId,
    };
    roomRef.current.send('useConsumable', useConsumableMessage);
  }, [useConsumableRequest]);

  useEffect(() => {
    if (!roomRef.current || !containerStates || !('chests' in roomRef.current.state)) {
      return;
    }

    Object.entries(containerStates).forEach(([chestId, slots]) => {
      const knownSlots = serverContainersRef.current[chestId] ?? [];
      const nextSerialized = JSON.stringify(slots);
      const knownSerialized = JSON.stringify(knownSlots);

      if (nextSerialized === knownSerialized) {
        return;
      }

      const syncChestMessage: SyncChestMessage = {
        chestId,
        slots: slots.map((itemId) => itemId ?? ''),
      };
      roomRef.current?.send('syncChest', syncChestMessage);
    });
  }, [containerStates]);

  useEffect(() => {
    if (activeRoomName !== 'world') {
      return;
    }

    if (respawnRequestNonce <= 0) {
      return;
    }

    pendingRespawnNonceRef.current = Math.max(pendingRespawnNonceRef.current, respawnRequestNonce);
    if (!roomRef.current || lastSentRespawnNonceRef.current >= pendingRespawnNonceRef.current) {
      return;
    }

    roomRef.current.send('respawn', {});
    lastSentRespawnNonceRef.current = pendingRespawnNonceRef.current;
  }, [activeRoomName, respawnRequestNonce]);

  useEffect(() => {
    if (fireNovaCastNonce <= 0) {
      return;
    }

    const castSkillMessage: CastSkillMessage = {
      skillId: 'fireNova',
    };
    roomRef.current?.send('castSkill', castSkillMessage);
  }, [activeRoomName, fireNovaCastNonce]);

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
      const meadowAsset =
        worldMapAssetOverride && !isRaidScene
          ? worldMapAssetOverride
          : isRaidScene
            ? createDefaultMeadowMapAsset()
            : await loadWorldMapAsset();
      const meadowMap = createMeadowMapFromAsset(meadowAsset);
      const meadowDecorations = createMeadowDecorationsFromAsset(meadowAsset);
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
          const worldTradersById = new Map<string, MeadowTraderAsset>();
          const pendingWorldTextureKeys = new Set<string>();
          const pendingWorldTraderSheetKeys = new Set<string>();
          const pendingMobClipKeys = new Set<string>();
          let worldSpawnMarker: Phaser.GameObjects.Container | null = null;
          let currentWorldAsset = meadowAsset;
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
          let lastMinimapPlayerTileKey = '';
          let lastRaidMinimapVisionKey = '';
          let lastRaidTilesWidth = 0;
          let lastRaidTilesHeight = 0;
          let lastRaidVisibilityRenderKey = '';
          let lastRaidVisibilityUpdateAt = 0;
          let lastRaidObjectVisibilityUpdateAt = 0;
          let lastRaidMinimapUpdateAt = 0;
          let nextRaidInputSequence = 1;
          let lastProcessedRaidInput = 0;
          let pendingRaidInputs: PendingRaidInputSample[] = [];
          let nextWorldInputSequence = 1;
          let lastProcessedWorldInput = 0;
          let pendingWorldInputs: PendingWorldInputSample[] = [];
          let movementSimulationAccumulatorMs = 0;
          let lastPositionSyncAt = 0;
          let lastSyncedPositionX = latestProfileRef.current.playerPosition.x;
          let lastSyncedPositionY = latestProfileRef.current.playerPosition.y;
          let canOpenChest = false;
          let interactableChestId: string | null = null;
          let canInteractWithTrader = false;
          let interactableTraderId: string | null = null;
          let canUseRaidExit = false;
          let interactableRaidExitId: string | null = null;
          let worldEditPointerActive = false;
          let worldEditEraseMode = false;
          let lastWorldEditedTileKey = '';
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
          const mapWidth = (isRaidScene ? raidWidth : meadowMap.width) * tileSize;
          const mapHeight = (isRaidScene ? raidHeight : meadowMap.height) * tileSize;
          const meadowMinimapTiles = meadowMap.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              if (isBlockedMeadowTile(meadowMap, meadowDecorations, x, y)) {
                return 'blocked';
              }

              return tile;
            }),
          );

          const emitLobbyMinimapSnapshot = (playerWorldX: number, playerWorldY: number) => {
            const playerTileX = Math.max(0, Math.min(meadowMap.width - 1, Math.floor(playerWorldX / tileSize)));
            const playerTileY = Math.max(0, Math.min(meadowMap.height - 1, Math.floor(playerWorldY / tileSize)));
            const playerTileKey = `${playerTileX}:${playerTileY}`;

            if (playerTileKey === lastMinimapPlayerTileKey) {
              return;
            }

            lastMinimapPlayerTileKey = playerTileKey;
            minimapChangeRef.current?.({
              roomName: 'world',
              width: meadowMap.width,
              height: meadowMap.height,
              tiles: meadowMinimapTiles,
              explored: meadowMinimapTiles.map((_, index) => index),
              visible: meadowMinimapTiles.map((_, index) => index),
              playerTile: {
                x: playerTileX,
                y: playerTileY,
              },
            });
          };

          const emitRaidMinimapSnapshot = (
            playerTileX: number,
            playerTileY: number,
            width: number,
            height: number,
            tiles: string[],
            visionKey: string,
            now: number,
            force = false,
          ) => {
            if (!force && now - lastRaidMinimapUpdateAt < RAID_MINIMAP_UPDATE_INTERVAL_MS) {
              return;
            }
            if (visionKey === lastRaidMinimapVisionKey) {
              return;
            }

            const explored = Array.from(exploredRaidTiles.values()).sort((left, right) => left - right);
            const visible = Array.from(visibleRaidTiles.values()).sort((left, right) => left - right);
            const playerTileKey = `${playerTileX}:${playerTileY}`;
            lastRaidMinimapVisionKey = visionKey;
            lastRaidMinimapUpdateAt = now;
            lastMinimapPlayerTileKey = playerTileKey;
            minimapChangeRef.current?.({
              roomName: 'raid',
              width,
              height,
              tiles: [...tiles],
              explored,
              visible,
              playerTile: {
                x: playerTileX,
                y: playerTileY,
              },
            });
          };
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
                renderWorldMap(worldMapAssetOverrideRef.current ?? currentWorldAsset);
              }
            };
            image.onerror = () => {
              pendingWorldTextureKeys.delete(textureKey);
            };
            image.src = texturePath;
            return textureKey;
          };

          const ensureWorldTraderBodyOverlayLoaded = (texturePath: string) => {
            const overlayAnimation = getWorldTraderBodyOverlayAnimation(texturePath);
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
                renderWorldMap(worldMapAssetOverrideRef.current ?? currentWorldAsset);
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
                renderWorldMap(worldMapAssetOverrideRef.current ?? currentWorldAsset);
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
              if (this.textures.exists(textureKey)) {
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
            currentWorldAsset = asset;
            worldTileSprites.forEach((sprite) => sprite.destroy());
            worldTileSprites.length = 0;
            worldOverlaySprites.forEach((sprite) => sprite.destroy());
            worldOverlaySprites.length = 0;
            worldDecorationSprites.forEach((sprite) => sprite.destroy());
            worldDecorationSprites.length = 0;
            worldStampSprites.forEach((sprite) => sprite.destroy());
            worldStampSprites.length = 0;
            worldStampSpritesByTile.clear();
            worldMobVisuals.forEach((mobVisual) => {
              mobVisual.shadow.destroy();
              mobVisual.sprite.destroy();
              mobVisual.nameplate.destroy();
            });
            worldMobVisuals.clear();
            worldTraderVisuals.forEach((traderVisual) => {
              traderVisual.shadow.destroy();
              traderVisual.container.destroy();
              traderVisual.nameplate.destroy();
              traderVisual.questMarker.destroy();
            });
            worldTraderVisuals.clear();
            worldTradersById.clear();
            if (worldSpawnMarker) {
              worldSpawnMarker.destroy();
              worldSpawnMarker = null;
            }

            const worldMap = createMeadowMapFromAsset(asset);
            const worldDecorations = createMeadowDecorationsFromAsset(asset);
            const worldStamps = createMeadowStampsFromAsset(asset);
            const worldMobs = createMeadowMobsFromAsset(asset);
            const worldTraders = createMeadowTradersFromAsset(asset);
            const worldStampsByTile = new Map(worldStamps.map((stamp) => [`${stamp.x}:${stamp.y}`, stamp] as const));
            worldTraders.forEach((trader) => {
              worldTradersById.set(trader.id, trader);
            });

            const placeWorldTrader = (trader: MeadowTraderAsset) => {
              const worldX = trader.x * tileSize + tileSize / 2;
              const worldY = trader.y * tileSize + tileSize / 2;
              const shadow = this.add
                .ellipse(worldX, worldY + 15, 24, 8, 0x000000, 0.18)
                .setDepth(1.05);
              const container = this.add.container(worldX, worldY).setDepth(1.6);
              let actor: Phaser.GameObjects.GameObject | undefined;
              let bodyBase: PhaserImage | undefined;
              let bodyLayer: PhaserImage | undefined;
              let bodyOverlayAnimation: PlayerSheetAnimation | undefined;
              let headBase: PhaserImage | undefined;
              let rightHand: PhaserImage | undefined;
              let leftHand: PhaserImage | undefined;
              let hairLayer: PhaserImage | undefined;
              let headLayer: PhaserImage | undefined;
              let leftEye: Phaser.GameObjects.Rectangle | undefined;
              let rightEye: Phaser.GameObjects.Rectangle | undefined;
              let animationStartedAt: number | undefined;

              if (trader.spriteSheetPath) {
                const sheetTextureKey = ensureWorldTraderSpriteSheetLoaded(trader);
                if (!sheetTextureKey || !this.textures.exists(sheetTextureKey)) {
                  shadow.destroy();
                  container.destroy();
                  return;
                }

                const sprite = this.add
                  .sprite(0, 0, sheetTextureKey, trader.animationStartFrame ?? 0)
                  .setOrigin(0.5)
                  .setScale(
                    ((trader.renderScale ?? 1) * tileSize) /
                    Math.max(1, trader.frameWidth ?? tileSize),
                  );
                const animationKey = getWorldTraderAnimationKey(trader.id);
                if (!this.anims.exists(animationKey)) {
                  this.anims.create({
                    key: animationKey,
                    frames: this.anims.generateFrameNumbers(sheetTextureKey, {
                      start: trader.animationStartFrame ?? 0,
                      end: (trader.animationStartFrame ?? 0) + Math.max(0, (trader.frameCount ?? 1) - 1),
                    }),
                    frameRate: Math.max(1, trader.animationFps ?? 4),
                    repeat: -1,
                  });
                }
                if ((trader.frameCount ?? 1) > 1) {
                  sprite.play(animationKey);
                }
                container.add(sprite);
                actor = sprite;
              } else {
                const resolvedBodyTexturePath =
                  (trader.bodyItemId ? getEquipmentBodyTexturePath(trader.bodyItemId) : undefined) ??
                  trader.bodyTexturePath ??
                  '';
                const resolvedHeadTexturePath =
                  (trader.headItemId ? getEquipmentBodyTexturePath(trader.headItemId) : undefined) ??
                  trader.headTexturePath ??
                  '';
                bodyOverlayAnimation = getWorldTraderBodyOverlayAnimation(resolvedBodyTexturePath) ?? undefined;
                const bodyTextureKey = resolvedBodyTexturePath
                  ? bodyOverlayAnimation
                    ? ensureWorldTraderBodyOverlayLoaded(resolvedBodyTexturePath)
                    : ensureWorldTextureLoaded(resolvedBodyTexturePath)
                  : '';
                const hairTextureKey = trader.hairTexturePath ? ensureWorldTextureLoaded(trader.hairTexturePath) : '';
                const headTextureKey = resolvedHeadTexturePath ? ensureWorldTextureLoaded(resolvedHeadTexturePath) : '';
                if (
                  (bodyTextureKey && !this.textures.exists(bodyTextureKey)) ||
                  (hairTextureKey && !this.textures.exists(hairTextureKey)) ||
                  (headTextureKey && !this.textures.exists(headTextureKey))
                ) {
                  shadow.destroy();
                  container.destroy();
                  return;
                }

                const traderBodyAnimation = PLAYER_ANIMATIONS.idle;
                const traderEyePixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
                const traderBodyDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, tileSize);
                const traderHeadDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, tileSize);
                const handDisplay = getHandDisplaySize(tileSize);
                bodyBase = this.add
                  .image(
                    0,
                    0,
                    traderBodyAnimation?.textureKey ?? PLAYER_BODY_TEXTURE_KEY,
                    traderBodyAnimation ? traderBodyAnimation.startFrame : PLAYER_BODY_DEFAULT_FRAME,
                  )
                  .setDisplaySize(traderBodyDisplay.width, traderBodyDisplay.height)
                  .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.body.anchorY);
                rightHand = this.add
                  .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
                  .setDisplaySize(handDisplay.width, handDisplay.height)
                  .setOrigin(0.5);
                leftHand = this.add
                  .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
                  .setDisplaySize(handDisplay.width, handDisplay.height)
                  .setOrigin(0.5);
                if (bodyTextureKey) {
                  bodyLayer = this.add
                    .image(
                      0,
                      0,
                      bodyTextureKey,
                      bodyOverlayAnimation ? bodyOverlayAnimation.startFrame : undefined,
                    )
                    .setDisplaySize(tileSize, tileSize)
                    .setOrigin(0.5);
                }
                headBase = this.add
                  .image(0, 0, PLAYER_HEAD_TEXTURE_KEY, PLAYER_HEAD_DEFAULT_FRAME)
                  .setDisplaySize(traderHeadDisplay.width, traderHeadDisplay.height)
                  .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.head.anchorY);
                if (hairTextureKey) {
                  hairLayer = this.add
                    .image(trader.hairOffsetX ?? 0, trader.hairOffsetY ?? 0, hairTextureKey)
                    .setDisplaySize(tileSize, tileSize)
                    .setOrigin(0.5);
                }
                if (headTextureKey) {
                  headLayer = this.add
                    .image(0, 0, headTextureKey)
                    .setDisplaySize(tileSize, tileSize)
                    .setOrigin(0.5);
                }
                leftEye = this.add
                  .rectangle(0, 0, traderEyePixelSize, traderEyePixelSize, PLAYER_EYE_COLOR, 1)
                  .setOrigin(0.5);
                rightEye = this.add
                  .rectangle(0, 0, traderEyePixelSize, traderEyePixelSize, PLAYER_EYE_COLOR, 1)
                  .setOrigin(0.5);
                const defaultLeftEye = getEyeLocalPosition('down', 'left', tileSize);
                const defaultRightEye = getEyeLocalPosition('down', 'right', tileSize);
                leftEye.setPosition(defaultLeftEye.x, defaultLeftEye.y);
                rightEye.setPosition(defaultRightEye.x, defaultRightEye.y);
                const defaultRightHand = getHandLocalPosition(
                  PLAYER_HAND_BASE_OFFSETS.right,
                  { x: 0, y: 0 },
                  tileSize,
                );
                const defaultLeftHand = getHandLocalPosition(
                  PLAYER_HAND_BASE_OFFSETS.left,
                  { x: 0, y: 0 },
                  tileSize,
                );
                rightHand.setPosition(defaultRightHand.x, defaultRightHand.y);
                leftHand.setPosition(defaultLeftHand.x, defaultLeftHand.y);
                container.add([
                  leftHand,
                  bodyBase,
                  ...(bodyLayer ? [bodyLayer] : []),
                  rightHand,
                  headBase,
                  ...(hairLayer ? [hairLayer] : []),
                  leftEye,
                  rightEye,
                  ...(headLayer ? [headLayer] : []),
                ]);
                actor = bodyLayer ?? bodyBase;
                animationStartedAt = this.time.now;
              }

              const nameplate = this.add
                .text(worldX, worldY - 24, trader.name || 'Trader', {
                  color: '#f4f1e4',
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontStyle: 'bold',
                  stroke: '#1f140e',
                  strokeThickness: 2,
                })
                .setOrigin(0.5)
                .setScale(0.5)
                .setDepth(1.75);
              const questMarker = this.add
                .text(worldX, worldY - 36, '', {
                  color: '#ffe699',
                  fontFamily: 'monospace',
                  fontSize: '24px',
                  fontStyle: 'bold',
                  stroke: '#1f140e',
                  strokeThickness: 3,
                })
                .setOrigin(0.5)
                .setScale(0.6)
                .setDepth(1.8)
                .setVisible(false);

              worldTraderVisuals.set(trader.id, {
                shadow,
                container,
                actor,
                body: bodyBase,
                bodyOverlay: trader.spriteSheetPath ? undefined : bodyLayer,
                bodyOverlayAnimation,
                head: headBase,
                rightHand,
                leftHand,
                hairOverlay: trader.spriteSheetPath ? undefined : hairLayer,
                headOverlay: trader.spriteSheetPath ? undefined : headLayer,
                leftEye,
                rightEye,
                animationStartedAt,
                nameplate,
                questMarker,
              });
            };

            const placeWorldMob = (mob: MeadowMobAsset) => {
              const renderState = resolveMobRenderState(mob.kind, this.time.now);
              const worldX = mob.spawn.x * tileSize + tileSize / 2;
              const worldY = mob.spawn.y * tileSize + tileSize / 2;
              const shadow = this.add
                .ellipse(worldX, worldY + 15, 22, 8, 0x000000, 0.18)
                .setDepth(1.05);
              const sprite = this.add
                .image(worldX, worldY, renderState.textureKey, renderState.frame)
                .setScale(renderState.renderScale)
                .setOrigin(0.5, renderState.anchorY)
                .setDepth(1.6);
              const nameplate = this.add
                .text(worldX, worldY - 24, mob.kind, {
                  color: '#f4f1e4',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontStyle: 'bold',
                  stroke: '#1f140e',
                  strokeThickness: 2,
                })
                .setOrigin(0.5)
                .setScale(0.45)
                .setDepth(1.75)
                .setVisible(playerRole.toLowerCase() === 'admin');

              worldMobVisuals.set(mob.id, {
                kind: mob.kind,
                shadow,
                sprite,
                nameplate,
              });
            };

            for (let y = 0; y < worldMap.height; y += 1) {
              for (let x = 0; x < worldMap.width; x += 1) {
                const tileRender = resolveMeadowTexture(worldMap, x, y);
                const tileStamp = worldStampsByTile.get(`${x}:${y}`);
                const tileX = x * tileSize + tileSize / 2;
                const tileY = y * tileSize + tileSize / 2;

                const tileSprite = this.add
                  .image(tileX, tileY, tileRender.texture)
                  .setDisplaySize(tileSize, tileSize)
                  .setAngle(tileRender.rotation)
                  .setOrigin(0.5)
                  .setDepth(0);
                worldTileSprites.push(tileSprite);

                if (!tileStamp) {
                  for (const overlay of resolveGroundOverlaysFromAsset(asset, x, y)) {
                    const overlaySprite = this.add
                      .image(tileX, tileY, overlay.texture)
                      .setDisplaySize(tileSize, tileSize)
                      .setAngle(overlay.rotation)
                      .setFlipX(overlay.flipX)
                      .setOrigin(0.5);
                    worldOverlaySprites.push(overlaySprite);
                  }
                } else {
                  const textureKey = ensureWorldTextureLoaded(tileStamp.texturePath);
                  if (this.textures.exists(textureKey)) {
                    const stampSprite = this.add
                      .image(tileX, tileY, textureKey)
                      .setDisplaySize(tileSize * tileStamp.scale, tileSize * tileStamp.scale)
                      .setAngle(tileStamp.rotation)
                      .setFlipX(tileStamp.flipX)
                      .setOrigin(0.5)
                      .setDepth(0.2);
                    worldOverlaySprites.push(stampSprite);
                  }
                }
              }
            }

            for (const decoration of worldDecorations) {
              const worldX = decoration.x * tileSize + tileSize / 2;
              const worldY = decoration.y * tileSize + tileSize / 2;

              const decorationSprite = this.add
                .image(worldX, worldY, decoration.texture)
                .setDisplaySize(tileSize, tileSize)
                .setOrigin(0.5);
              worldDecorationSprites.push(decorationSprite);
            }

            const spawnWorldX = asset.spawn.x * tileSize + tileSize / 2;
            const spawnWorldY = asset.spawn.y * tileSize + tileSize / 2;
            worldSpawnMarker = this.add
              .container(spawnWorldX, spawnWorldY, [
                this.add.circle(0, 0, 10, 0x8fd16a, 0.14).setStrokeStyle(2, 0xd7f0b6, 0.88),
                this.add.text(0, -1, 'S', {
                  color: '#eaffd9',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontStyle: 'bold',
                  stroke: '#274617',
                  strokeThickness: 3,
                }).setOrigin(0.5),
              ])
              .setDepth(1.35)
              .setVisible(playerRole.toLowerCase() === 'admin');

            for (const trader of worldTraders) {
              placeWorldTrader(trader);
            }

            for (const mob of worldMobs) {
              placeWorldMob(mob);
            }

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
          ): CharacterVisual => {
            const shadow = this.add.ellipse(x, y + 15, 24, 8, 0x000000, 0.18).setDepth(1);
            const burnAura = this.add
              .ellipse(x, y + 4, 36, 44, 0xff8f2a, 0.32)
              .setDepth(1.5)
              .setVisible(false);
            const deathEffect = this.add
              .image(x, y, SHARED_DEATH_ANIMATION.textureKey, SHARED_DEATH_ANIMATION.startFrame)
              .setScale(getSharedDeathAnimationScale(meadowMap.tileSize))
              .setOrigin(0.5)
              .setDepth(2.05)
              .setVisible(false);
            const container = this.add.container(x, y).setDepth(2);
            const body = this.add
              .image(0, 0, PLAYER_BODY_TEXTURE_KEY, PLAYER_BODY_DEFAULT_FRAME)
              .setDisplaySize(
                getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, meadowMap.tileSize).width,
                getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, meadowMap.tileSize).height,
              )
              .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.body.anchorY);
            const handDisplay = getHandDisplaySize(meadowMap.tileSize);
            const rightHand = this.add
              .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
              .setDisplaySize(handDisplay.width, handDisplay.height)
              .setOrigin(0.5);
            const leftHand = this.add
              .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
              .setDisplaySize(handDisplay.width, handDisplay.height)
              .setOrigin(0.5);
            const weaponItem = this.add
              .image(10, 2, EQUIPMENT_ITEMS.default_staff.textureKey)
              .setDisplaySize(meadowMap.tileSize, meadowMap.tileSize)
              .setOrigin(0.5)
              .setVisible(false);
            const castItem = this.add
              .image(10, 2, EQUIPMENT_ITEMS.teleport_scroll.textureKey)
              .setDisplaySize(meadowMap.tileSize, meadowMap.tileSize)
              .setOrigin(0.5)
              .setVisible(false);
            const burnEffect = this.add
              .image(0, -3, 'effect-fire-sheet', 0)
              .setDisplaySize(meadowMap.tileSize, meadowMap.tileSize)
              .setOrigin(0.5)
              .setScale(1.75)
              .setAlpha(0.9)
              .setVisible(false);
            const head = this.add
              .image(0, 0, PLAYER_HEAD_TEXTURE_KEY, PLAYER_HEAD_DEFAULT_FRAME)
              .setDisplaySize(
                getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, meadowMap.tileSize).width,
                getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, meadowMap.tileSize).height,
              )
              .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.head.anchorY);
            const eyePixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, meadowMap.tileSize);
            const leftEye = this.add
              .rectangle(0, 0, eyePixelSize, eyePixelSize, PLAYER_EYE_COLOR, 1)
              .setOrigin(0.5);
            const rightEye = this.add
              .rectangle(0, 0, eyePixelSize, eyePixelSize, PLAYER_EYE_COLOR, 1)
              .setOrigin(0.5);
            const rightHandPosition = getHandLocalPosition(
              PLAYER_HAND_BASE_OFFSETS.right,
              { x: 0, y: 0 },
              meadowMap.tileSize,
            );
            const leftHandPosition = getHandLocalPosition(
              PLAYER_HAND_BASE_OFFSETS.left,
              { x: 0, y: 0 },
              meadowMap.tileSize,
            );
            rightHand.setPosition(rightHandPosition.x, rightHandPosition.y);
            leftHand.setPosition(leftHandPosition.x, leftHandPosition.y);

            container.add(leftHand);
            container.add(body);
            container.add(rightHand);
            container.add(head);
            container.add(leftEye);
            container.add(rightEye);
            container.add(weaponItem);
            container.add(castItem);
            container.add(burnEffect);

            const nameplate = this.add
              .text(x, y - 24, name, {
                color: '#f4f1e4',
                fontFamily: 'monospace',
                fontSize: '20px',
                fontStyle: 'bold',
                stroke: '#1f140e',
                strokeThickness: 2,
              })
              .setOrigin(0.5)
              .setScale(0.5)
              .setDepth(8);
            const burnStatusBack = this.add
              .rectangle(x, y - 34, 16, 16, 0x5a1f0f, 0.92)
              .setOrigin(0.5)
              .setDepth(8.1)
              .setVisible(false);
            const burnStatusOverlay = this.add
              .rectangle(x, y - 42, 16, 16, 0x060606, 0.58)
              .setOrigin(0.5, 0)
              .setDepth(8.24)
              .setVisible(false);
            const burnStatusIcon = this.add
              .image(x, y - 34, 'effect-fire-sheet', 0)
              .setDisplaySize(12, 12)
              .setOrigin(0.5)
              .setDepth(8.2)
              .setVisible(false);
            const burnStatusTimer = this.add
              .text(x, y - 34, '', {
                color: '#fff4de',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontStyle: 'bold',
                stroke: '#170d08',
                strokeThickness: 2,
              })
              .setOrigin(0.5)
              .setScale(0.42)
              .setDepth(8.3)
              .setVisible(false);
            const healingStatusBack = this.add
              .rectangle(x, y - 34, 16, 16, 0x12350f, 0.92)
              .setOrigin(0.5)
              .setDepth(8.1)
              .setVisible(false);
            const healingStatusOverlay = this.add
              .rectangle(x, y - 42, 16, 16, 0x060606, 0.58)
              .setOrigin(0.5, 0)
              .setDepth(8.24)
              .setVisible(false);
            const healingStatusIcon = this.add
              .image(x, y - 34, EQUIPMENT_ITEMS.healing_potion.textureKey)
              .setDisplaySize(12, 12)
              .setOrigin(0.5)
              .setTint(0xc7ffb0)
              .setDepth(8.2)
              .setVisible(false);
            const healingStatusTimer = this.add
              .text(x, y - 34, '', {
                color: '#efffe2',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontStyle: 'bold',
                stroke: '#0b1909',
                strokeThickness: 2,
              })
              .setOrigin(0.5)
              .setScale(0.42)
              .setDepth(8.3)
              .setVisible(false);
            const healthBarFrame = this.add
              .rectangle(x, y + 22, 30, 10, 0x101010, 1)
              .setOrigin(0.5)
              .setDepth(5);
            const healthBarBack = this.add
              .rectangle(x, y + 22, 24, 4, 0x2a140f, 1)
              .setOrigin(0.5)
              .setDepth(6);
            const healthBarFill = this.add
              .rectangle(x - 12, y + 22, 24, 4, 0xef4444, 1)
              .setOrigin(0, 0.5)
              .setDepth(6.2)
              .setVisible(false);
            const castBarFrame = this.add
              .rectangle(x, y + 30, 30, 8, 0x101010, 0.95)
              .setOrigin(0.5)
              .setDepth(5)
              .setVisible(false);
            const castBarBack = this.add
              .rectangle(x, y + 30, 24, 3, 0x1d220f, 0.95)
              .setOrigin(0.5)
              .setDepth(6)
              .setVisible(false);
            const castBarFill = this.add
              .rectangle(x - 12, y + 30, 24, 3, 0xf4c96b, 1)
              .setOrigin(0, 0.5)
              .setDepth(6.2)
              .setVisible(false);
            const healthSegments = Array.from({ length: 10 }, (_, index) =>
              this.add
                .rectangle(x - 10.8 + index * 2.4, y + 22, 2, 4, 0xef4444, 1)
                .setOrigin(0.5)
                .setDepth(7),
            );
            const healthText = this.add
              .text(x, y + 22, `${health}/${maxHealth}`, {
                color: '#fff6ea',
                fontFamily: 'monospace',
                fontSize: '12px',
                fontStyle: 'bold',
                stroke: '#2a120f',
                strokeThickness: 1,
              })
              .setOrigin(0.5)
              .setScale(0.45)
              .setVisible(false)
              .setDepth(9);

            const character = {
              shadow,
              burnAura,
              container,
              deathEffect,
              body,
              rightHand,
              leftHand,
              weaponItem,
              castItem,
              burnEffect,
              weaponEffects: [],
              head,
              leftEye,
              rightEye,
              nameplate,
              burnStatusIcon: {
                back: burnStatusBack,
                cooldownOverlay: burnStatusOverlay,
                icon: burnStatusIcon,
                timerText: burnStatusTimer,
              },
              healingStatusIcon: {
                back: healingStatusBack,
                cooldownOverlay: healingStatusOverlay,
                icon: healingStatusIcon,
                timerText: healingStatusTimer,
              },
              healthBarFrame,
              healthBarBack,
              healthBarFill,
              castBarFrame,
              castBarBack,
              castBarFill,
              healthText,
              healthSegments,
              targetX: x,
              targetY: y,
              lastX: x,
              lastY: y,
              motionPhase: 0,
              effectPhase: 0,
              facingX: 1 as const,
              currentName: name,
              currentHealth: health,
              currentMaxHealth: maxHealth,
              currentAnimationState: 'idle' as PlayerAnimationState,
              animationStartedAt: this.time.now,
              lastMovedAt: 0,
              currentWeaponOffsetX: 0,
              currentWeaponOffsetY: 0,
              currentBodyTextureKey: PLAYER_BODY_TEXTURE_KEY,
              currentBodyFrame: PLAYER_BODY_DEFAULT_FRAME,
              currentWeaponItem: undefined,
              currentCastItemId: undefined,
              isFollowTarget: false,
              currentBurnTicksRemaining: 0,
              currentBurnEndsAt: 0,
              currentBurnStartedAt: 0,
              currentBurnDurationMs: 0,
              currentHealingTicksRemaining: 0,
              currentHealingEndsAt: 0,
              currentHealingStartedAt: 0,
              currentHealingDurationMs: 0,
              currentCastingSkillId: '',
              currentCastStartedAt: 0,
              currentCastEndsAt: 0,
              deathStartedAt: 0,
              interpPrevX: x,
              interpPrevY: y,
              interpPrevAt: this.time.now,
              interpNextX: x,
              interpNextY: y,
              interpNextAt: this.time.now,
              simPrevX: x,
              simPrevY: y,
              simX: x,
              simY: y,
              idleGraceUntil: 0,
              isDead: false,
            };

            applyCharacterHealthToVisual(character, health, maxHealth);
            applyBurningToCharacterVisual(character, 0, 0);
            applyHealingToCharacterVisual(character, 0, 0);
            applyEquipmentToVisual(this, meadowMap.tileSize, character, equipment);
            return character;
          };

          const createMob = (
            x: number,
            y: number,
            texture: string,
            name: string,
            health: number,
            maxHealth: number,
          ): MobVisual => {
            const initialRender = resolveMobRenderState(texture, this.time.now);
            const renderScale = initialRender.renderScale;
            const burnScale = Math.max(DEFAULT_MOB_BURN_SCALE, renderScale * 0.18);
            const shadow = this.add.ellipse(x, y + 15, 24, 8, 0x000000, 0.18).setDepth(1);
            const burnAura = this.add
              .ellipse(x, y + 6, 24 * renderScale, 30 * renderScale, 0xff8f2a, 0.24)
              .setDepth(1.5)
              .setVisible(false);
            const sprite = this.add
              .image(x, y, initialRender.textureKey, initialRender.frame)
              .setScale(renderScale)
              .setOrigin(0.5, initialRender.anchorY)
              .setDepth(2);
            const deathEffect = this.add
              .image(x, y, SHARED_DEATH_ANIMATION.textureKey, SHARED_DEATH_ANIMATION.startFrame)
              .setScale(renderScale)
              .setOrigin(0.5)
              .setDepth(2.05)
              .setVisible(false);
            const burnEffect = this.add
              .image(x, y - 3, 'effect-fire-sheet', 0)
              .setScale(burnScale)
              .setOrigin(0.5)
              .setAlpha(0.55)
              .setVisible(false)
              .setDepth(1.75);
            const burnStatusBack = this.add
              .rectangle(x, y - 30, 16, 16, 0x5a1f0f, 0.92)
              .setOrigin(0.5)
              .setDepth(8.1)
              .setVisible(false);
            const burnStatusOverlay = this.add
              .rectangle(x, y - 38, 16, 16, 0x060606, 0.58)
              .setOrigin(0.5, 0)
              .setDepth(8.24)
              .setVisible(false);
            const burnStatusIcon = this.add
              .image(x, y - 30, 'effect-fire-sheet', 0)
              .setDisplaySize(12, 12)
              .setOrigin(0.5)
              .setDepth(8.2)
              .setVisible(false);
            const burnStatusTimer = this.add
              .text(x, y - 30, '', {
                color: '#fff4de',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontStyle: 'bold',
                stroke: '#170d08',
                strokeThickness: 2,
              })
              .setOrigin(0.5)
              .setScale(0.42)
              .setDepth(8.3)
              .setVisible(false);
            const nameplate = this.add
              .text(x, y - 24, name, {
                color: '#f4f1e4',
                fontFamily: 'monospace',
                fontSize: '12px',
                fontStyle: 'bold',
                stroke: '#24160f',
                strokeThickness: 4,
              })
              .setOrigin(0.5)
              .setVisible(false)
              .setDepth(8);
            const healthBarFrame = this.add
              .rectangle(x, y + 22, 30, 10, 0x101010, 1)
              .setOrigin(0.5)
              .setDepth(5);
            const healthBarBack = this.add
              .rectangle(x, y + 22, 24, 4, 0x2a140f, 1)
              .setOrigin(0.5)
              .setDepth(6);
            const healthBarFill = this.add
              .rectangle(x - 12, y + 22, 24, 4, 0xef4444, 1)
              .setOrigin(0, 0.5)
              .setDepth(6.2)
              .setVisible(false);
            const castBarFrame = this.add
              .rectangle(x, y + 30, 30, 8, 0x101010, 0.95)
              .setOrigin(0.5)
              .setDepth(5)
              .setVisible(false);
            const castBarBack = this.add
              .rectangle(x, y + 30, 24, 3, 0x1d220f, 0.95)
              .setOrigin(0.5)
              .setDepth(6)
              .setVisible(false);
            const castBarFill = this.add
              .rectangle(x - 12, y + 30, 24, 3, 0xf4c96b, 1)
              .setOrigin(0, 0.5)
              .setDepth(6.2)
              .setVisible(false);
            const healthSegments = Array.from({ length: 10 }, (_, index) =>
              this.add
                .rectangle(x - 10.8 + index * 2.4, y + 22, 2, 4, 0xef4444, 1)
                .setOrigin(0.5)
                .setDepth(7),
            );
            const healthText = this.add
              .text(x, y + 22, `${health}/${maxHealth}`, {
                color: '#fff6ea',
                fontFamily: 'monospace',
                fontSize: '12px',
                fontStyle: 'bold',
                stroke: '#2a120f',
                strokeThickness: 1,
              })
              .setOrigin(0.5)
              .setScale(0.45)
              .setVisible(false)
              .setDepth(9);

            const mob = {
              shadow,
              burnAura,
              sprite,
              deathEffect,
              burnEffect,
              burnStatusIcon: {
                back: burnStatusBack,
                cooldownOverlay: burnStatusOverlay,
                icon: burnStatusIcon,
                timerText: burnStatusTimer,
              },
              nameplate,
              healthBarFrame,
              healthBarBack,
              healthBarFill,
              castBarFrame,
              castBarBack,
              castBarFill,
              healthText,
              healthSegments,
              targetX: x,
              targetY: y,
              lastX: x,
              lastY: y,
              bobPhase: 0,
              facingX: 1 as const,
              renderScale,
              burnScale,
              baseTexture: texture,
              currentTexture: initialRender.textureKey,
              currentFrame: initialRender.frame,
              currentName: name,
              currentHealth: health,
              currentMaxHealth: maxHealth,
              currentBurnTicksRemaining: 0,
              currentBurnEndsAt: 0,
              currentBurnStartedAt: 0,
              currentBurnDurationMs: 0,
              currentAttackCooldownEndsAt: 0,
              currentAttackCooldownMs: 0,
              currentCastingSkillId: "",
              currentCastStartedAt: 0,
              currentCastEndsAt: 0,
              currentSkillLungeStartedAt: 0,
              currentSkillLungeEndsAt: 0,
              lastMovedAt: 0,
              currentAnimationState: 'idle' as MobAnimationState,
              animationStartedAt: this.time.now,
              deathStartedAt: 0,
              isDead: false,
            };

            applyMobHealthToVisual(mob, health, maxHealth);
            applyBurningToMobVisual(mob, 0, 0);
            return mob;
          };

          const destroyCharacter = (sessionId: string) => {
            const character = characters.get(sessionId);
            if (!character) {
              return;
            }

            character.shadow.destroy();
            character.burnAura.destroy();
            character.container.destroy();
            character.deathEffect.destroy();
            character.nameplate.destroy();
            character.burnStatusIcon.back.destroy();
            character.burnStatusIcon.cooldownOverlay.destroy();
            character.burnStatusIcon.icon.destroy();
            character.burnStatusIcon.timerText.destroy();
            character.healingStatusIcon.back.destroy();
            character.healingStatusIcon.cooldownOverlay.destroy();
            character.healingStatusIcon.icon.destroy();
            character.healingStatusIcon.timerText.destroy();
            character.healthBarFrame.destroy();
            character.healthBarBack.destroy();
            character.healthBarFill.destroy();
            character.castBarFrame.destroy();
            character.castBarBack.destroy();
            character.castBarFill.destroy();
            character.healthText.destroy();
            character.healthSegments.forEach((segment) => segment.destroy());
            characters.delete(sessionId);

            if (localSessionId === sessionId) {
              playerVisualRef.current = null;
              camera.stopFollow();
            }
          };

          const destroyMob = (mobId: string) => {
            const mob = mobs.get(mobId);
            if (!mob) {
              return;
            }

            mob.shadow.destroy();
            mob.burnAura.destroy();
            mob.sprite.destroy();
            mob.deathEffect.destroy();
            mob.burnEffect.destroy();
            mob.burnStatusIcon.back.destroy();
            mob.burnStatusIcon.cooldownOverlay.destroy();
            mob.burnStatusIcon.icon.destroy();
            mob.burnStatusIcon.timerText.destroy();
            mob.nameplate.destroy();
            mob.healthBarFrame.destroy();
            mob.healthBarBack.destroy();
            mob.healthBarFill.destroy();
            mob.castBarFrame.destroy();
            mob.castBarBack.destroy();
            mob.castBarFill.destroy();
            mob.healthText.destroy();
            mob.healthSegments.forEach((segment) => segment.destroy());
            mobs.delete(mobId);
          };

          const updateCharacterPose = (
            character: CharacterVisual,
            isMoving: boolean,
            deltaSeconds: number,
            now: number,
            lookTargetY?: number,
          ) => {
            character.motionPhase += deltaSeconds * (isMoving ? 12 : 4);
            character.effectPhase += deltaSeconds * 4;

            const nextAnimationState: PlayerAnimationState = isMoving ? 'move' : 'idle';
            syncAnimationState(character, nextAnimationState, now);

            const bodyAnimation =
              PLAYER_ANIMATIONS[character.currentAnimationState] ?? PLAYER_ANIMATIONS.idle;
            if (bodyAnimation) {
              const bodyFrame = getAnimationFrameAtState(bodyAnimation, character, now);
              if (
                character.currentBodyTextureKey !== bodyAnimation.textureKey ||
                character.currentBodyFrame !== bodyFrame
              ) {
                character.body.setTexture(bodyAnimation.textureKey, bodyFrame);
                character.currentBodyTextureKey = bodyAnimation.textureKey;
                character.currentBodyFrame = bodyFrame;
              }
            }

            const animationElapsedMs = Math.max(0, now - character.animationStartedAt);
            const handOffsets =
              PLAYER_HAND_ANIMATION_OFFSETS[character.currentAnimationState] ??
              PLAYER_HAND_ANIMATION_OFFSETS.idle;
            const handFrameOffset = bodyAnimation
              ? getSpriteSheetAnimationFrameOffset(bodyAnimation, animationElapsedMs)
              : 0;
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
              meadowMap.tileSize,
            );
            const rightHandPosition = getHandLocalPosition(
              PLAYER_HAND_BASE_OFFSETS.right,
              {
                x: handOffsets?.rightX[handFrameIndex] ?? 0,
                y: handOffsets?.rightY[handFrameIndex] ?? 0,
              },
              meadowMap.tileSize,
            );
            character.leftHand.x = leftHandPosition.x;
            character.leftHand.y = leftHandPosition.y;
            character.rightHand.x = rightHandPosition.x;
            character.rightHand.y = rightHandPosition.y;

            const bodyPixelSize =
              getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, meadowMap.tileSize);
            const headAnimationOffsetY = getPlayerHeadOffsetY(
              bodyAnimation,
              character.animationStartedAt,
              now,
              bodyPixelSize,
            );
            const eyeDirection = getEyeLookDirection(lookTargetY, character.container.y);
            const leftEyePosition = getEyeLocalPosition(eyeDirection, 'left', meadowMap.tileSize);
            const rightEyePosition = getEyeLocalPosition(eyeDirection, 'right', meadowMap.tileSize);
            const weaponBob = isMoving ? Math.cos(character.motionPhase * 2) * 0.4 : 0;
            const heldCastItemId = getHeldCastConsumableItemId(character);
            const heldCastItem = heldCastItemId ? EQUIPMENT_ITEMS[heldCastItemId] : undefined;
            const showHeldCastItem = Boolean(heldCastItem);
            const showWeapon = Boolean(character.currentWeaponItem) && !showHeldCastItem;

            if (heldCastItemId !== character.currentCastItemId) {
              if (heldCastItem) {
                character.castItem.setTexture(heldCastItem.textureKey);
                character.castItem.setAngle(heldCastItem.worldRotationDeg ?? -18);
                character.castItem.setScale(
                  heldCastItem.worldScale ??
                    heldCastItem.compactIconScale ??
                    heldCastItem.iconScale ??
                    1,
                );
              } else {
                character.castItem.setVisible(false);
                character.castItem.setAngle(0);
                character.castItem.setScale(1);
              }

              character.currentCastItemId = heldCastItemId;
            }

            character.body.x = DEFAULT_PLAYER_VISUALS.body.offsetX;
            character.body.y = DEFAULT_PLAYER_VISUALS.body.offsetY;
            character.weaponItem.x = 10 + character.currentWeaponOffsetX;
            character.weaponItem.y = 2 + weaponBob + character.currentWeaponOffsetY;
            character.weaponItem.setVisible(showWeapon);
            character.castItem.x = 10 + character.currentWeaponOffsetX;
            character.castItem.y = 2 + weaponBob + character.currentWeaponOffsetY;
            character.castItem.setVisible(showHeldCastItem);
            if (showHeldCastItem) {
              character.container.bringToTop(character.castItem);
            }
            character.weaponEffects.forEach((effect, index) => {
              effect.aura.setVisible(showWeapon);
              effect.image.setVisible(showWeapon);
              if (!showWeapon) {
                return;
              }
              effect.aura.x = character.weaponItem.x + (effect.baseX - 10);
              effect.aura.y = character.weaponItem.y + (effect.baseY - 2);
              effect.aura.setAlpha(0.34 + Math.sin(character.effectPhase * 3.1 + index) * 0.08);
              effect.aura.setSize(
                24 + Math.sin(character.effectPhase * 2.5 + index) * 4,
                24 + Math.cos(character.effectPhase * 2.1 + index) * 4,
              );
              effect.aura.setFillStyle(
                0xff9a36,
                0.32 + Math.sin(character.effectPhase * 2.8 + index) * 0.07,
              );
              effect.image.x = character.weaponItem.x + (effect.baseX - 10);
              effect.image.y = character.weaponItem.y + (effect.baseY - 2);
              effect.image.setAlpha(effect.baseAlpha + Math.sin(character.effectPhase * 2.6 + index) * 0.06);
              if (effect.animation) {
                effect.image.setFrame(
                  getSpriteSheetAnimationFrame(effect.animation, character.effectPhase * 1000, index * 60),
                );
              }
            });
            if (character.currentBurnTicksRemaining > 0 && character.currentBurnEndsAt > Date.now()) {
              character.burnAura.setPosition(
                character.container.x,
                character.container.y + 4,
              );
              character.burnAura.setSize(
                36 + Math.sin(character.effectPhase * 3.4) * 5,
                44 + Math.cos(character.effectPhase * 2.8) * 6,
              );
              character.burnAura.setFillStyle(0xff962f, 0.28 + Math.sin(character.effectPhase * 5.2) * 0.07);
              character.body.setTint(0xffd37a);
              character.head.setTint(0xffd37a);
            } else {
              character.body.clearTint();
              character.head.clearTint();
            }
            character.head.x = DEFAULT_PLAYER_VISUALS.head.offsetX;
            character.head.y = DEFAULT_PLAYER_VISUALS.head.offsetY + headAnimationOffsetY;
            character.leftEye.x = leftEyePosition.x;
            character.leftEye.y = leftEyePosition.y + headAnimationOffsetY;
            character.rightEye.x = rightEyePosition.x;
            character.rightEye.y = rightEyePosition.y + headAnimationOffsetY;
            character.shadow.width = 22;
          };

          const castFireball = (targetX: number, targetY: number) => {
            if (!roomRef.current) {
              return;
            }
            const localCharacter = localSessionId ? characters.get(localSessionId) : undefined;
            if (localCharacter && localCharacter.currentCastEndsAt > Date.now()) {
              return;
            }
            const resolvedTarget = localCharacter
              ? clampTargetToCastRange(latestProfileRef.current.playerEquipment, localCharacter.container.x, localCharacter.container.y, targetX, targetY)
              : { x: targetX, y: targetY, clamped: false };
            const castSkillMessage: CastSkillMessage = {
              skillId: 'fireball',
              targetX: resolvedTarget.x,
              targetY: resolvedTarget.y,
            };
            roomRef.current.send('castSkill', castSkillMessage);

            if (localCharacter) {
              const castStartedAt = Date.now();
              const castTimeMs = getCharacterCastTimeMs(latestProfileRef.current.playerEquipment);
              if (castTimeMs > 0) {
                applyCastingToCharacterVisual(
                  localCharacter,
                  'fireball',
                  castStartedAt,
                  castStartedAt + castTimeMs,
                );
              }
            }

            fireballCastRef.current?.({ x: resolvedTarget.x, y: resolvedTarget.y });
          };

          const castFireField = (targetX: number, targetY: number) => {
            if (!roomRef.current) {
              return;
            }
            const localCharacter = localSessionId ? characters.get(localSessionId) : undefined;
            const resolvedTarget = localCharacter
              ? clampTargetToCastRange(latestProfileRef.current.playerEquipment, localCharacter.container.x, localCharacter.container.y, targetX, targetY)
              : { x: targetX, y: targetY, clamped: false };

            const castSkillMessage: CastSkillMessage = {
              skillId: 'fireField',
              targetX: resolvedTarget.x,
              targetY: resolvedTarget.y,
            };
            roomRef.current.send('castSkill', castSkillMessage);
          };

          this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!isRaidScene && worldEditorEnabledRef.current) {
              const activeElement = document.activeElement;
              if (activeElement instanceof HTMLElement) {
                activeElement.blur();
              }
              const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
              const tileX = Math.max(0, Math.min(meadowMap.width - 1, Math.floor(worldPoint.x / tileSize)));
              const tileY = Math.max(0, Math.min(meadowMap.height - 1, Math.floor(worldPoint.y / tileSize)));
              const currentEditorMode = worldEditorModeRef.current;
              const canEraseWorldEdit =
                currentEditorMode === 'sprite' || currentEditorMode === 'trader' || currentEditorMode === 'mob';

              if (pointer.button === 2 || pointer.button === 0) {
                pointer.event?.preventDefault();
                worldEditPointerActive = true;
                worldEditEraseMode = pointer.button === 2 && canEraseWorldEdit;
                lastWorldEditedTileKey = `${tileX}:${tileY}:${worldEditEraseMode ? 'erase' : 'paint'}`;
                worldEditPaintRef.current?.(tileX, tileY, pointer.button === 2 && canEraseWorldEdit);

                if (currentEditorMode === 'sprite') {
                  const tileKey = `${tileX}:${tileY}`;
                  if (pointer.button === 2) {
                    const existingSprite = worldStampSpritesByTile.get(tileKey);
                    if (existingSprite) {
                      const existingIndex = worldStampSprites.indexOf(existingSprite);
                      if (existingIndex >= 0) {
                        worldStampSprites.splice(existingIndex, 1);
                      }
                      existingSprite.destroy();
                      worldStampSpritesByTile.delete(tileKey);
                    }
                  } else {
                    const currentSelectedWorldSprite = selectedWorldSpriteRef.current;
                    const previewTextureKey = getWorldStampTextureKey(currentSelectedWorldSprite.texturePath);
                    if (currentSelectedWorldSprite.texturePath && this.textures.exists(previewTextureKey)) {
                      const existingSprite = worldStampSpritesByTile.get(tileKey);
                      if (existingSprite) {
                        const existingIndex = worldStampSprites.indexOf(existingSprite);
                        if (existingIndex >= 0) {
                          worldStampSprites.splice(existingIndex, 1);
                        }
                        existingSprite.destroy();
                      }
                      const worldX = tileX * tileSize + tileSize / 2;
                      const worldY = tileY * tileSize + tileSize / 2;
                      const stampSprite = this.add
                        .image(worldX, worldY, previewTextureKey)
                        .setDisplaySize(tileSize * currentSelectedWorldSprite.scale, tileSize * currentSelectedWorldSprite.scale)
                        .setAngle(currentSelectedWorldSprite.rotation)
                        .setFlipX(currentSelectedWorldSprite.flipX)
                        .setOrigin(0.5)
                        .setDepth(1.5);
                      worldStampSprites.push(stampSprite);
                      worldStampSpritesByTile.set(tileKey, stampSprite);
                    }
                  }
                }
              }
              return;
            }

            if (!activeSkillTargetingRef.current) {
              return;
            }

            const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);

            if (pointer.button === 2) {
              skillTargetCancelRef.current?.();
              return;
            }

            if (pointer.button === 0) {
              if (activeSkillTargetingRef.current === 'fireball') {
                castFireball(worldPoint.x, worldPoint.y);
              } else if (activeSkillTargetingRef.current === 'fireField') {
                castFireField(worldPoint.x, worldPoint.y);
              }
              skillTargetCancelRef.current?.();
            }
          });

          this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!worldEditPointerActive || isRaidScene || !worldEditorEnabledRef.current) {
              return;
            }

            const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
            const tileX = Math.max(0, Math.min(meadowMap.width - 1, Math.floor(worldPoint.x / tileSize)));
            const tileY = Math.max(0, Math.min(meadowMap.height - 1, Math.floor(worldPoint.y / tileSize)));
            const tileKey = `${tileX}:${tileY}:${worldEditEraseMode ? 'erase' : 'paint'}`;
            if (tileKey === lastWorldEditedTileKey) {
              return;
            }

            lastWorldEditedTileKey = tileKey;
            worldEditPaintRef.current?.(tileX, tileY, worldEditEraseMode);

            if (worldEditorModeRef.current === 'sprite') {
              const mapTileKey = `${tileX}:${tileY}`;
              if (worldEditEraseMode) {
                const existingSprite = worldStampSpritesByTile.get(mapTileKey);
                if (existingSprite) {
                  const existingIndex = worldStampSprites.indexOf(existingSprite);
                  if (existingIndex >= 0) {
                    worldStampSprites.splice(existingIndex, 1);
                  }
                  existingSprite.destroy();
                  worldStampSpritesByTile.delete(mapTileKey);
                }
              } else {
                const currentSelectedWorldSprite = selectedWorldSpriteRef.current;
                const previewTextureKey = getWorldStampTextureKey(currentSelectedWorldSprite.texturePath);
                if (currentSelectedWorldSprite.texturePath && this.textures.exists(previewTextureKey)) {
                  const existingSprite = worldStampSpritesByTile.get(mapTileKey);
                  if (existingSprite) {
                    const existingIndex = worldStampSprites.indexOf(existingSprite);
                    if (existingIndex >= 0) {
                      worldStampSprites.splice(existingIndex, 1);
                    }
                    existingSprite.destroy();
                  }
                  const worldX = tileX * tileSize + tileSize / 2;
                  const worldY = tileY * tileSize + tileSize / 2;
                  const stampSprite = this.add
                    .image(worldX, worldY, previewTextureKey)
                    .setDisplaySize(tileSize * currentSelectedWorldSprite.scale, tileSize * currentSelectedWorldSprite.scale)
                    .setAngle(currentSelectedWorldSprite.rotation)
                    .setFlipX(currentSelectedWorldSprite.flipX)
                    .setOrigin(0.5)
                    .setDepth(1.5);
                  worldStampSprites.push(stampSprite);
                  worldStampSpritesByTile.set(mapTileKey, stampSprite);
                }
              }
            }
          });

          this.input.on('pointerup', () => {
            worldEditPointerActive = false;
            lastWorldEditedTileKey = '';
          });

          this.input.on('pointerupoutside', () => {
            worldEditPointerActive = false;
            lastWorldEditedTileKey = '';
          });

          const syncPlayersFromRoom = () => {
            if (!room) {
              return;
            }

            const seen = new Set<string>();

            room.state.players.forEach((networkPlayer, sessionId) => {
              const networkPlayerState = networkPlayer as Partial<NetworkPlayerState> & RaidNetworkPlayerState;
              seen.add(sessionId);

              if (networkPlayerState.dead !== true) {
                completedDeadPlayerIds.delete(sessionId);
              }

              let character = characters.get(sessionId);
              if (!character) {
                if (networkPlayerState.dead === true && completedDeadPlayerIds.has(sessionId)) {
                  return;
                }
              }
              const equipment = {
                body: toEquipmentItemId(networkPlayerState.bodyItem ?? ''),
                head: toEquipmentItemId(networkPlayerState.headItem ?? ''),
                weapon: toEquipmentItemId(networkPlayerState.weaponItem ?? ''),
                'head-gem-1': networkPlayerState.headGemItem1 ? (networkPlayerState.headGemItem1 as EquippableItemId) : undefined,
                'head-gem-2': networkPlayerState.headGemItem2 ? (networkPlayerState.headGemItem2 as EquippableItemId) : undefined,
                'head-gem-3': networkPlayerState.headGemItem3 ? (networkPlayerState.headGemItem3 as EquippableItemId) : undefined,
                'body-gem-1': networkPlayerState.bodyGemItem1 ? (networkPlayerState.bodyGemItem1 as EquippableItemId) : undefined,
                'body-gem-2': networkPlayerState.bodyGemItem2 ? (networkPlayerState.bodyGemItem2 as EquippableItemId) : undefined,
                'body-gem-3': networkPlayerState.bodyGemItem3 ? (networkPlayerState.bodyGemItem3 as EquippableItemId) : undefined,
                'weapon-gem-1': networkPlayerState.weaponGemItem1 ? (networkPlayerState.weaponGemItem1 as EquippableItemId) : undefined,
                'weapon-gem-2': networkPlayerState.weaponGemItem2 ? (networkPlayerState.weaponGemItem2 as EquippableItemId) : undefined,
                'weapon-gem-3': networkPlayerState.weaponGemItem3 ? (networkPlayerState.weaponGemItem3 as EquippableItemId) : undefined,
              };

              if (!character) {
                character = createCharacter(
                  networkPlayerState.x,
                  networkPlayerState.y,
                  networkPlayerState.name,
                  networkPlayerState.health,
                  networkPlayerState.maxHealth,
                  equipment,
                );
                characters.set(sessionId, character);
              }

              const wasDead = character.isDead;
              syncDeathState(character, networkPlayerState.dead === true, this.time.now);
              if (wasDead !== character.isDead) {
                setCharacterVisibility(
                  character,
                  character.isVisible ?? true,
                  sessionId === localSessionId,
                );
              }

              character.targetX = networkPlayerState.x;
              character.targetY = networkPlayerState.y;
              if (sessionId !== localSessionId) {
                const now = this.time.now;
                const distance = Phaser.Math.Distance.Between(
                  character.interpNextX,
                  character.interpNextY,
                  character.targetX,
                  character.targetY,
                );
                if (distance > 64) {
                  character.container.setPosition(character.targetX, character.targetY);
                  character.interpPrevX = character.targetX;
                  character.interpPrevY = character.targetY;
                  character.interpPrevAt = now;
                  character.interpNextX = character.targetX;
                  character.interpNextY = character.targetY;
                  character.interpNextAt = now;
                } else if (
                  character.targetX !== character.interpNextX ||
                  character.targetY !== character.interpNextY
                ) {
                  character.interpPrevX = character.interpNextX;
                  character.interpPrevY = character.interpNextY;
                  character.interpPrevAt = character.interpNextAt;
                  character.interpNextX = character.targetX;
                  character.interpNextY = character.targetY;
                  character.interpNextAt = now;
                }
              }
              if (character.currentName !== networkPlayerState.name) {
                character.nameplate.setText(networkPlayerState.name);
                character.currentName = networkPlayerState.name;
              }
              if (
                character.currentHealth !== networkPlayerState.health ||
                character.currentMaxHealth !== networkPlayerState.maxHealth
              ) {
                applyCharacterHealthToVisual(character, networkPlayerState.health, networkPlayerState.maxHealth);
              }
              if (
                character.currentBurnTicksRemaining !== (networkPlayerState.burnTicksRemaining ?? 0) ||
                character.currentBurnEndsAt !== (networkPlayerState.burnEndsAt ?? 0)
              ) {
                applyBurningToCharacterVisual(
                  character,
                  networkPlayerState.burnTicksRemaining ?? 0,
                  networkPlayerState.burnEndsAt ?? 0,
                );
              }
              if (
                character.currentHealingTicksRemaining !== (networkPlayerState.healingTicksRemaining ?? 0) ||
                character.currentHealingEndsAt !== (networkPlayerState.healingEndsAt ?? 0)
              ) {
                applyHealingToCharacterVisual(
                  character,
                  networkPlayerState.healingTicksRemaining ?? 0,
                  networkPlayerState.healingEndsAt ?? 0,
                );
              }
              if (
                character.currentCastingSkillId !== (networkPlayerState.castingSkillId ?? '') ||
                character.currentCastStartedAt !== (networkPlayerState.castStartedAt ?? 0) ||
                character.currentCastEndsAt !== (networkPlayerState.castEndsAt ?? 0)
              ) {
                applyCastingToCharacterVisual(
                  character,
                  networkPlayerState.castingSkillId ?? '',
                  networkPlayerState.castStartedAt ?? 0,
                  networkPlayerState.castEndsAt ?? 0,
                );
              }
              applyEquipmentToVisual(this, tileSize, character, equipment);

              if (sessionId === localSessionId && !character.isFollowTarget) {
                playerVisualRef.current = {
                  weaponItem: character.weaponItem,
                };
                lastSyncedPositionX = networkPlayerState.x;
                lastSyncedPositionY = networkPlayerState.y;
                lastPositionSyncAt = this.time.now;
                playerVitalsChangeRef.current?.({
                  health: networkPlayerState.health,
                  maxHealth: networkPlayerState.maxHealth,
                });
                playerProgressChangeRef.current?.({
                  level: networkPlayerState.level ?? latestProfileRef.current.playerLevel,
                  experience: networkPlayerState.experience ?? latestProfileRef.current.playerExperience,
                });
                skillCooldownsChangeRef.current?.({
                  fireball: networkPlayerState.fireballCooldownEndsAt ?? 0,
                  fireNova: networkPlayerState.fireNovaCooldownEndsAt ?? 0,
                  fireField: networkPlayerState.fireFieldCooldownEndsAt ?? 0,
                });
                if (isRaidScene) {
                  lastProcessedRaidInput = networkPlayerState.lastProcessedInput ?? 0;
                  pendingRaidInputs = pendingRaidInputs.filter(
                    (input) => input.sequence > lastProcessedRaidInput,
                  );
                } else {
                  lastProcessedWorldInput = networkPlayerState.lastProcessedInput ?? 0;
                  pendingWorldInputs = pendingWorldInputs.filter(
                    (input) => input.sequence > lastProcessedWorldInput,
                  );
                }
                camera.startFollow(character.container, true, 0.18, 0.18);
                character.isFollowTarget = true;
              } else if (sessionId === localSessionId) {
                playerVitalsChangeRef.current?.({
                  health: networkPlayerState.health,
                  maxHealth: networkPlayerState.maxHealth,
                });
                playerProgressChangeRef.current?.({
                  level: networkPlayerState.level ?? latestProfileRef.current.playerLevel,
                  experience: networkPlayerState.experience ?? latestProfileRef.current.playerExperience,
                });
                skillCooldownsChangeRef.current?.({
                  fireball: networkPlayerState.fireballCooldownEndsAt ?? 0,
                  fireNova: networkPlayerState.fireNovaCooldownEndsAt ?? 0,
                  fireField: networkPlayerState.fireFieldCooldownEndsAt ?? 0,
                });

                if (isRaidScene) {
                  const processedInput = networkPlayerState.lastProcessedInput ?? 0;
                  if (processedInput > lastProcessedRaidInput) {
                    lastProcessedRaidInput = processedInput;
                    pendingRaidInputs = pendingRaidInputs.filter(
                      (input) => input.sequence > processedInput,
                    );
                    reconcileRaidLocalCharacter(
                      character,
                      networkPlayerState.x,
                      networkPlayerState.y,
                      lastRaidTilesWidth || raidWidth,
                      lastRaidTilesHeight || raidHeight,
                    );
                  }
                } else {
                  const processedInput = networkPlayerState.lastProcessedInput ?? 0;
                  if (processedInput > lastProcessedWorldInput) {
                    lastProcessedWorldInput = processedInput;
                    pendingWorldInputs = pendingWorldInputs.filter(
                      (input) => input.sequence > processedInput,
                    );
                    reconcileWorldLocalCharacter(
                      character,
                      networkPlayerState.x,
                      networkPlayerState.y,
                    );
                  }
                }
              }
            });

            [...characters.keys()].forEach((sessionId) => {
              if (!seen.has(sessionId)) {
                destroyCharacter(sessionId);
              }
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
            lastRaidMinimapVisionKey = '';
            lastRaidObjectVisibilityUpdateAt = 0;
            lastRaidMinimapUpdateAt = 0;
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
          ) => {
            const mapWidthPixels = width * tileSize;
            const mapHeightPixels = height * tileSize;
            let resolvedX = authoritativeX;
            let resolvedY = authoritativeY;

            pendingRaidInputs.forEach((input) => {
              const replayed = applyRaidPredictedMovement(
              resolvedX,
              resolvedY,
              input.x,
              input.y,
              input.durationMs / 1000,
              tileSize,
              mapWidthPixels,
                mapHeightPixels,
                raidBlockedTiles,
                width,
                height,
                raidChestBlockedTiles,
                CLIENT_RAID_PLAYER_SPEED,
              );
              resolvedX = replayed.x;
              resolvedY = replayed.y;
            });

            const reconciliationDistance = Phaser.Math.Distance.Between(
              character.simX,
              character.simY,
              resolvedX,
              resolvedY,
            );

            if (reconciliationDistance <= 0.35) {
              return;
            }

            if (reconciliationDistance > 18) {
              character.simPrevX = resolvedX;
              character.simPrevY = resolvedY;
              character.simX = resolvedX;
              character.simY = resolvedY;
              return;
            }

            const correctedX = Phaser.Math.Linear(character.simX, resolvedX, 0.35);
            const correctedY = Phaser.Math.Linear(character.simY, resolvedY, 0.35);
            character.simPrevX = character.simX;
            character.simPrevY = character.simY;
            character.simX = correctedX;
            character.simY = correctedY;
          };

          const reconcileWorldLocalCharacter = (
            character: CharacterVisual,
            authoritativeX: number,
            authoritativeY: number,
          ) => {
            let resolvedX = authoritativeX;
            let resolvedY = authoritativeY;

            pendingWorldInputs.forEach((input) => {
              const replayed = applyWorldPredictedMovement(
                resolvedX,
                resolvedY,
                input.x,
                input.y,
                input.durationMs,
                tileSize,
                meadowMap.width * tileSize,
                meadowMap.height * tileSize,
                meadowMap,
                meadowDecorations,
                CLIENT_PLAYER_SPEED,
              );
              resolvedX = replayed.x;
              resolvedY = replayed.y;
            });

            const reconciliationDistance = Phaser.Math.Distance.Between(
              character.simX,
              character.simY,
              resolvedX,
              resolvedY,
            );

            if (reconciliationDistance <= 0.35) {
              return;
            }

            if (reconciliationDistance > 18) {
              character.simPrevX = resolvedX;
              character.simPrevY = resolvedY;
              character.simX = resolvedX;
              character.simY = resolvedY;
              return;
            }

            const correctedX = Phaser.Math.Linear(character.simX, resolvedX, 0.35);
            const correctedY = Phaser.Math.Linear(character.simY, resolvedY, 0.35);
            character.simPrevX = character.simX;
            character.simPrevY = character.simY;
            character.simX = correctedX;
            character.simY = correctedY;
          };

          const setCharacterVisibility = (character: CharacterVisual, visible: boolean, isLocalPlayer = false) => {
            const shouldShowActor = visible || isLocalPlayer;
            const shouldShowAliveVisuals = shouldShowActor && !character.isDead;
            const alpha = shouldShowAliveVisuals ? 1 : 0;
            character.shadow.setVisible(shouldShowAliveVisuals);
            character.container.setVisible(shouldShowAliveVisuals);
            character.deathEffect.setVisible(shouldShowActor && character.isDead);
            character.nameplate.setVisible(shouldShowAliveVisuals);
            character.healthBarFrame.setVisible(shouldShowAliveVisuals);
            character.healthBarBack.setVisible(shouldShowAliveVisuals);
            character.healthBarFill.setVisible(shouldShowAliveVisuals);
            character.castBarFrame.setVisible(false);
            character.castBarBack.setVisible(false);
            character.castBarFill.setVisible(false);
            character.healthText.setVisible(false);
            character.healthSegments.forEach((segment) => segment.setVisible(shouldShowAliveVisuals));
            character.burnAura.setVisible(
              shouldShowAliveVisuals &&
                character.currentBurnTicksRemaining > 0 &&
                character.currentBurnEndsAt > Date.now(),
            );
            if (!shouldShowAliveVisuals) {
              hideStatusIcon(character.burnStatusIcon);
              hideStatusIcon(character.healingStatusIcon);
            }
            character.container.setAlpha(alpha);
            character.shadow.setAlpha(shouldShowAliveVisuals ? 0.18 : 0);
            character.deathEffect.setAlpha(shouldShowActor && character.isDead ? 1 : 0);
            character.nameplate.setAlpha(alpha);
            character.burnStatusIcon.back.setAlpha(alpha);
            character.burnStatusIcon.cooldownOverlay.setAlpha(alpha);
            character.burnStatusIcon.icon.setAlpha(alpha);
            character.burnStatusIcon.timerText.setAlpha(alpha);
            character.healingStatusIcon.back.setAlpha(alpha);
            character.healingStatusIcon.cooldownOverlay.setAlpha(alpha);
            character.healingStatusIcon.icon.setAlpha(alpha);
            character.healingStatusIcon.timerText.setAlpha(alpha);
            character.healthBarFrame.setAlpha(alpha);
            character.healthBarBack.setAlpha(alpha);
            character.healthBarFill.setAlpha(alpha);
            character.castBarFrame.setAlpha(alpha);
            character.castBarBack.setAlpha(alpha);
            character.castBarFill.setAlpha(alpha);
            character.healthText.setAlpha(0);
            character.healthSegments.forEach((segment) => segment.setAlpha(alpha));
          };

          const setMobVisibility = (mob: MobVisual, visible: boolean) => {
            const shouldShowAliveVisuals = visible && !mob.isDead;
            mob.shadow.setVisible(shouldShowAliveVisuals);
            mob.sprite.setVisible(shouldShowAliveVisuals);
            mob.deathEffect.setVisible(visible && mob.isDead);
            mob.nameplate.setVisible(false);
            mob.healthBarFrame.setVisible(shouldShowAliveVisuals);
            mob.healthBarBack.setVisible(shouldShowAliveVisuals);
            mob.healthBarFill.setVisible(shouldShowAliveVisuals);
            const shouldShowCastBar =
              shouldShowAliveVisuals &&
              mob.currentCastingSkillId.length > 0 &&
              mob.currentCastEndsAt > Date.now() &&
              mob.currentCastEndsAt > mob.currentCastStartedAt;
            mob.castBarFrame.setVisible(shouldShowCastBar);
            mob.castBarBack.setVisible(shouldShowCastBar);
            mob.castBarFill.setVisible(shouldShowCastBar);
            mob.healthText.setVisible(false);
            mob.healthSegments.forEach((segment) => segment.setVisible(shouldShowAliveVisuals));
            mob.burnAura.setVisible(
              shouldShowAliveVisuals &&
                mob.currentBurnTicksRemaining > 0 &&
                mob.currentBurnEndsAt > Date.now(),
            );
            const alpha = shouldShowAliveVisuals ? 1 : 0;
            mob.shadow.setAlpha(shouldShowAliveVisuals ? 0.18 : 0);
            mob.sprite.setAlpha(alpha);
            mob.deathEffect.setAlpha(visible && mob.isDead ? 1 : 0);
            mob.nameplate.setAlpha(0);
            if (!shouldShowAliveVisuals) {
              hideStatusIcon(mob.burnStatusIcon);
            }
            mob.burnStatusIcon.back.setAlpha(alpha);
            mob.burnStatusIcon.cooldownOverlay.setAlpha(alpha);
            mob.burnStatusIcon.icon.setAlpha(alpha);
            mob.burnStatusIcon.timerText.setAlpha(alpha);
            mob.healthBarFrame.setAlpha(alpha);
            mob.healthBarBack.setAlpha(alpha);
            mob.healthBarFill.setAlpha(alpha);
            mob.castBarFrame.setAlpha(alpha);
            mob.castBarBack.setAlpha(alpha);
            mob.castBarFill.setAlpha(alpha);
            mob.healthText.setAlpha(0);
            mob.healthSegments.forEach((segment) => segment.setAlpha(alpha));
          };

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
            emitRaidMinimapSnapshot(originTileX, originTileY, width, height, tiles, visionKey, now, force);
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
            if (!room || !('mobs' in room.state)) {
              [...mobs.keys()].forEach((mobId) => destroyMob(mobId));
              return;
            }

            const seen = new Set<string>();

            room.state.mobs.forEach((networkMob, mobId) => {
              seen.add(mobId);

              if (networkMob.dead !== true) {
                completedDeadMobIds.delete(mobId);
              }

              let mob = mobs.get(mobId);
              if (!mob) {
                if (networkMob.dead === true && completedDeadMobIds.has(mobId)) {
                  return;
                }

                mob = createMob(
                  networkMob.x,
                  networkMob.y,
                  networkMob.texture,
                  networkMob.name,
                  networkMob.health,
                  networkMob.maxHealth,
                );
                mobs.set(mobId, mob);
              }

              if (
                Math.abs(networkMob.x - mob.targetX) > 0.25 ||
                Math.abs(networkMob.y - mob.targetY) > 0.25
              ) {
                mob.lastMovedAt = this.time.now;
              }

              mob.targetX = networkMob.x;
              mob.targetY = networkMob.y;
              const wasDead = mob.isDead;
              syncDeathState(mob, networkMob.dead === true, this.time.now);
              if (wasDead !== mob.isDead) {
                setMobVisibility(mob, mob.isVisible ?? true);
              }
              mob.currentAttackCooldownEndsAt = networkMob.attackCooldownEndsAt ?? 0;
              mob.currentAttackCooldownMs = networkMob.attackCooldownMs ?? 0;
              mob.currentCastingSkillId = networkMob.castingSkillId ?? "";
              mob.currentCastStartedAt = networkMob.castStartedAt ?? 0;
              mob.currentCastEndsAt = networkMob.castEndsAt ?? 0;
              mob.currentSkillLungeStartedAt = networkMob.skillLungeStartedAt ?? 0;
              mob.currentSkillLungeEndsAt = networkMob.skillLungeEndsAt ?? 0;
              if (mob.currentName !== networkMob.name) {
                mob.nameplate.setText(networkMob.name);
                mob.currentName = networkMob.name;
              }
              if (
                mob.currentHealth !== networkMob.health ||
                mob.currentMaxHealth !== networkMob.maxHealth
              ) {
                applyMobHealthToVisual(mob, networkMob.health, networkMob.maxHealth);
              }
              if (
                mob.currentBurnTicksRemaining !== (networkMob.burnTicksRemaining ?? 0) ||
                mob.currentBurnEndsAt !== (networkMob.burnEndsAt ?? 0)
              ) {
                applyBurningToMobVisual(
                  mob,
                  networkMob.burnTicksRemaining ?? 0,
                  networkMob.burnEndsAt ?? 0,
                );
              }
            });

            [...mobs.keys()].forEach((mobId) => {
              if (!seen.has(mobId)) {
                destroyMob(mobId);
              }
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

              const chestTexture = 'chest-8x8';

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
            if (!room || !('projectiles' in room.state)) {
              projectileSprites.forEach((projectileVisual) => {
                projectileVisual.aura.destroy();
                projectileVisual.sprite.destroy();
              });
              projectileSprites.clear();
              return;
            }

            const seen = new Set<string>();

            room.state.projectiles.forEach((projectile, projectileId) => {
              seen.add(projectileId);
              let projectileVisual = projectileSprites.get(projectileId);

              if (!projectileVisual) {
                const isShard = projectile.skillId === 'fireballShard';
                const aura = this.add
                  .ellipse(
                    projectile.x,
                    projectile.y,
                    isShard ? 14 : 22,
                    isShard ? 14 : 22,
                    0xff962f,
                    projectile.skillId === 'fireNova' ? 0.32 : isShard ? 0.18 : 0.24,
                  )
                  .setDepth(34);
                const animation = getProjectileAnimation(projectile.skillId, projectileAnimations);
                const projectileDisplaySize = getProjectileDisplaySize(projectile.skillId, resolvedSkillEffects);
                const sprite = this.add
                  .image(projectile.x, projectile.y, animation.textureKey, 0)
                  .setDisplaySize(
                    projectileDisplaySize,
                    projectileDisplaySize,
                  )
                  .setDepth(35)
                  .setOrigin(0.5)
                  .setAlpha(0.98);
                projectileVisual = {
                  aura,
                  sprite,
                  targetX: projectile.x,
                  targetY: projectile.y,
                  animation,
                };
                projectileSprites.set(projectileId, projectileVisual);
              }

              projectileVisual.targetX = projectile.x;
              projectileVisual.targetY = projectile.y;
              projectileVisual.sprite.setAngle(
                Phaser.Math.RadToDeg(
                  Phaser.Math.Angle.Between(
                    projectile.x,
                    projectile.y,
                    projectile.x + projectile.directionX,
                    projectile.y + projectile.directionY,
                  ),
                ),
              );
              projectileVisual.sprite.setFrame(
                getSpriteSheetAnimationFrame(
                  projectileVisual.animation,
                  Math.max(0, projectile.lifetime * 1000),
                ),
              );
            });

            for (const [projectileId, projectileVisual] of projectileSprites.entries()) {
              if (seen.has(projectileId)) {
                continue;
              }

              projectileVisual.aura.destroy();
              projectileVisual.sprite.destroy();
              projectileSprites.delete(projectileId);
            }
          };

          const syncGroundEffectsFromRoom = () => {
            if (!room || !('groundEffects' in room.state)) {
              groundEffects.forEach((effectVisual) => {
                effectVisual.tile.destroy();
                effectVisual.aura.destroy();
                effectVisual.flames.forEach((flame) => flame.destroy());
              });
              groundEffects.clear();
              return;
            }

            const seen = new Set<string>();

            room.state.groundEffects.forEach((effect, effectId) => {
              seen.add(effectId);
              let effectVisual = groundEffects.get(effectId);

              if (!effectVisual) {
                const isFireTrail = effect.skillId === 'fireTrail';
                const trailDisplaySize = isFireTrail
                  ? Math.max(18, resolvedSkillEffects.fireField.displaySize * 0.75)
                  : resolvedSkillEffects.fireField.displaySize;
                const tile = this.add
                  .rectangle(effect.x, effect.y, meadowMap.tileSize, meadowMap.tileSize, isFireTrail ? 0xff7d1f : 0xff5e1a, isFireTrail ? 0.11 : 0.14)
                  .setOrigin(0.5)
                  .setDepth(0.4);
                const aura = this.add
                  .ellipse(effect.x, effect.y + 7, meadowMap.tileSize * 0.95, meadowMap.tileSize * 0.68, isFireTrail ? 0xffb347 : 0xff9f38, isFireTrail ? 0.14 : 0.18)
                  .setOrigin(0.5)
                  .setDepth(0.5);
                const flames = [
                  { x: -8, y: -7, scale: 0.56, alpha: 0.9 },
                  { x: 8, y: -7, scale: 0.56, alpha: 0.9 },
                  { x: -8, y: 7, scale: 0.56, alpha: 0.86 },
                  { x: 8, y: 7, scale: 0.56, alpha: 0.86 },
                ].map((offset) =>
                  this.add
                    .image(effect.x + offset.x, effect.y + offset.y, groundAnimation.textureKey, 0)
                    .setDisplaySize(
                      trailDisplaySize,
                      trailDisplaySize,
                    )
                    .setScale(isFireTrail ? offset.scale * 0.82 : offset.scale)
                    .setOrigin(0.5)
                    .setDepth(0.6)
                    .setAlpha(isFireTrail ? offset.alpha * 0.88 : offset.alpha),
                );
                effectVisual = {
                  tile,
                  aura,
                  flames,
                  x: effect.x,
                  y: effect.y,
                };
                groundEffects.set(effectId, effectVisual);
              }

              effectVisual.x = effect.x;
              effectVisual.y = effect.y;
              effectVisual.tile.setPosition(effect.x, effect.y);
              effectVisual.aura.setPosition(effect.x, effect.y + 6);
            });

            for (const [effectId, effectVisual] of groundEffects.entries()) {
              if (seen.has(effectId)) {
                continue;
              }

              effectVisual.tile.destroy();
              effectVisual.aura.destroy();
              effectVisual.flames.forEach((flame) => flame.destroy());
              groundEffects.delete(effectId);
            }
          };

          const createFloatingDamageText = (x: number, y: number, text: string, color = '#ff5959') => {
            if (
              isRaidScene &&
              lastRaidTilesWidth > 0 &&
              lastRaidTilesHeight > 0
            ) {
              const tileX = Math.max(0, Math.min(lastRaidTilesWidth - 1, Math.floor(x / tileSize)));
              const tileY = Math.max(0, Math.min(lastRaidTilesHeight - 1, Math.floor(y / tileSize)));
              if (!visibleRaidTiles.has(tileY * lastRaidTilesWidth + tileX)) {
                return;
              }
            }

            const label = this.add
              .text(x, y, text, {
                color,
                fontFamily: 'monospace',
                fontSize: '14px',
                fontStyle: 'bold',
                stroke: '#3b0909',
                strokeThickness: 3,
              })
              .setOrigin(0.5)
              .setScale(0.55)
              .setDepth(62);

            this.tweens.add({
              targets: label,
              y: y - 18,
              alpha: 0,
              scale: 0.72,
              duration: 650,
              ease: 'Cubic.Out',
              onComplete: () => label.destroy(),
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
            playerInventory: latestProfileRef.current.playerInventory,
            playerEquipment: latestProfileRef.current.playerEquipment,
          };
          const defaultWorldSpawn = {
            x: meadowAsset.spawn.x * tileSize + tileSize / 2,
            y: meadowAsset.spawn.y * tileSize + tileSize / 2,
          };
          const joinOptions: WorldRoomJoinOptions | RaidRoomJoinOptions = activeRoomName === 'world'
            ? {
              ...(activeRoomOptions ?? {}),
              ...createWorldProfileMessage(
                latestProfileSnapshot,
                latestProfileSnapshot.playerPosition.x <= 0 &&
                  latestProfileSnapshot.playerPosition.y <= 0
                  ? defaultWorldSpawn
                  : latestProfileSnapshot.playerPosition,
              ),
              worldOwner: latestProfileSnapshot.playerName,
              worldSpawn: defaultWorldSpawn,
            }
            : {
              ...(activeRoomOptions ?? {}),
              ...createBaseProfileMessage(latestProfileSnapshot),
            };

          void networkClient
            .joinOrCreate(activeRoomName, joinOptions)
            .then((joinedRoom) => {
              room = joinedRoom as RealtimeRoom;
              roomRef.current = room;
              localSessionId = room.sessionId;
              if (sceneActive && statusText.active) {
                statusText.setText(isRaidScene ? 'Raid connected' : 'World connected');
              }
              roomConnectedRef.current?.({
                roomName: activeRoomName,
                options: activeRoomOptions,
              });

              if (!isRaidScene) {
                const profileMessage = createWorldProfileMessage(latestProfileSnapshot);
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

              room.onLeave(() => {
                if (sceneActive && statusText.active) {
                  statusText.setText(isRaidScene ? 'Disconnected from raid' : 'Disconnected from world');
                }
                chatSenderReadyRef.current?.(null);
              });

              room.onMessage('chatHistory', (messages: RealtimeChatMessage[]) => {
                chatHistoryRef.current?.(messages);
              });

              room.onMessage('chat', (message: RealtimeChatMessage) => {
                chatMessageRef.current?.(message);
              });

              room.onMessage('skillBalanceConfig', (config: SkillBalanceConfig) => {
                hasReceivedSkillBalanceRef.current = true;
                lastKnownSkillBalanceSerializedRef.current = JSON.stringify(config);
                skillBalanceConfigChangeRef.current?.(config);
              });

              room.onMessage('mobBalanceConfig', (config: MobBalanceConfig) => {
                hasReceivedMobBalanceRef.current = true;
                lastKnownMobBalanceSerializedRef.current = JSON.stringify(config);
                mobBalanceConfigChangeRef.current?.(config);
              });

              room.onMessage(
                'died',
                (payload: DiedMessage) => {
                  playerDeathRef.current?.(payload);
                },
              );

              room.onMessage(
                'respawned',
                (payload: RespawnedMessage) => {
                  playerRespawnRef.current?.(payload);
                },
              );

              room.onMessage(
                'inventoryUpdate',
                (payload: InventoryUpdateMessage) => {
                  if (!Array.isArray(payload.inventory)) {
                    return;
                  }

                  playerInventoryChangeRef.current?.(
                    payload.inventory.map((item) => item || null),
                  );
                },
              );

              room.onMessage(
                'consumableCooldown',
                (payload: ConsumableCooldownMessage) => {
                  if (
                    typeof payload.itemId !== 'string' ||
                    typeof payload.cooldownEndsAt !== 'number' ||
                    !Number.isFinite(payload.cooldownEndsAt)
                  ) {
                    return;
                  }

                  consumableCooldownChangeRef.current?.({
                    itemId: payload.itemId,
                    cooldownEndsAt: payload.cooldownEndsAt,
                  });
                },
              );

              room.onMessage(
                'damageText',
                (payload: DamageTextMessage) => {
                  if (
                    typeof payload?.x !== 'number' ||
                    typeof payload?.y !== 'number' ||
                    typeof payload?.text !== 'string' ||
                    !Number.isFinite(payload.x) ||
                    !Number.isFinite(payload.y) ||
                    payload.text.length === 0
                  ) {
                    return;
                  }

                  createFloatingDamageText(payload.x, payload.y, payload.text, payload.color ?? '#ff5959');
                },
              );

              room.onMessage(
                'raidExited',
                (payload: RaidExitStateMessage) => {
                  raidExitRef.current?.(payload);
                },
              );

              room.onMessage(
                'raidExpired',
                (payload: RaidExitStateMessage) => {
                  raidExitRef.current?.(payload);
                },
              );

              syncRaidTilesFromRoom();
              syncPlayersFromRoom();
              syncMobsFromRoom();
              syncChestsFromRoom();
              syncRaidExitPointsFromRoom();
              syncGroundEffectsFromRoom();
              syncProjectilesFromRoom();
              updateRaidVisibility(true);
            })
            .catch(() => {
              if (sceneActive && statusText.active) {
                statusText.setText('Realtime server offline. Start realtime on :2567');
              }
              chatSenderReadyRef.current?.(null);
            });

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
              CLIENT_SIMULATION_STEP_MS * 6,
              movementSimulationAccumulatorMs + delta,
            );

            while (localCharacter && movementSimulationAccumulatorMs >= CLIENT_SIMULATION_STEP_MS) {
              movementSimulationAccumulatorMs -= CLIENT_SIMULATION_STEP_MS;
              const inputChanged = inputSignature !== previousInput;
              const hasMotion = normalizedX !== 0 || normalizedY !== 0;
              const shouldSendInput = hasMotion || inputChanged;
              const mobBlockers = Array.from(mobs.values()).flatMap((mob) =>
                mob.isDead
                  ? []
                  : [{
                    x: mob.sprite.x,
                    y: mob.sprite.y,
                    radius: 22,
                  }],
              );

              if (room && shouldSendInput) {
                previousInput = inputSignature;

                if (isRaidScene) {
                  const sequence = nextRaidInputSequence;
                  nextRaidInputSequence += 1;
                  const moveMessage: MoveMessage = {
                    x: normalizedX,
                    y: normalizedY,
                    sequence,
                  };
                  room.send('move', moveMessage);

                  pendingRaidInputs.push({
                    sequence,
                    x: normalizedX,
                    y: normalizedY,
                    durationMs: CLIENT_SIMULATION_STEP_MS,
                  });

                  if (pendingRaidInputs.length > 90) {
                    pendingRaidInputs = pendingRaidInputs.slice(-90);
                  }
                } else {
                  const sequence = nextWorldInputSequence;
                  nextWorldInputSequence += 1;
                  const moveMessage: MoveMessage = {
                    x: normalizedX,
                    y: normalizedY,
                    sequence,
                  };
                  room.send('move', moveMessage);

                  pendingWorldInputs.push({
                    sequence,
                    x: normalizedX,
                    y: normalizedY,
                    durationMs: CLIENT_SIMULATION_STEP_MS,
                  });

                  if (pendingWorldInputs.length > 90) {
                    pendingWorldInputs = pendingWorldInputs.slice(-90);
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
                  CLIENT_SIMULATION_STEP_MS / 1000,
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
                  CLIENT_SIMULATION_STEP_MS,
                  tileSize,
                  mapWidth,
                  mapHeight,
                  meadowMap,
                  meadowDecorations,
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
                movementSimulationAccumulatorMs / CLIENT_SIMULATION_STEP_MS,
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

                const correctionDistance = Phaser.Math.Distance.Between(
                  character.simX,
                  character.simY,
                  character.targetX,
                  character.targetY,
                );

                if (isRaidScene) {
                  if (pendingRaidInputs.length === 0) {
                    if (correctionDistance > 48) {
                      character.simPrevX = character.targetX;
                      character.simPrevY = character.targetY;
                      character.simX = character.targetX;
                      character.simY = character.targetY;
                    } else if (correctionDistance > 0.8) {
                      const correctionLerp = Math.min(1, deltaSeconds * 14);
                      const correctedX = Phaser.Math.Linear(character.simX, character.targetX, correctionLerp);
                      const correctedY = Phaser.Math.Linear(character.simY, character.targetY, correctionLerp);
                      character.simPrevX = character.simX;
                      character.simPrevY = character.simY;
                      character.simX = correctedX;
                      character.simY = correctedY;
                    }
                  }
                } else if (pendingWorldInputs.length === 0) {
                  if (correctionDistance > 48) {
                    character.simPrevX = character.targetX;
                    character.simPrevY = character.targetY;
                    character.simX = character.targetX;
                    character.simY = character.targetY;
                  } else if (!hasInput && correctionDistance > 0.8) {
                    const correctionLerp = Math.min(1, deltaSeconds * 10);
                    const correctedX = Phaser.Math.Linear(character.simX, character.targetX, correctionLerp);
                    const correctedY = Phaser.Math.Linear(character.simY, character.targetY, correctionLerp);
                    character.simPrevX = character.simX;
                    character.simPrevY = character.simY;
                    character.simX = correctedX;
                    character.simY = correctedY;
                  }
                }

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
                  Phaser.Math.Linear(character.simPrevX, character.simX, localInterpolationAlpha),
                  Phaser.Math.Linear(character.simPrevY, character.simY, localInterpolationAlpha),
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
                  const interpolationDelayMs = 160;
                  const renderTime = this.time.now - interpolationDelayMs;
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
              character.healthSegments.forEach((segment, index) => {
                segment.setPosition(
                  character.container.x - 10.8 + index * 2.4,
                  character.container.y + 22,
                );
              });

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
                character,
                shouldAnimateMove,
                deltaSeconds,
                this.time.now,
                isLocalPlayer ? localLookTargetY : undefined,
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
              mob.healthBarFrame.setPosition(mob.sprite.x, mob.sprite.y + 22 + bobOffset);
              mob.healthBarBack.setPosition(mob.sprite.x, mob.sprite.y + 22 + bobOffset);
              mob.healthBarFill.setPosition(mob.sprite.x - 12, mob.sprite.y + 22 + bobOffset);
              mob.castBarFrame.setPosition(mob.sprite.x, mob.sprite.y + 30 + bobOffset);
              mob.castBarBack.setPosition(mob.sprite.x, mob.sprite.y + 30 + bobOffset);
              mob.castBarFill.setPosition(mob.sprite.x - 12, mob.sprite.y + 30 + bobOffset);
              mob.healthSegments.forEach((segment, index) => {
                segment.setPosition(mob.sprite.x - 10.8 + index * 2.4, mob.sprite.y + 22 + bobOffset);
              });
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
                emitLobbyMinimapSnapshot(localCharacter.container.x, localCharacter.container.y);
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
              chestPrompt.setVisible(false);
              objectiveArrowChangeRef.current?.(null);
              objectivePulse.setVisible(false);
            }

            if (localCharacter && activeSkillTargetingRef.current) {
              castRangeIndicator.setPosition(localCharacter.container.x, localCharacter.container.y);
              castRangeIndicator.setRadius(getCharacterCastRange(latestProfileRef.current.playerEquipment));
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
            } else if (activeSkillTargetingRef.current === 'fireball') {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const originX = localCharacter?.container.x ?? pointerWorld.x;
              const originY = localCharacter?.container.y ?? pointerWorld.y;
              const resolvedTarget = clampTargetToCastRange(latestProfileRef.current.playerEquipment, originX, originY, pointerWorld.x, pointerWorld.y);
              targetingPreviewTiles.forEach((tile) => tile.setVisible(false));
              targetingCursor.setPosition(pointerWorld.x, pointerWorld.y);
              targetingCursor.setText('+');
              targetingCursor.setColor(resolvedTarget.clamped ? '#ff9a7a' : '#ffd18a');
              targetingCursor.setVisible(true);
            } else if (activeSkillTargetingRef.current === 'fireField') {
              const pointer = this.input.activePointer;
              const pointerWorld = camera.getWorldPoint(pointer.x, pointer.y);
              const originX = localCharacter?.container.x ?? pointerWorld.x;
              const originY = localCharacter?.container.y ?? pointerWorld.y;
              const resolvedTarget = clampTargetToCastRange(latestProfileRef.current.playerEquipment, originX, originY, pointerWorld.x, pointerWorld.y);
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
                mobVisual.sprite.setTexture(renderState.textureKey, renderState.frame);
                mobVisual.sprite.setScale(renderState.renderScale);
                mobVisual.sprite.setOrigin(0.5, renderState.anchorY);
                mobVisual.shadow.setPosition(mobVisual.sprite.x, mobVisual.sprite.y + 15);
                mobVisual.nameplate.setPosition(mobVisual.sprite.x, mobVisual.sprite.y - 24);
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
              }
            }
          });

          this.events.once('shutdown', () => {
            sceneActive = false;
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
            room?.leave();
            roomRef.current = null;
            playerVisualRef.current = null;
            characters.forEach((_character, sessionId) => {
              destroyCharacter(sessionId);
            });
          });
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: '#6fbe4a',
        pixelArt: true,
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
      game?.destroy(true);
    };
  }, [activeRoomName, JSON.stringify(activeRoomOptions), playerName, JSON.stringify(skillEffectOverrides)]);

  return <div ref={containerRef} className="h-full w-full" />;
}
