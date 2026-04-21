'use client';

import {
  DEFAULT_PLAYER_VISUALS,
  type PlayerAnimationState,
} from '@mmorpg/shared/player/visuals';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import { EQUIPMENT_ITEMS } from '@/lib/items/equipmentItems';
import {
  PLAYER_EYE_COLOR,
  SHARED_DEATH_ANIMATION,
} from '@/components/game-canvas/playerAnimationHelpers';
import {
  getEquippedItemHandPosition,
  getHandDisplaySize,
  getHandLocalPosition,
  getSharedDeathAnimationScale,
  getVisualDisplaySize,
  getVisualPixelSize,
} from '@/components/game-canvas/renderGeometry';
import { applyCharacterHealthToVisual, MAX_HEALTH_BAR_SEGMENTS } from '@/components/game-canvas/healthBarHelpers';
import {
  applyBurningToCharacterVisual,
  applyBurningToMobVisual,
  applyHealingToCharacterVisual,
} from '@/components/game-canvas/statusEffectHelpers';
import { applyEquipmentToVisual } from '@/components/game-canvas/equipmentVisualHelpers';
import { applyMobHealthToVisual } from '@/components/game-canvas/healthBarHelpers';
import type { MobAnimationState } from '@mmorpg/shared/mobs/visuals';
import type { CharacterVisual, MobVisual } from '@/components/game-canvas/gameCanvasVisualTypes';

const PLAYER_BODY_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.body.key;
const PLAYER_HEAD_TEXTURE_KEY = DEFAULT_PLAYER_VISUALS.head.key;
const PLAYER_BODY_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.body.defaultFrame;
const PLAYER_HEAD_DEFAULT_FRAME = DEFAULT_PLAYER_VISUALS.head.defaultFrame;
const PLAYER_HANDS_TEXTURE_KEY = 'player-hands';
const PLAYER_HANDS_DEFAULT_FRAME = 0;
const PLAYER_HAND_BASE_OFFSETS = {
  right: { x: 1, y: 11 },
  left: { x: 11, y: 11 },
};

