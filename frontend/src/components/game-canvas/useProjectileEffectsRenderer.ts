'use client';

import { useCallback } from 'react';
import type { Room } from '@colyseus/sdk';
import type { SkillEffectConfig } from '@/lib/skillEffects';
import { getSpriteSheetAnimationFrame, type SpriteSheetAnimation } from '@/lib/animations/runtime';

type RealtimeRoomState = {
  projectiles?: Map<string, {
    skillId: string;
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    lifetime: number;
  }>;
  groundEffects?: Map<string, {
    skillId: string;
    x: number;
    y: number;
  }>;
};

type RealtimeRoom = Room<RealtimeRoomState>;

type ProjectileVisual = {
  aura: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  targetX: number;
  targetY: number;
  animation: SpriteSheetAnimation;
};

type GroundEffectVisual = {
  tile: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Ellipse;
  flames: Phaser.GameObjects.Image[];
  x: number;
  y: number;
};

type ProjectileRendererParams = {
  scene: Phaser.Scene;
  Phaser: typeof import('phaser');
  room: RealtimeRoom | null;
  projectileSprites: Map<string, ProjectileVisual>;
  projectileAnimations: Record<string, SpriteSheetAnimation>;
  resolvedSkillEffects: SkillEffectConfig;
  getProjectileAnimation: (skillId: string, animations: Record<string, SpriteSheetAnimation>) => SpriteSheetAnimation;
  getProjectileDisplaySize: (skillId: string, effects: SkillEffectConfig) => number;
};

type GroundEffectRendererParams = {
  scene: Phaser.Scene;
  room: RealtimeRoom | null;
  groundEffects: Map<string, GroundEffectVisual>;
  resolvedSkillEffects: SkillEffectConfig;
  groundAnimation: SpriteSheetAnimation;
  meadowMap: { tileSize: number };
};

export function useProjectileEffectsRenderer() {
  const syncProjectilesFromRoom = useCallback((params: ProjectileRendererParams) => {
    const {
      scene,
      Phaser,
      room,
      projectileSprites,
      projectileAnimations,
      resolvedSkillEffects,
      getProjectileAnimation,
      getProjectileDisplaySize,
    } = params;

    if (!room?.state.projectiles) {
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
        const aura = scene.add
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
        const sprite = scene.add
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
  }, []);

  const syncGroundEffectsFromRoom = useCallback((params: GroundEffectRendererParams) => {
    const {
      scene,
      room,
      groundEffects,
      resolvedSkillEffects,
      groundAnimation,
      meadowMap,
    } = params;

    if (!room?.state.groundEffects) {
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
        const tile = scene.add
          .rectangle(effect.x, effect.y, meadowMap.tileSize, meadowMap.tileSize, isFireTrail ? 0xff7d1f : 0xff5e1a, isFireTrail ? 0.11 : 0.14)
          .setOrigin(0.5)
          .setDepth(0.4);
        const aura = scene.add
          .ellipse(effect.x, effect.y + 7, meadowMap.tileSize * 0.95, meadowMap.tileSize * 0.68, isFireTrail ? 0xffb347 : 0xff9f38, isFireTrail ? 0.14 : 0.18)
          .setOrigin(0.5)
          .setDepth(0.5);
        const flames = [
          { x: -8, y: -7, scale: 0.56, alpha: 0.9 },
          { x: 8, y: -7, scale: 0.56, alpha: 0.9 },
          { x: -8, y: 7, scale: 0.56, alpha: 0.86 },
          { x: 8, y: 7, scale: 0.56, alpha: 0.86 },
        ].map((offset) =>
          scene.add
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
  }, []);

  return {
    syncProjectilesFromRoom,
    syncGroundEffectsFromRoom,
  };
}
