'use client';

import {
  DEFAULT_PLAYER_VISUALS,
  type PlayerAnimationState,
} from '@mmorpg/shared/player/visuals';
import {
  WORLD_GAMEPLAY_PROFILE,
  RAID_GAMEPLAY_PROFILE,
} from '@mmorpg/shared/gameplay/profiles';
import { EQUIPMENT_ITEMS, getItemIconTintValue } from '@/lib/items/equipmentItems';
import {
  PLAYER_ANIMATIONS,
  PLAYER_HAND_ANIMATION_OFFSETS,
} from '@/components/game-canvas/playerAnimationHelpers';
import {
  getEquippedItemHandPosition,
  getEyeLocalPosition,
  getEyeLookDirection,
  getHandLocalPosition,
  getPlayerHeadOffsetY,
  getVisualPixelSize,
  syncCharacterWeaponLayering,
} from '@/components/game-canvas/renderGeometry';
import {
  getBodyAnimationForEquipment,
} from '@/components/game-canvas/playerAnimationHelpers';
import {
  getAnimationFrameAtState,
  syncAnimationState,
} from '@/lib/animations/entities';
import {
  getSpriteSheetAnimationFrame,
  getSpriteSheetAnimationFrameOffset,
} from '@/lib/animations/runtime';
import {
  getHeldCastConsumableItemId,
  getHeldTargetingConsumableItemId,
} from '@/components/game-canvas/statusEffectHelpers';
import { toConsumableItemId } from '@/components/game-canvas/gameCanvasHelpers';
import type { CharacterVisual } from '@/components/game-canvas/gameCanvasVisualTypes';

const WOOD_STAFF_ITEM_ID = 'wood_staff' as const;
const PLAYER_HAND_BASE_OFFSETS = {
  right: { x: 1, y: 11 },
  left: { x: 11, y: 11 },
};

type ActiveTargetingLike =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;