export function createCharacterVisual(
  scene: Phaser.Scene,
  tileSize: number,
  x: number,
  y: number,
  name: string,
  health: number,
  maxHealth: number,
  equipment: EquipmentState,
): CharacterVisual {
  const shadow = scene.add.ellipse(x, y + 15, 24, 8, 0x000000, 0.18).setDepth(1);
  const burnAura = scene.add
    .ellipse(x, y + 4, 36, 44, 0xff8f2a, 0.32)
    .setDepth(1.5)
    .setVisible(false);
  const deathEffect = scene.add
    .image(x, y, SHARED_DEATH_ANIMATION.textureKey, SHARED_DEATH_ANIMATION.startFrame)
    .setScale(getSharedDeathAnimationScale(tileSize))
    .setOrigin(0.5)
    .setDepth(2.05)
    .setVisible(false);
  const container = scene.add.container(x, y).setDepth(2);
  const body = scene.add
    .image(0, 0, PLAYER_BODY_TEXTURE_KEY, PLAYER_BODY_DEFAULT_FRAME)
    .setDisplaySize(
      getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, tileSize).width,
      getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, tileSize).height,
    )
    .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.body.anchorY);
  const handDisplay = getHandDisplaySize(tileSize);
  const rightHand = scene.add
    .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
    .setDisplaySize(handDisplay.width, handDisplay.height)
    .setOrigin(0.5);
  const leftHand = scene.add
    .image(0, 0, PLAYER_HANDS_TEXTURE_KEY, PLAYER_HANDS_DEFAULT_FRAME)
    .setDisplaySize(handDisplay.width, handDisplay.height)
    .setOrigin(0.5);
  const swingTrail = scene.add.graphics().setVisible(false);
  const weaponItem = scene.add
    .image(10, 2, EQUIPMENT_ITEMS.wood_staff.textureKey)
    .setDisplaySize(tileSize, tileSize)
    .setOrigin(0.5)
    .setVisible(false);
  const castItem = scene.add
    .image(10, 2, EQUIPMENT_ITEMS.teleport_scroll.textureKey)
    .setDisplaySize(tileSize, tileSize)
    .setOrigin(0.5)
    .setVisible(false);
  const burnEffect = scene.add
    .image(0, -3, 'effect-fire-sheet', 0)
    .setDisplaySize(tileSize, tileSize)
    .setOrigin(0.5)
    .setScale(1.75)
    .setAlpha(0.9)
    .setVisible(false);
  const stormAura = scene.add.graphics().setVisible(false);
  const voidFractureAura = scene.add.graphics().setVisible(false);
  const head = scene.add
    .image(0, 0, PLAYER_HEAD_TEXTURE_KEY, PLAYER_HEAD_DEFAULT_FRAME)
    .setDisplaySize(
      getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, tileSize).width,
      getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, tileSize).height,
    )
    .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.head.anchorY);
  const eyePixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
  const leftEye = scene.add
    .rectangle(0, 0, eyePixelSize, eyePixelSize, PLAYER_EYE_COLOR, 1)
    .setOrigin(0.5);
  const rightEye = scene.add
    .rectangle(0, 0, eyePixelSize, eyePixelSize, PLAYER_EYE_COLOR, 1)
    .setOrigin(0.5);
  const rightHandPosition = getHandLocalPosition(
    PLAYER_HAND_BASE_OFFSETS.right,
    { x: 0, y: 0 },
    tileSize,
  );
  const leftHandPosition = getHandLocalPosition(
    PLAYER_HAND_BASE_OFFSETS.left,
    { x: 0, y: 0 },
    tileSize,
  );
  const initialWeaponItem = equipment.weapon ? EQUIPMENT_ITEMS[equipment.weapon] : undefined;
  const initialWeaponHandPosition = getEquippedItemHandPosition(
    initialWeaponItem,
    leftHandPosition,
    rightHandPosition,
  );
  rightHand.setPosition(rightHandPosition.x, rightHandPosition.y);
  leftHand.setPosition(leftHandPosition.x, leftHandPosition.y);
  weaponItem
    .setOrigin(initialWeaponItem?.equippedOriginX ?? 0.5, initialWeaponItem?.equippedOriginY ?? 0.5)
    .setPosition(
      initialWeaponHandPosition.x + (initialWeaponItem?.equippedOffsetX ?? 0),
      initialWeaponHandPosition.y + (initialWeaponItem?.equippedOffsetY ?? 0),
    );
  castItem.setPosition(leftHandPosition.x, leftHandPosition.y);

  container.add(leftHand);
  container.add(body);
  container.add(swingTrail);
  container.add(weaponItem);
  container.add(rightHand);
  container.add(head);
  container.add(leftEye);
  container.add(rightEye);
  container.add(castItem);
  container.add(burnEffect);
  container.add(stormAura);
  container.add(voidFractureAura);

  const nameplate = scene.add
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
  const burnStatusBack = scene.add
    .rectangle(x, y - 34, 16, 16, 0x5a1f0f, 0.92)
    .setOrigin(0.5)
    .setDepth(8.1)
    .setVisible(false);
  const burnStatusOverlay = scene.add
    .rectangle(x, y - 42, 16, 16, 0x060606, 0.58)
    .setOrigin(0.5, 0)
    .setDepth(8.24)
    .setVisible(false);
  const burnStatusIcon = scene.add
    .image(x, y - 34, 'effect-fire-sheet', 0)
    .setDisplaySize(12, 12)
    .setOrigin(0.5)
    .setDepth(8.2)
    .setVisible(false);
  const burnStatusTimer = scene.add
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
  const healingStatusBack = scene.add
    .rectangle(x, y - 34, 16, 16, 0x12350f, 0.92)
    .setOrigin(0.5)
    .setDepth(8.1)
    .setVisible(false);
  const healingStatusOverlay = scene.add
    .rectangle(x, y - 42, 16, 16, 0x060606, 0.58)
    .setOrigin(0.5, 0)
    .setDepth(8.24)
    .setVisible(false);
  const healingStatusIcon = scene.add
    .image(x, y - 34, EQUIPMENT_ITEMS.healing_potion.textureKey)
    .setDisplaySize(12, 12)
    .setOrigin(0.5)
    .setTint(0xc7ffb0)
    .setDepth(8.2)
    .setVisible(false);
  const healingStatusTimer = scene.add
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
  const healthBarFrame = scene.add
    .rectangle(x, y + 22, 30, 10, 0x101010, 1)
    .setOrigin(0.5)
    .setDepth(5);
  const healthBarBack = scene.add
    .rectangle(x, y + 22, 24, 4, 0x2a140f, 1)
    .setOrigin(0.5)
    .setDepth(6);
  const healthBarFill = scene.add
    .rectangle(x - 12, y + 22, 24, 4, 0xef4444, 1)
    .setOrigin(0, 0.5)
    .setDepth(6.2)
    .setVisible(false);
  const castBarFrame = scene.add
    .rectangle(x, y + 30, 30, 8, 0x101010, 0.95)
    .setOrigin(0.5)
    .setDepth(5)
    .setVisible(false);
  const castBarBack = scene.add
    .rectangle(x, y + 30, 24, 3, 0x1d220f, 0.95)
    .setOrigin(0.5)
    .setDepth(6)
    .setVisible(false);
  const castBarFill = scene.add
    .rectangle(x - 12, y + 30, 24, 3, 0xf4c96b, 1)
    .setOrigin(0, 0.5)
    .setDepth(6.2)
    .setVisible(false);
  const healthSegments = Array.from({ length: MAX_HEALTH_BAR_SEGMENTS }, () =>
    scene.add
      .rectangle(x, y + 22, 2, 4, 0xef4444, 1)
      .setOrigin(0.5)
      .setDepth(7),
  );
  const healthText = scene.add
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

  const character: CharacterVisual = {
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
    swingTrail,
    stormAura,
    voidFractureAura,
    swingTrailPoints: [],
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
    currentHealthSegmentCount: 1,
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
    animationStartedAt: scene.time.now,
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
    currentStormIncarnateEndsAt: 0,
    currentCastingSkillId: '',
    currentCastStartedAt: 0,
    currentCastEndsAt: 0,
    deathStartedAt: 0,
    interpPrevX: x,
    interpPrevY: y,
    interpPrevAt: scene.time.now,
    interpNextX: x,
    interpNextY: y,
    interpNextAt: scene.time.now,
    simPrevX: x,
    simPrevY: y,
    simX: x,
    simY: y,
    simErrorX: 0,
    simErrorY: 0,
    idleGraceUntil: 0,
    isDead: false,
  };

  applyCharacterHealthToVisual(character, health, maxHealth);
  applyBurningToCharacterVisual(character, 0, 0);
  applyHealingToCharacterVisual(character, 0, 0);
  applyEquipmentToVisual(scene, tileSize, character, equipment);
  return character;
}

