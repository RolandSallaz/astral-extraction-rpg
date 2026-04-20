import type { ConsumableItemId, EquipmentItemId } from '@/lib/items/equipmentItems';
import type { MobAnimationState } from '@mmorpg/shared/mobs/visuals';
import type { MobKind } from '@mmorpg/shared/mobs/catalog';
import type { PlayerAnimationState } from '@mmorpg/shared/player/visuals';
import type { SheetAnimation, PlayerSheetAnimation } from '@/components/game-canvas/playerAnimationHelpers';

type PhaserImage = Phaser.GameObjects.Image;
type PhaserGraphics = Phaser.GameObjects.Graphics;

export type ProjectileVisual = {
  aura: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  targetX: number;
  targetY: number;
  animation: SheetAnimation;
  isVisible?: boolean;
};

export type GroundEffectVisual = {
  tile: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Ellipse;
  flames: Phaser.GameObjects.Image[];
  x: number;
  y: number;
  isVisible?: boolean;
};

export type RaidTileSpriteVisual = {
  base: Phaser.GameObjects.Image;
  overlays: Phaser.GameObjects.Image[];
};

export type CharacterStatusIconVisual = {
  back: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  timerText: Phaser.GameObjects.Text;
};

export type WorldTraderVisual = {
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

export type WorldMobVisual = {
  kind: MobKind;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  nameplate: Phaser.GameObjects.Text;
};

export type ObjectiveTarget = {
  roomName: 'world' | 'raid';
  worldX: number;
  worldY: number;
  label: string;
} | null;

export type MobVisual = {
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
  currentHealthSegmentCount: number;
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

export type CharacterVisual = {
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
  swingTrail: PhaserGraphics;
  swingTrailPoints: Array<{ x: number; y: number; time: number }>;
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
  currentHealthSegmentCount: number;
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
  currentBodyItem?: EquipmentItemId;
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
  simErrorX: number;
  simErrorY: number;
  idleGraceUntil: number;
  isDead: boolean;
  isVisible?: boolean;
};
