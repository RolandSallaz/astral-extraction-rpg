'use client';

import type Phaser from 'phaser';
import { DEFAULT_PLAYER_VISUALS } from '@mmorpg/shared/player/visuals';
import type { MobAnimationState } from '@mmorpg/shared/mobs/visuals';
import type { MobKind } from '@mmorpg/shared/mobs/catalog';
import { getEquipmentBodyTexturePath } from '@mmorpg/shared/visuals/equipmentVisuals';
import type {
  MeadowMapAsset,
  MeadowMobAsset,
  MeadowTraderAsset,
} from '@/lib/maps/meadowMap';
import {
  createMeadowDecorationsFromAsset,
  createMeadowMapFromAsset,
  createMeadowMobsFromAsset,
  createMeadowStampsFromAsset,
  createMeadowTradersFromAsset,
  resolveGroundOverlaysFromAsset,
  resolveMeadowTexture,
} from '@/lib/maps/meadowMap';

type PhaserImage = Phaser.GameObjects.Image;

type PlayerSheetAnimationLike = {
  textureKey: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  startRowFrames?: number;
  frameCount: number;
  fps: number;
  columns: number;
  loop: boolean;
  headOffsetYFrames?: number[];
};

type WorldTraderVisualLike = {
  shadow: Phaser.GameObjects.Ellipse;
  container: Phaser.GameObjects.Container;
  actor?: Phaser.GameObjects.GameObject;
  body?: PhaserImage;
  bodyOverlay?: PhaserImage;
  bodyOverlayAnimation?: PlayerSheetAnimationLike;
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

type WorldMobVisualLike = {
  kind: MobKind;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  nameplate: Phaser.GameObjects.Text;
};

type WorldMapRenderState = {
  currentAsset: MeadowMapAsset;
  spawnMarker: Phaser.GameObjects.Container | null;
};

type MobRenderState = {
  textureKey: string;
  frame?: number;
  renderScale: number;
  anchorY: number;
};

type WorldMapRendererParams = {
  scene: Phaser.Scene;
  asset: MeadowMapAsset;
  state: WorldMapRenderState;
  tileSize: number;
  isAdmin: boolean;
  worldTileSprites: Phaser.GameObjects.Image[];
  worldOverlaySprites: Phaser.GameObjects.Image[];
  worldDecorationSprites: Phaser.GameObjects.Image[];
  worldStampSprites: Phaser.GameObjects.Image[];
  worldStampSpritesByTile: Map<string, Phaser.GameObjects.Image>;
  worldMobVisuals: Map<string, WorldMobVisualLike>;
  worldTraderVisuals: Map<string, WorldTraderVisualLike>;
  worldTradersById: Map<string, MeadowTraderAsset>;
  playerAnimations: Partial<Record<string, PlayerSheetAnimationLike>>;
  playerEyeColor: number;
  playerBodyTextureKey: string;
  playerBodyDefaultFrame: number;
  playerHeadTextureKey: string;
  playerHeadDefaultFrame: number;
  playerHandsTextureKey: string;
  playerHandsDefaultFrame: number;
  playerHandBaseOffsets: {
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
  ensureWorldTextureLoaded: (texturePath: string) => string;
  ensureWorldTraderBodyOverlayLoaded: (texturePath: string) => string;
  ensureWorldTraderSpriteSheetLoaded: (trader: MeadowTraderAsset) => string;
  resolveMobRenderState: (
    texture: string,
    timeMs: number,
    state?: MobAnimationState,
    animationStartedAt?: number,
  ) => MobRenderState;
  getWorldTraderAnimationKey: (traderId: string) => string;
  getWorldTraderBodyOverlayAnimation: (
    texturePath: string | undefined,
    idleAnimation?: PlayerSheetAnimationLike | null,
  ) => PlayerSheetAnimationLike | null;
  getVisualPixelSize: (
    visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'displayScale'>,
    tileSize: number,
  ) => number;
  getVisualDisplaySize: (
    visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'frameHeight' | 'displayScale'>,
    tileSize: number,
  ) => { width: number; height: number };
  getEyeLocalPosition: (
    direction: 'up' | 'down',
    side: 'left' | 'right',
    tileSize: number,
  ) => { x: number; y: number };
  getHandLocalPosition: (
    base: { x: number; y: number },
    offset: { x: number; y: number },
    tileSize: number,
  ) => { x: number; y: number };
  getHandDisplaySize: (tileSize: number) => { width: number; height: number };
};

export function renderWorldMap(params: WorldMapRendererParams) {
  const {
    scene,
    asset,
    state,
    tileSize,
    isAdmin,
    worldTileSprites,
    worldOverlaySprites,
    worldDecorationSprites,
    worldStampSprites,
    worldStampSpritesByTile,
    worldMobVisuals,
    worldTraderVisuals,
    worldTradersById,
    playerAnimations,
    playerEyeColor,
    playerBodyTextureKey,
    playerBodyDefaultFrame,
    playerHeadTextureKey,
    playerHeadDefaultFrame,
    playerHandsTextureKey,
    playerHandsDefaultFrame,
    playerHandBaseOffsets,
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
  } = params;

  state.currentAsset = asset;
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

  if (state.spawnMarker) {
    state.spawnMarker.destroy();
    state.spawnMarker = null;
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
    const shadow = scene.add
      .ellipse(worldX, worldY + 15, 24, 8, 0x000000, 0.18)
      .setDepth(1.05);
    const container = scene.add.container(worldX, worldY).setDepth(1.6);
    let actor: Phaser.GameObjects.GameObject | undefined;
    let bodyBase: PhaserImage | undefined;
    let bodyLayer: PhaserImage | undefined;
    let bodyOverlayAnimation: PlayerSheetAnimationLike | undefined;
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
      if (!sheetTextureKey || !scene.textures.exists(sheetTextureKey)) {
        shadow.destroy();
        container.destroy();
        return;
      }

      const sprite = scene.add
        .sprite(0, 0, sheetTextureKey, trader.animationStartFrame ?? 0)
        .setOrigin(0.5)
        .setScale(
          ((trader.renderScale ?? 1) * tileSize) /
            Math.max(1, trader.frameWidth ?? tileSize),
        );
      const animationKey = getWorldTraderAnimationKey(trader.id);
      if (!scene.anims.exists(animationKey)) {
        scene.anims.create({
          key: animationKey,
          frames: scene.anims.generateFrameNumbers(sheetTextureKey, {
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
      bodyOverlayAnimation =
        getWorldTraderBodyOverlayAnimation(resolvedBodyTexturePath, playerAnimations.idle) ?? undefined;
      const bodyTextureKey = resolvedBodyTexturePath
        ? bodyOverlayAnimation
          ? ensureWorldTraderBodyOverlayLoaded(resolvedBodyTexturePath)
          : ensureWorldTextureLoaded(resolvedBodyTexturePath)
        : '';
      const hairTextureKey = trader.hairTexturePath ? ensureWorldTextureLoaded(trader.hairTexturePath) : '';
      const headTextureKey = resolvedHeadTexturePath ? ensureWorldTextureLoaded(resolvedHeadTexturePath) : '';

      if (
        (bodyTextureKey && !scene.textures.exists(bodyTextureKey)) ||
        (hairTextureKey && !scene.textures.exists(hairTextureKey)) ||
        (headTextureKey && !scene.textures.exists(headTextureKey))
      ) {
        shadow.destroy();
        container.destroy();
        return;
      }

      const traderBodyAnimation = playerAnimations.idle;
      const traderEyePixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
      const traderBodyDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.body, tileSize);
      const traderHeadDisplay = getVisualDisplaySize(DEFAULT_PLAYER_VISUALS.head, tileSize);
      const handDisplay = getHandDisplaySize(tileSize);
      bodyBase = scene.add
        .image(
          0,
          0,
          traderBodyAnimation?.textureKey ?? playerBodyTextureKey,
          traderBodyAnimation ? traderBodyAnimation.startFrame : playerBodyDefaultFrame,
        )
        .setDisplaySize(traderBodyDisplay.width, traderBodyDisplay.height)
        .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.body.anchorY);
      rightHand = scene.add
        .image(0, 0, playerHandsTextureKey, playerHandsDefaultFrame)
        .setDisplaySize(handDisplay.width, handDisplay.height)
        .setOrigin(0.5);
      leftHand = scene.add
        .image(0, 0, playerHandsTextureKey, playerHandsDefaultFrame)
        .setDisplaySize(handDisplay.width, handDisplay.height)
        .setOrigin(0.5);
      if (bodyTextureKey) {
        bodyLayer = scene.add
          .image(
            0,
            0,
            bodyTextureKey,
            bodyOverlayAnimation ? bodyOverlayAnimation.startFrame : undefined,
          )
          .setDisplaySize(tileSize, tileSize)
          .setOrigin(0.5);
      }
      headBase = scene.add
        .image(0, 0, playerHeadTextureKey, playerHeadDefaultFrame)
        .setDisplaySize(traderHeadDisplay.width, traderHeadDisplay.height)
        .setOrigin(0.5, DEFAULT_PLAYER_VISUALS.head.anchorY);
      if (hairTextureKey) {
        hairLayer = scene.add
          .image(trader.hairOffsetX ?? 0, trader.hairOffsetY ?? 0, hairTextureKey)
          .setDisplaySize(tileSize, tileSize)
          .setOrigin(0.5);
      }
      if (headTextureKey) {
        headLayer = scene.add
          .image(0, 0, headTextureKey)
          .setDisplaySize(tileSize, tileSize)
          .setOrigin(0.5);
      }
      leftEye = scene.add
        .rectangle(0, 0, traderEyePixelSize, traderEyePixelSize, playerEyeColor, 1)
        .setOrigin(0.5);
      rightEye = scene.add
        .rectangle(0, 0, traderEyePixelSize, traderEyePixelSize, playerEyeColor, 1)
        .setOrigin(0.5);
      const defaultLeftEye = getEyeLocalPosition('down', 'left', tileSize);
      const defaultRightEye = getEyeLocalPosition('down', 'right', tileSize);
      leftEye.setPosition(defaultLeftEye.x, defaultLeftEye.y);
      rightEye.setPosition(defaultRightEye.x, defaultRightEye.y);
      const defaultRightHand = getHandLocalPosition(
        playerHandBaseOffsets.right,
        { x: 0, y: 0 },
        tileSize,
      );
      const defaultLeftHand = getHandLocalPosition(
        playerHandBaseOffsets.left,
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
      animationStartedAt = scene.time.now;
    }

    const nameplate = scene.add
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
    const questMarker = scene.add
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
    if (mob.kind === 'dummy') {
      return;
    }

    const renderState = resolveMobRenderState(mob.kind, scene.time.now);
    const worldX = mob.spawn.x * tileSize + tileSize / 2;
    const worldY = mob.spawn.y * tileSize + tileSize / 2;
    const shadow = scene.add
      .ellipse(worldX, worldY + 15, 22, 8, 0x000000, 0.18)
      .setDepth(1.05);
    const sprite = scene.add
      .image(worldX, worldY, renderState.textureKey, renderState.frame)
      .setScale(renderState.renderScale)
      .setOrigin(0.5, renderState.anchorY)
      .setDepth(1.6);
    const nameplate = scene.add
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
      .setVisible(isAdmin);

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

      const tileSprite = scene.add
        .image(tileX, tileY, tileRender.texture)
        .setDisplaySize(tileSize, tileSize)
        .setAngle(tileRender.rotation)
        .setOrigin(0.5)
        .setDepth(0);
      worldTileSprites.push(tileSprite);

      if (!tileStamp) {
        for (const overlay of resolveGroundOverlaysFromAsset(asset, x, y)) {
          const overlaySprite = scene.add
            .image(tileX, tileY, overlay.texture)
            .setDisplaySize(tileSize, tileSize)
            .setAngle(overlay.rotation)
            .setFlipX(overlay.flipX)
            .setOrigin(0.5);
          worldOverlaySprites.push(overlaySprite);
        }
      } else {
        const textureKey = ensureWorldTextureLoaded(tileStamp.texturePath);
        if (scene.textures.exists(textureKey)) {
          const stampSprite = scene.add
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
    const decorationSprite = scene.add
      .image(worldX, worldY, decoration.texture)
      .setDisplaySize(tileSize, tileSize)
      .setOrigin(0.5);
    worldDecorationSprites.push(decorationSprite);
  }

  const spawnWorldX = asset.spawn.x * tileSize + tileSize / 2;
  const spawnWorldY = asset.spawn.y * tileSize + tileSize / 2;
  state.spawnMarker = scene.add
    .container(spawnWorldX, spawnWorldY, [
      scene.add.circle(0, 0, 10, 0x8fd16a, 0.14).setStrokeStyle(2, 0xd7f0b6, 0.88),
      scene.add.text(0, -1, 'S', {
        color: '#eaffd9',
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        stroke: '#274617',
        strokeThickness: 3,
      }).setOrigin(0.5),
    ])
    .setDepth(1.35)
    .setVisible(isAdmin);

  for (const trader of worldTraders) {
    placeWorldTrader(trader);
  }

  for (const mob of worldMobs) {
    placeWorldMob(mob);
  }
}