type MobRenderState = {
  textureKey: string;
  frame: number | undefined;
  renderScale: number;
  anchorY: number;
};

export function createMobVisual(
  scene: Phaser.Scene,
  resolveMobRenderState: (texture: string, timeMs: number) => MobRenderState,
  x: number,
  y: number,
  texture: string,
  name: string,
  health: number,
  maxHealth: number,
): MobVisual {
  const initialRender = resolveMobRenderState(texture, scene.time.now);
  const renderScale = initialRender.renderScale;
  const burnScale = Math.max(1, renderScale * 0.18);
  const shadow = scene.add.ellipse(x, y + 15, 24, 8, 0x000000, 0.18).setDepth(1);
  const burnAura = scene.add
    .ellipse(x, y + 6, 24 * renderScale, 30 * renderScale, 0xff8f2a, 0.24)
    .setDepth(1.5)
    .setVisible(false);
  const sprite = scene.add
    .image(x, y, initialRender.textureKey, initialRender.frame)
    .setScale(renderScale)
    .setOrigin(0.5, initialRender.anchorY)
    .setDepth(2);
  const deathEffect = scene.add
    .image(x, y, SHARED_DEATH_ANIMATION.textureKey, SHARED_DEATH_ANIMATION.startFrame)
    .setScale(renderScale)
    .setOrigin(0.5)
    .setDepth(2.05)
    .setVisible(false);
  const burnEffect = scene.add
    .image(x, y - 3, 'effect-fire-sheet', 0)
    .setScale(burnScale)
    .setOrigin(0.5)
    .setAlpha(0.55)
    .setVisible(false)
    .setDepth(1.75);
  const burnStatusBack = scene.add
    .rectangle(x, y - 30, 16, 16, 0x5a1f0f, 0.92)
    .setOrigin(0.5)
    .setDepth(8.1)
    .setVisible(false);
  const burnStatusOverlay = scene.add
    .rectangle(x, y - 38, 16, 16, 0x060606, 0.58)
    .setOrigin(0.5, 0)
    .setDepth(8.24)
    .setVisible(false);
  const burnStatusIcon = scene.add
    .image(x, y - 30, 'effect-fire-sheet', 0)
    .setDisplaySize(12, 12)
    .setOrigin(0.5)
    .setDepth(8.2)
    .setVisible(false);
  const burnStatusTimer = scene.add
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
  const nameplate = scene.add
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
  const healthBarFrame = scene.add
    .rectangle(x, y + 22, 30, 10, 0x101010, 1)
    .setOrigin(0.5)
    .setDepth(5);
  const healthBarBack = scene.add
    .rectangle(x, y + 22, 24, 4, 0x2a140f, 1)
    .setOrigin(0.5)
    .setDepth(6);
  const healthBarFill = scene.add
    .rectangle(x - 12, y + 22, 24, 4, 0xef4444, 1)
    .setOrigin(0, 0.5)
    .setDepth(6.2)
    .setVisible(false);
  const castBarFrame = scene.add
    .rectangle(x, y + 30, 30, 8, 0x101010, 0.95)
    .setOrigin(0.5)
    .setDepth(5)
    .setVisible(false);
  const castBarBack = scene.add
    .rectangle(x, y + 30, 24, 3, 0x1d220f, 0.95)
    .setOrigin(0.5)
    .setDepth(6)
    .setVisible(false);
  const castBarFill = scene.add
    .rectangle(x - 12, y + 30, 24, 3, 0xf4c96b, 1)
    .setOrigin(0, 0.5)
    .setDepth(6.2)
    .setVisible(false);
  const healthSegments = Array.from({ length: MAX_HEALTH_BAR_SEGMENTS }, () =>
    scene.add
      .rectangle(x, y + 22, 2, 4, 0xef4444, 1)
      .setOrigin(0.5)
      .setDepth(7),
  );
  const healthText = scene.add
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

  const mob: MobVisual = {
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
    currentHealthSegmentCount: 1,
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
    currentCastingSkillId: '',
    currentCastStartedAt: 0,
    currentCastEndsAt: 0,
    currentSkillLungeStartedAt: 0,
    currentSkillLungeEndsAt: 0,
    lastMovedAt: 0,
    currentAnimationState: 'idle' as MobAnimationState,
    animationStartedAt: scene.time.now,
    deathStartedAt: 0,
    isDead: false,
  };

  applyMobHealthToVisual(mob, health, maxHealth);
  applyBurningToMobVisual(mob, 0, 0);
  return mob;
}

export function destroyCharacterVisual(
  sessionId: string,
  characters: Map<string, CharacterVisual>,
  onLocalPlayerDestroyed?: () => void,
): void {
  const character = characters.get(sessionId);
  if (!character) return;

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
  onLocalPlayerDestroyed?.();
}

export function destroyMobVisual(
  mobId: string,
  mobs: Map<string, MobVisual>,
): void {
  const mob = mobs.get(mobId);
  if (!mob) return;

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
}