export function updateCharacterPose(
  tileSize: number,
  sessionId: string,
  character: CharacterVisual,
  isMoving: boolean,
  deltaSeconds: number,
  now: number,
  isLocalPlayer: boolean,
  activeSkillTargeting: ActiveTargetingLike,
  isRaidScene: boolean,
  lookTargetY?: number,
  swingTarget?: { x: number; y: number },
): void {
  character.motionPhase += deltaSeconds * (isMoving ? 12 : 4);
  character.effectPhase += deltaSeconds * 4;
  const castNow = Date.now();

  const nextAnimationState: PlayerAnimationState = isMoving ? 'move' : 'idle';
  syncAnimationState(character, nextAnimationState, now);

  const bodyAnimation =
    getBodyAnimationForEquipment(character.currentBodyItem, character.currentAnimationState) ??
    PLAYER_ANIMATIONS[character.currentAnimationState] ??
    PLAYER_ANIMATIONS.idle;
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
  const weaponItemDefinition = character.currentWeaponItem
    ? EQUIPMENT_ITEMS[character.currentWeaponItem]
    : undefined;
  const holdingHand = weaponItemDefinition?.equippedAnchorHand === 'right' ? 'right' : 'left';
  let swingOffsetX = 0;
  let swingOffsetY = 0;
  let swingAngleDeg = 0;
  let handAimAngleDeg = 0;
  let swingAimAngleRad = character.facingX < 0 ? Math.PI : 0;
  let isSwinging = false;
  let swingProgress = 0;
  let swingTrailStart = 0;
  let swingTrailEnd = 1;
  let swingTrailRadius = 0;
  let swingTrailLineWidth = 18;
  let swingTrailCoreWidth = 8;
  let isSlamSwing = false;
  let swingTrailOuterColor = 0xffe6b5;
  let swingTrailCoreColor = 0xffd089;
  if (swingTarget) {
    const dx = swingTarget.x - character.container.x;
    const dy = swingTarget.y - character.container.y;
    const length = Math.hypot(dx, dy);
    if (length > 0.001) {
      handAimAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      swingAimAngleRad = Math.atan2(dy, dx);
      if (character.facingX < 0) {
        handAimAngleDeg = 180 - handAimAngleDeg;
      }
    }
  }
  if (
    (character.currentCastingSkillId === 'woodStaffStrike' || character.currentCastingSkillId === 'woodStaffChainStrike') &&
    character.currentWeaponItem === WOOD_STAFF_ITEM_ID &&
    character.currentCastEndsAt > character.currentCastStartedAt
  ) {
    isSwinging = true;
    const swingDuration = Math.max(1, character.currentCastEndsAt - character.currentCastStartedAt);
    swingProgress = Phaser.Math.Clamp(
      (castNow - character.currentCastStartedAt) / swingDuration,
      0,
      1,
    );
    const windupCutoff = 0.25;
    const strikeCutoff = 0.6;
    swingTrailStart = windupCutoff;
    swingTrailEnd = strikeCutoff;
    swingTrailRadius = 0;
    const windupDist = 12;
    const strikeDist = 32;
    const windupLift = 26;
    const strikeDrop = 1;
    const strikeDistUpY = 40;
    const strikeDistDownY = 22;
    const windupAngleOffset = -70;
    const coneHalfAngle = 45;
    const strikeImpactAngleBoost = 24;
    const staffTiltDeg = -8;
    const handConeHalfAngle = 22;
    const handImpactAngleBoost = 6;
    const handWindupAngleOffset = -35;
    let dirX = 1;
    let dirY = 0;
    if (swingTarget) {
      const dx = swingTarget.x - character.container.x;
      const dy = swingTarget.y - character.container.y;
      const length = Math.hypot(dx, dy);
      if (length > 0.001) {
        dirX = (dx / length) * character.facingX;
        dirY = dy / length;
      }
    }
    const aimAngleRad = Math.atan2(dirY, dirX);
    const aimAngleDeg = aimAngleRad * (180 / Math.PI);
    const strikeDistY =
      dirY < -0.1
        ? strikeDistUpY
        : dirY > 0.1
          ? strikeDistDownY
          : strikeDist;

    if (swingProgress < windupCutoff) {
      const t = Math.sin((swingProgress / windupCutoff) * Math.PI * 0.5);
      const handAngleRad =
        aimAngleRad + (handWindupAngleOffset * (Math.PI / 180)) * t;
      const handRadius = Phaser.Math.Linear(0, windupDist, t);
      swingOffsetX = Math.cos(handAngleRad) * handRadius;
      swingOffsetY = Math.sin(handAngleRad) * handRadius - windupLift * t;
      swingAngleDeg = aimAngleDeg + windupAngleOffset * t + staffTiltDeg;
    } else if (swingProgress < strikeCutoff) {
      const t = Math.sin(((swingProgress - windupCutoff) / (strikeCutoff - windupCutoff)) * Math.PI * 0.5);
      const forwardBlend = 1 - Math.min(1, Math.abs(dirY) / 0.35);
      const handConeSpan = Phaser.Math.Linear(handConeHalfAngle * 0.5, handConeHalfAngle, 1 - forwardBlend);
      const handAngleRad = aimAngleRad + Phaser.Math.Linear(-handConeSpan, handConeSpan, t) * (Math.PI / 180);
      const handRadius = Phaser.Math.Linear(windupDist, strikeDistY, t);
      swingOffsetX = Math.cos(handAngleRad) * handRadius;
      swingOffsetY = Math.sin(handAngleRad) * handRadius + strikeDrop;
      swingAngleDeg = Phaser.Math.Linear(
        aimAngleDeg + windupAngleOffset,
        aimAngleDeg + coneHalfAngle + strikeImpactAngleBoost,
        t,
      ) + staffTiltDeg;
    } else {
      const t = Math.sin(((swingProgress - strikeCutoff) / (1 - strikeCutoff)) * Math.PI * 0.5);
      const handAngleRad =
        aimAngleRad +
        Phaser.Math.Linear(handConeHalfAngle + handImpactAngleBoost, 0, t) * (Math.PI / 180);
      const handRadius = Phaser.Math.Linear(strikeDistY, 0, t);
      swingOffsetX = Math.cos(handAngleRad) * handRadius;
      swingOffsetY = Math.sin(handAngleRad) * handRadius + Phaser.Math.Linear(strikeDrop, 0, t);
      swingAngleDeg = Phaser.Math.Linear(
        aimAngleDeg + coneHalfAngle + strikeImpactAngleBoost,
        aimAngleDeg,
        t,
      ) + staffTiltDeg;
    }
  } else if (
    character.currentCastingSkillId === 'woodStaffSlam' &&
    character.currentWeaponItem === WOOD_STAFF_ITEM_ID &&
    character.currentCastEndsAt > character.currentCastStartedAt
  ) {
    isSwinging = true;
    isSlamSwing = true;
    const swingDuration = Math.max(1, character.currentCastEndsAt - character.currentCastStartedAt);
    swingProgress = Phaser.Math.Clamp(
      (castNow - character.currentCastStartedAt) / swingDuration,
      0,
      1,
    );
    const windupCutoff = 0.18;
    const strikeCutoff = 0.88;
    swingTrailStart = 0.12;
    swingTrailEnd = 0.94;
    swingTrailLineWidth = 22;
    swingTrailCoreWidth = 10;
    const profile = isRaidScene ? RAID_GAMEPLAY_PROFILE : WORLD_GAMEPLAY_PROFILE;
    swingTrailRadius = Math.max(12, profile.tileSize * profile.woodStaffSlamRadiusTiles);
    const baseAimAngleRad = character.facingX < 0 ? Math.PI : 0;
    swingAimAngleRad = baseAimAngleRad;
    handAimAngleDeg = character.facingX < 0 ? 180 : 0;
    const aimAngleDeg = baseAimAngleRad * (180 / Math.PI);
    const windupAngleDeg = -120;
    const fullSweepDeg = 300;
    const handRadius = 26;
    const outerRadius = 44;
    const windupLift = 18;
    const staffTiltDeg = -10;

    if (swingProgress < windupCutoff) {
      const t = Math.sin((swingProgress / windupCutoff) * Math.PI * 0.5);
      const handAngleRad = baseAimAngleRad + (windupAngleDeg * (Math.PI / 180)) * t;
      const radius = Phaser.Math.Linear(0, handRadius, t);
      swingOffsetX = Math.cos(handAngleRad) * radius;
      swingOffsetY = Math.sin(handAngleRad) * radius - windupLift * t;
      swingAngleDeg = aimAngleDeg + windupAngleDeg * t + staffTiltDeg;
    } else if (swingProgress < strikeCutoff) {
      const t = Math.sin(((swingProgress - windupCutoff) / (strikeCutoff - windupCutoff)) * Math.PI * 0.5);
      const sweepAngleDeg = Phaser.Math.Linear(windupAngleDeg, windupAngleDeg + fullSweepDeg, t);
      const handAngleRad = baseAimAngleRad + sweepAngleDeg * (Math.PI / 180);
      const radius = Phaser.Math.Linear(handRadius, outerRadius, Math.sin(t * Math.PI * 0.5));
      swingOffsetX = Math.cos(handAngleRad) * radius;
      swingOffsetY = Math.sin(handAngleRad) * radius;
      swingAngleDeg = aimAngleDeg + sweepAngleDeg + 12 + staffTiltDeg;
    } else {
      const t = Math.sin(((swingProgress - strikeCutoff) / (1 - strikeCutoff)) * Math.PI * 0.5);
      const handAngleRad = baseAimAngleRad + (windupAngleDeg + fullSweepDeg) * (Math.PI / 180);
      const radius = Phaser.Math.Linear(outerRadius, 0, t);
      swingOffsetX = Math.cos(handAngleRad) * radius;
      swingOffsetY = Phaser.Math.Linear(Math.sin(handAngleRad) * radius, 0, t);
      handAimAngleDeg = Phaser.Math.Linear(character.facingX < 0 ? 180 : 0, 0, t);
      swingAngleDeg = Phaser.Math.Linear(
        aimAngleDeg + windupAngleDeg + fullSweepDeg + 12,
        0,
        t,
      );
    }
  }

  if (holdingHand === 'left') {
    character.leftHand.x = leftHandPosition.x + swingOffsetX;
    character.leftHand.y = leftHandPosition.y + swingOffsetY;
    character.leftHand.setAngle(handAimAngleDeg);
    character.rightHand.setAngle(0);
    character.rightHand.x = rightHandPosition.x;
    character.rightHand.y = rightHandPosition.y;
  } else {
    character.rightHand.x = rightHandPosition.x + swingOffsetX;
    character.rightHand.y = rightHandPosition.y + swingOffsetY;
    character.rightHand.setAngle(handAimAngleDeg);
    character.leftHand.setAngle(0);
    character.leftHand.x = leftHandPosition.x;
    character.leftHand.y = leftHandPosition.y;
  }

  const bodyPixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
  const headAnimationOffsetY = getPlayerHeadOffsetY(
    bodyAnimation,
    character.animationStartedAt,
    now,
    bodyPixelSize,
  );
  const eyeDirection = getEyeLookDirection(lookTargetY, character.container.y);
  const leftEyePosition = getEyeLocalPosition(eyeDirection, 'left', tileSize);
  const rightEyePosition = getEyeLocalPosition(eyeDirection, 'right', tileSize);
  const weaponBob = isMoving ? Math.cos(character.motionPhase * 2) * 0.4 : 0;
  const weaponHandPosition = getEquippedItemHandPosition(
    weaponItemDefinition,
    { x: character.leftHand.x, y: character.leftHand.y },
    { x: character.rightHand.x, y: character.rightHand.y },
  );
  const heldCastItemId = isLocalPlayer
    ? getHeldTargetingConsumableItemId(activeSkillTargeting) ??
      getHeldCastConsumableItemId(character, (itemId) => toConsumableItemId(itemId ?? undefined))
    : getHeldCastConsumableItemId(character, (itemId) => toConsumableItemId(itemId ?? undefined));
  const heldCastItem = heldCastItemId ? EQUIPMENT_ITEMS[heldCastItemId] : undefined;
  const heldCastItemTint = getItemIconTintValue(heldCastItemId);
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
      if (heldCastItemTint !== null) {
        character.castItem.setTint(heldCastItemTint);
      } else {
        character.castItem.clearTint();
      }
    } else {
      character.castItem.setVisible(false);
      character.castItem.setAngle(0);
      character.castItem.setScale(1);
      character.castItem.clearTint();
    }

    character.currentCastItemId = heldCastItemId;
  }

  character.body.x = DEFAULT_PLAYER_VISUALS.body.offsetX;
  character.body.y = DEFAULT_PLAYER_VISUALS.body.offsetY;
  character.weaponItem.x = weaponHandPosition.x + character.currentWeaponOffsetX;
  character.weaponItem.y = weaponHandPosition.y + character.currentWeaponOffsetY;
  character.weaponItem.setAngle((weaponItemDefinition?.worldRotationDeg ?? 0) + swingAngleDeg);
  character.weaponItem.setVisible(showWeapon);
  syncCharacterWeaponLayering(character, weaponItemDefinition, showWeapon);

  const trailPoints = character.swingTrailPoints;
  const swingTrail = character.swingTrail;
  const stormAura = character.stormAura;
  const voidFractureAura = character.voidFractureAura;
  if (!showWeapon) {
    trailPoints.length = 0;
    swingTrail.clear();
    swingTrail.setVisible(false);
  } else {
    if (isSwinging && swingProgress >= swingTrailStart && swingProgress <= swingTrailEnd) {
      const profile = isRaidScene ? RAID_GAMEPLAY_PROFILE : WORLD_GAMEPLAY_PROFILE;
      const originX = 0;
      const originY = -profile.playerHitRadius + profile.meleeStrikeOriginOffsetY;
      const trailAimAngle =
        character.facingX < 0 ? Math.PI - swingAimAngleRad : swingAimAngleRad;
      const startAngle = trailAimAngle - profile.meleeStrikeArcHalfAngleRad;
      const endAngle = trailAimAngle + profile.meleeStrikeArcHalfAngleRad;
      const phaseT = Phaser.Math.Clamp(
        (swingProgress - swingTrailStart) / Math.max(0.001, swingTrailEnd - swingTrailStart),
        0,
        1,
      );
      const fade = Math.sin(phaseT * Math.PI);
      const sweepAngle = isSlamSwing
        ? Phaser.Math.Linear(
            trailAimAngle - Math.PI * 0.9,
            trailAimAngle + Math.PI * 0.9,
            phaseT,
          )
        : Phaser.Math.Linear(startAngle, endAngle, phaseT);

      trailPoints.length = 0;
      swingTrail.clear();
      swingTrail.setVisible(true);
      const radius = isSlamSwing
        ? swingTrailRadius
        : Math.max(8, profile.meleeStrikeRange);
      const tipX = originX + Math.cos(sweepAngle) * radius;
      const tipY = originY + Math.sin(sweepAngle) * radius;
      swingTrail.lineStyle(swingTrailLineWidth, swingTrailOuterColor, 0.55 * fade);
      swingTrail.beginPath();
      swingTrail.moveTo(originX, originY);
      swingTrail.lineTo(tipX, tipY);
      swingTrail.strokePath();
      swingTrail.lineStyle(swingTrailCoreWidth, swingTrailCoreColor, 0.7 * fade);
      swingTrail.beginPath();
      swingTrail.moveTo(originX, originY);
      swingTrail.lineTo(tipX, tipY);
      swingTrail.strokePath();
    } else {
      trailPoints.length = 0;
      swingTrail.clear();
      swingTrail.setVisible(false);
    }
  }
  if (character.currentStormIncarnateEndsAt > castNow) {
    const remainingMs = Math.max(0, character.currentStormIncarnateEndsAt - castNow);
    const normalized = Phaser.Math.Clamp(remainingMs / 5000, 0.2, 1);
    const profile = isRaidScene ? RAID_GAMEPLAY_PROFILE : WORLD_GAMEPLAY_PROFILE;
    const radius = profile.tileSize * profile.woodStaffStormIncarnateAutoRangeTiles;
    const pulseRadius = radius * (0.95 + 0.04 * Math.sin(character.effectPhase * 2.1));
    const outerRadius = pulseRadius * 1.02;
    const innerRadius = pulseRadius * 0.72;
    const eyeRadius = tileSize * 0.92;
    const swirlOffset = character.effectPhase * 1.7;
    const centerY = 0;
    stormAura.clear();
    stormAura.setVisible(true);
    stormAura.fillStyle(0xb89963, 0.05 * normalized);
    stormAura.fillCircle(0, centerY, outerRadius * 1.04);
    stormAura.fillStyle(0xe6d7b7, 0.025 * normalized);
    stormAura.fillCircle(0, centerY, eyeRadius * 1.08);

    stormAura.lineStyle(18, 0xf6e7c6, 0.12 * normalized);
    stormAura.strokeCircle(0, centerY, outerRadius);
    stormAura.lineStyle(10, 0xc7ab74, 0.2 * normalized);
    stormAura.strokeCircle(0, centerY, innerRadius);
    stormAura.lineStyle(6, 0xffffff, 0.09 * normalized);
    stormAura.strokeCircle(0, centerY, eyeRadius);

    for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
      const ringRadius = pulseRadius * (0.42 + ringIndex * 0.19 + Math.sin(character.effectPhase * 2.4 + ringIndex) * 0.02);
      stormAura.lineStyle(
        4 + (2 - ringIndex) * 2,
        ringIndex === 0 ? 0xf2dfb5 : ringIndex === 1 ? 0xd7c197 : 0xa98c5a,
        (0.12 - ringIndex * 0.02) * normalized,
      );
      stormAura.beginPath();
      stormAura.arc(0, centerY, ringRadius, swirlOffset * (1.1 + ringIndex * 0.22), swirlOffset * (1.1 + ringIndex * 0.22) + Math.PI * 1.32, false);
      stormAura.strokePath();
      stormAura.beginPath();
      stormAura.arc(0, centerY, ringRadius * 0.92, -swirlOffset * (0.85 + ringIndex * 0.18), -swirlOffset * (0.85 + ringIndex * 0.18) + Math.PI * 0.88, false);
      stormAura.strokePath();
    }

    for (let index = 0; index < 14; index += 1) {
      const angle = swirlOffset * 1.25 + index * ((Math.PI * 2) / 14);
      const startRadius = pulseRadius * (0.2 + (index % 3) * 0.08);
      const midRadius = pulseRadius * (0.56 + (index % 2) * 0.08);
      const endRadius = pulseRadius * (0.9 + (index % 4) * 0.02);
      const bend = angle + (index % 2 === 0 ? 0.24 : -0.2);
      const startX = Math.cos(angle) * startRadius;
      const startY = centerY + Math.sin(angle) * startRadius;
      const midX = Math.cos(bend) * midRadius;
      const midY = centerY + Math.sin(bend) * midRadius;
      const endX = Math.cos(angle + 0.14) * endRadius;
      const endY = centerY + Math.sin(angle + 0.14) * endRadius;

      stormAura.lineStyle(index % 3 === 0 ? 5 : 3, 0xe8d3aa, (0.08 + index * 0.006) * normalized);
      stormAura.beginPath();
      stormAura.moveTo(startX, startY);
      stormAura.lineTo(midX, midY);
      stormAura.lineTo(endX, endY);
      stormAura.strokePath();
    }

    for (let index = 0; index < 6; index += 1) {
      const angle = -swirlOffset * 0.86 + index * ((Math.PI * 2) / 6);
      const boltStartRadius = pulseRadius * (0.74 + (index % 2) * 0.08);
      const boltMidRadius = pulseRadius * (0.48 + (index % 3) * 0.05);
      const startX = Math.cos(angle) * boltStartRadius;
      const startY = centerY + Math.sin(angle) * boltStartRadius;
      const midX = Math.cos(angle + 0.18) * boltMidRadius;
      const midY = centerY + Math.sin(angle + 0.18) * boltMidRadius;
      const endX = Math.cos(angle - 0.08) * eyeRadius * 0.8;
      const endY = centerY + Math.sin(angle - 0.08) * eyeRadius * 0.8;

      stormAura.lineStyle(index % 2 === 0 ? 4 : 3, 0xfff7e2, (0.12 + Math.sin(character.effectPhase * 6 + index) * 0.025) * normalized);
      stormAura.beginPath();
      stormAura.moveTo(startX, startY);
      stormAura.lineTo(midX, midY);
      stormAura.lineTo(endX, endY);
      stormAura.strokePath();
    }

    for (let index = 0; index < 8; index += 1) {
      const angle = swirlOffset * 0.72 + index * ((Math.PI * 2) / 8);
      const gustX = Math.cos(angle) * pulseRadius * (0.78 + (index % 2) * 0.06);
      const gustY = centerY + Math.sin(angle) * pulseRadius * (0.78 + (index % 2) * 0.06);
      const gustR = tileSize * (0.12 + (index % 3) * 0.03);
      stormAura.fillStyle(0xf3e7cb, 0.045 + (index % 3) * 0.01);
      stormAura.fillCircle(gustX, gustY, gustR);
    }
  } else {
    stormAura.clear();
    stormAura.setVisible(false);
  }
  if (
    character.currentCastingSkillId === 'woodStaffVoidFracture' &&
    character.currentCastEndsAt > character.currentCastStartedAt &&
    character.currentCastEndsAt > castNow
  ) {
    const castDuration = Math.max(1, character.currentCastEndsAt - character.currentCastStartedAt);
    const castProgress = Phaser.Math.Clamp(
      (castNow - character.currentCastStartedAt) / castDuration,
      0,
      1,
    );
    const profile = isRaidScene ? RAID_GAMEPLAY_PROFILE : WORLD_GAMEPLAY_PROFILE;
    const fractureRadius = profile.tileSize * profile.woodStaffVoidFractureRadiusTiles;
    const pulseRadius = fractureRadius * (0.95 + Math.sin(castProgress * Math.PI) * 0.06);
    const dustAlpha = 0.18 + Math.sin(castProgress * Math.PI) * 0.16;
    const crackAlpha = 0.14 + castProgress * 0.28;
    const outerRadius = pulseRadius;
    const innerRadius = pulseRadius * 0.72;
    const phase = character.effectPhase * 1.9;

    voidFractureAura.clear();
    voidFractureAura.setVisible(true);
    voidFractureAura.fillStyle(0xc5ae7a, 0.05 + dustAlpha * 0.35);
    voidFractureAura.fillCircle(0, 0, outerRadius * 1.04);
    voidFractureAura.lineStyle(14, 0xe3cf9b, dustAlpha);
    voidFractureAura.strokeCircle(0, 0, outerRadius);
    voidFractureAura.lineStyle(8, 0xb99662, dustAlpha * 0.95);
    voidFractureAura.strokeCircle(0, 0, innerRadius);

    for (let index = 0; index < 12; index += 1) {
      const angle = phase + index * ((Math.PI * 2) / 12);
      const startRadius = innerRadius * (0.3 + (index % 2) * 0.08);
      const endRadius = pulseRadius * (0.9 + (index % 3) * 0.05);
      const branchAngle = angle + (index % 2 === 0 ? 0.2 : -0.24);
      const startX = Math.cos(angle) * startRadius;
      const startY = Math.sin(angle) * startRadius;
      const midX = Math.cos(angle) * (pulseRadius * 0.58);
      const midY = Math.sin(angle) * (pulseRadius * 0.58);
      const endX = Math.cos(angle) * endRadius;
      const endY = Math.sin(angle) * endRadius;
      const branchX = midX + Math.cos(branchAngle) * pulseRadius * 0.2;
      const branchY = midY + Math.sin(branchAngle) * pulseRadius * 0.12;

      voidFractureAura.lineStyle(index % 2 === 0 ? 4 : 3, 0x6e5331, crackAlpha);
      voidFractureAura.beginPath();
      voidFractureAura.moveTo(startX, startY);
      voidFractureAura.lineTo(midX, midY);
      voidFractureAura.lineTo(endX, endY);
      voidFractureAura.strokePath();

      voidFractureAura.lineStyle(2, 0x8d6d42, crackAlpha * 0.7);
      voidFractureAura.beginPath();
      voidFractureAura.moveTo(midX, midY);
      voidFractureAura.lineTo(branchX, branchY);
      voidFractureAura.strokePath();
    }

    for (let index = 0; index < 10; index += 1) {
      const angle = -phase * 0.7 + index * ((Math.PI * 2) / 10);
      const puffX = Math.cos(angle) * pulseRadius * (0.68 + (index % 2) * 0.08);
      const puffY = Math.sin(angle) * pulseRadius * (0.68 + (index % 2) * 0.08);
      const puffRadius = tileSize * (0.16 + (index % 3) * 0.04);
      voidFractureAura.fillStyle(0xd8c08f, 0.06 + dustAlpha * 0.4);
      voidFractureAura.fillCircle(puffX, puffY, puffRadius);
    }
  } else {
    voidFractureAura.clear();
    voidFractureAura.setVisible(false);
  }
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
    character.leftHand.clearTint();
    character.rightHand.clearTint();
  }
  character.head.x = DEFAULT_PLAYER_VISUALS.head.offsetX;
  character.head.y = DEFAULT_PLAYER_VISUALS.head.offsetY + headAnimationOffsetY;
  character.leftEye.x = leftEyePosition.x;
  character.leftEye.y = leftEyePosition.y + headAnimationOffsetY;
  character.rightEye.x = rightEyePosition.x;
  character.rightEye.y = rightEyePosition.y + headAnimationOffsetY;
  character.shadow.width = 22;
}
