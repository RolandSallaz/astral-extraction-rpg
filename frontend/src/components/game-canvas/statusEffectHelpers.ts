import { EQUIPMENT_ITEMS, type ConsumableItemId } from '@/lib/items/equipmentItems';

type CharacterStatusIconLike = {
  back: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  timerText: Phaser.GameObjects.Text;
};

type CharacterBurnLike = {
  burnEffect: Phaser.GameObjects.Image;
  burnAura: Phaser.GameObjects.Ellipse;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnStartedAt: number;
  currentBurnDurationMs: number;
  container: Phaser.GameObjects.Container;
};

type CharacterHealingLike = {
  currentHealingTicksRemaining: number;
  currentHealingEndsAt: number;
  currentHealingStartedAt: number;
  currentHealingDurationMs: number;
};

type CharacterEffectDisplayLike = {
  container: Phaser.GameObjects.Container;
  burnStatusIcon: CharacterStatusIconLike;
  healingStatusIcon: CharacterStatusIconLike;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnDurationMs: number;
  currentHealingTicksRemaining: number;
  currentHealingEndsAt: number;
  currentHealingDurationMs: number;
};

type CharacterCastLike = {
  currentCastingSkillId: string;
  currentCastStartedAt: number;
  currentCastEndsAt: number;
};

type MobBurnLike = {
  burnEffect: Phaser.GameObjects.Image;
  burnAura: Phaser.GameObjects.Ellipse;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnStartedAt: number;
  currentBurnDurationMs: number;
  sprite: Phaser.GameObjects.Image;
};

type MobEffectDisplayLike = {
  sprite: Phaser.GameObjects.Image;
  burnStatusIcon: CharacterStatusIconLike;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentBurnDurationMs: number;
};

type ActiveTargetingLike =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;

export function hideStatusIcon(icon: CharacterStatusIconLike) {
  icon.back.setVisible(false);
  icon.cooldownOverlay.setVisible(false);
  icon.icon.setVisible(false);
  icon.timerText.setVisible(false);
}

export function applyBurningToCharacterVisual(
  visual: CharacterBurnLike,
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

export function applyHealingToCharacterVisual(
  visual: CharacterHealingLike,
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

export function updateCharacterEffectDisplay(
  visual: CharacterEffectDisplayLike,
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
    icon: CharacterStatusIconLike;
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
    const progress =
      effect.totalDurationMs > 0
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

export function applyCastingToCharacterVisual(
  visual: CharacterCastLike,
  castingSkillId: string,
  castStartedAt: number,
  castEndsAt: number,
) {
  visual.currentCastingSkillId = castingSkillId;
  visual.currentCastStartedAt = Math.max(0, castStartedAt);
  visual.currentCastEndsAt = Math.max(0, castEndsAt);
}

export function getHeldCastConsumableItemId(
  visual: Pick<CharacterCastLike, 'currentCastingSkillId' | 'currentCastEndsAt'>,
  toConsumableItemId: (itemId: string | null | undefined) => ConsumableItemId | undefined,
): ConsumableItemId | undefined {
  if (visual.currentCastingSkillId.length === 0 || visual.currentCastEndsAt <= Date.now()) {
    return undefined;
  }

  return toConsumableItemId(visual.currentCastingSkillId);
}

export function getHeldTargetingConsumableItemId(
  activeTargeting: ActiveTargetingLike,
): ConsumableItemId | undefined {
  if (activeTargeting?.type !== 'consumable') {
    return undefined;
  }

  return activeTargeting.itemId;
}

export function applyBurningToMobVisual(
  visual: MobBurnLike,
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

export function updateMobEffectDisplay(
  visual: MobEffectDisplayLike,
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
  const progress =
    visual.currentBurnDurationMs > 0
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
