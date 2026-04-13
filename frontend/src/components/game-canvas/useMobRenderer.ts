'use client';

import { useCallback } from 'react';
import type { Room } from '@colyseus/sdk';

type RealtimeRoomState = {
  mobs?: Map<string, {
    id: string;
    name: string;
    texture: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    burnTicksRemaining?: number;
    burnEndsAt?: number;
    dead?: boolean;
    attackCooldownMs?: number;
    attackCooldownEndsAt?: number;
    castingSkillId?: string;
    castStartedAt?: number;
    castEndsAt?: number;
    skillLungeStartedAt?: number;
    skillLungeEndsAt?: number;
  }>;
};

type RealtimeRoom = Room<RealtimeRoomState>;

type StatusIconVisual = {
  back: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  timerText: Phaser.GameObjects.Text;
};

type MobVisual = {
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  deathEffect: Phaser.GameObjects.Image;
  nameplate: Phaser.GameObjects.Text;
  healthBarFrame: Phaser.GameObjects.Rectangle;
  healthBarBack: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  castBarFrame: Phaser.GameObjects.Rectangle;
  castBarBack: Phaser.GameObjects.Rectangle;
  castBarFill: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  healthSegments: Phaser.GameObjects.Rectangle[];
  burnAura: Phaser.GameObjects.Ellipse;
  burnStatusIcon: StatusIconVisual;
  targetX: number;
  targetY: number;
  lastX: number;
  currentName: string;
  currentHealth: number;
  currentMaxHealth: number;
  currentBurnTicksRemaining: number;
  currentBurnEndsAt: number;
  currentAttackCooldownEndsAt: number;
  currentAttackCooldownMs: number;
  currentCastingSkillId: string;
  currentCastStartedAt: number;
  currentCastEndsAt: number;
  currentSkillLungeStartedAt: number;
  currentSkillLungeEndsAt: number;
  lastMovedAt: number;
  isDead: boolean;
  isVisible?: boolean;
};

type UseMobRendererParams = {
  scene: Phaser.Scene;
  room: RealtimeRoom | null;
  mobs: Map<string, MobVisual>;
  completedDeadMobIds: Set<string>;
  createMob: (
    x: number,
    y: number,
    texture: string,
    name: string,
    health: number,
    maxHealth: number,
  ) => MobVisual;
  destroyMob: (mobId: string) => void;
  syncDeathState: (mob: MobVisual, dead: boolean, now: number) => void;
  applyMobHealthToVisual: (mob: MobVisual, health: number, maxHealth: number) => void;
  applyBurningToMobVisual: (mob: MobVisual, ticks: number, endsAt: number) => void;
  hideStatusIcon: (icon: StatusIconVisual) => void;
};

export function useMobRenderer() {
  const setMobVisibility = useCallback((mob: MobVisual, visible: boolean, hideStatusIcon: (icon: StatusIconVisual) => void) => {
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
  }, []);

  const syncMobsFromRoom = useCallback((params: UseMobRendererParams) => {
    const {
      scene,
      room,
      mobs,
      completedDeadMobIds,
      createMob,
      destroyMob,
      syncDeathState,
      applyMobHealthToVisual,
      applyBurningToMobVisual,
      hideStatusIcon,
    } = params;

    if (!room?.state.mobs) {
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
        mob.lastMovedAt = scene.time.now;
      }

      mob.targetX = networkMob.x;
      mob.targetY = networkMob.y;
      const wasDead = mob.isDead;
      syncDeathState(mob, networkMob.dead === true, scene.time.now);
      if (wasDead !== mob.isDead) {
        setMobVisibility(mob, mob.isVisible ?? true, hideStatusIcon);
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
  }, [setMobVisibility]);

  return {
    syncMobsFromRoom,
    setMobVisibility,
  };
}
