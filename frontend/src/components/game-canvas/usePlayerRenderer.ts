'use client';

import { useCallback, type MutableRefObject } from 'react';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import type { EquipmentItemId } from '@mmorpg/shared/items/catalog';

type RealtimeRoomState = {
  players?: Map<string, {
    id: string;
    name: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    level?: number;
    experience?: number;
    strength?: number;
    agility?: number;
    intellect?: number;
    burnTicksRemaining?: number;
    burnEndsAt?: number;
    healingTicksRemaining?: number;
    healingEndsAt?: number;
    woodStaffStrikeCooldownEndsAt?: number;
    fireballCooldownEndsAt?: number;
    fireNovaCooldownEndsAt?: number;
    fireFieldCooldownEndsAt?: number;
    castingSkillId?: string;
    castStartedAt?: number;
    castEndsAt?: number;
    bodyItem?: string;
    headItem?: string;
    weaponItem?: string;
    headGemItem1?: string;
    headGemItem2?: string;
    headGemItem3?: string;
    bodyGemItem1?: string;
    bodyGemItem2?: string;
    bodyGemItem3?: string;
    weaponGemItem1?: string;
    weaponGemItem2?: string;
    weaponGemItem3?: string;
    dead?: boolean;
    lastProcessedInput?: number;
  }>;
};

type RealtimeRoom = {
  state: RealtimeRoomState;
};

type StatusIconVisual = {
  back: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  timerText: Phaser.GameObjects.Text;
};

type CharacterVisual = {
  shadow: Phaser.GameObjects.Ellipse;
  burnAura: Phaser.GameObjects.Ellipse;
  container: Phaser.GameObjects.Container;
  deathEffect: Phaser.GameObjects.Image;
  burnEffect: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  leftEye: Phaser.GameObjects.Rectangle;
  rightEye: Phaser.GameObjects.Rectangle;
  leftHand: Phaser.GameObjects.Image;
  rightHand: Phaser.GameObjects.Image;
  weaponItem: Phaser.GameObjects.Image;
  weaponEffects: Array<{
    image: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Ellipse;
    baseX: number;
    baseY: number;
    baseAlpha: number;
  }>;
  nameplate: Phaser.GameObjects.Text;
  burnStatusIcon: StatusIconVisual;
  healingStatusIcon: StatusIconVisual;
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
  currentName: string;
  currentHealth: number;
  currentMaxHealth: number;
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
  currentBodyItem?: EquipmentItemId;
  currentWeaponItem?: EquipmentItemId;
  currentWeaponOffsetX: number;
  currentWeaponOffsetY: number;
  isFollowTarget: boolean;
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
  deathStartedAt: number;
  isDead: boolean;
  isVisible?: boolean;
};

type PlayerVisualRefs = {
  weaponItem: Phaser.GameObjects.Image;
};

type MovementStateAccessors = {
  getPendingRaidInputs: () => Array<{ sequence: number; x: number; y: number; durationMs: number }>;
  setPendingRaidInputs: (next: Array<{ sequence: number; x: number; y: number; durationMs: number }>) => void;
  getPendingWorldInputs: () => Array<{ sequence: number; x: number; y: number; durationMs: number }>;
  setPendingWorldInputs: (next: Array<{ sequence: number; x: number; y: number; durationMs: number }>) => void;
  getLastProcessedRaidInput: () => number;
  setLastProcessedRaidInput: (value: number) => void;
  getLastProcessedWorldInput: () => number;
  setLastProcessedWorldInput: (value: number) => void;
};

type PositionSyncAccessors = {
  setLastSyncedPosition: (x: number, y: number, at: number) => void;
};

type UsePlayerRendererParams = {
  scene: Phaser.Scene;
  Phaser: typeof import('phaser');
  room: RealtimeRoom | null;
  characters: Map<string, CharacterVisual>;
  completedDeadPlayerIds: Set<string>;
  localSessionId: string | null;
  isRaidScene: boolean;
  expectedServerTickMs: number;
  raidWidth: number;
  raidHeight: number;
  getLastRaidTilesWidth: () => number;
  getLastRaidTilesHeight: () => number;
  tileSize: number;
  createCharacter: (
    x: number,
    y: number,
    name: string,
    health: number,
    maxHealth: number,
    equipment: EquipmentState,
  ) => CharacterVisual;
  destroyCharacter: (sessionId: string) => void;
  syncDeathState: (character: any, dead: boolean, now: number) => void;
  applyCharacterHealthToVisual: (character: any, health: number, maxHealth: number) => void;
  applyBurningToCharacterVisual: (character: any, ticks: number, endsAt: number) => void;
  applyHealingToCharacterVisual: (character: any, ticks: number, endsAt: number) => void;
  applyCastingToCharacterVisual: (character: any, skillId: string, startedAt: number, endsAt: number) => void;
  applyEquipmentToVisual: (scene: Phaser.Scene, tileSize: number, character: any, equipment: EquipmentState) => void;
  toEquipmentItemId: (value: string) => EquipmentItemId | undefined;
  playerVisualRef: MutableRefObject<PlayerVisualRefs | null>;
  playerVitalsChangeRef: MutableRefObject<((payload: { health: number; maxHealth: number }) => void) | undefined>;
  playerProgressChangeRef: MutableRefObject<((payload: { level: number; experience: number }) => void) | undefined>;
  skillCooldownsRef: MutableRefObject<{
    woodStaffStrike?: number;
    fireball?: number;
    fireNova?: number;
    fireField?: number;
  }>;
  skillCooldownsChangeRef: MutableRefObject<((payload: {
    woodStaffStrike: number;
    fireball: number;
    fireNova: number;
    fireField: number;
  }) => void) | undefined>;
  latestProfileRef: { current: { playerLevel: number; playerExperience: number } };
  movementState: MovementStateAccessors;
  positionSyncState: PositionSyncAccessors;
  camera: Phaser.Cameras.Scene2D.Camera;
  reconcileRaidLocalCharacter: (
    character: any,
    authoritativeX: number,
    authoritativeY: number,
    width: number,
    height: number,
  ) => void;
  reconcileWorldLocalCharacter: (
    character: any,
    authoritativeX: number,
    authoritativeY: number,
  ) => void;
  hideStatusIcon: (icon: StatusIconVisual) => void;
};

export function usePlayerRenderer() {
  const setCharacterVisibility = useCallback(
    (
      character: CharacterVisual,
      visible: boolean,
      isLocalPlayer: boolean,
      hideStatusIcon: (icon: StatusIconVisual) => void,
    ) => {
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
      character.healthSegments.forEach((segment, index) =>
        segment.setVisible(shouldShowAliveVisuals && index < character.currentHealthSegmentCount),
      );
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
    },
    [],
  );

  const syncPlayersFromRoom = useCallback(
    (params: UsePlayerRendererParams) => {
      const {
        scene,
        Phaser,
        room,
        characters,
        completedDeadPlayerIds,
        localSessionId,
        isRaidScene,
        expectedServerTickMs,
        raidWidth,
        raidHeight,
        getLastRaidTilesWidth,
        getLastRaidTilesHeight,
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
      } = params;

      if (!room?.state.players) {
        return;
      }

      const seen = new Set<string>();

      room.state.players.forEach((networkPlayer, sessionId) => {
        seen.add(sessionId);

        if (networkPlayer.dead !== true) {
          completedDeadPlayerIds.delete(sessionId);
        }

        let character = characters.get(sessionId);
        if (!character) {
          if (networkPlayer.dead === true && completedDeadPlayerIds.has(sessionId)) {
            return;
          }
        }
        const equipment: EquipmentState = {
          body: toEquipmentItemId(networkPlayer.bodyItem ?? '') ?? undefined,
          head: toEquipmentItemId(networkPlayer.headItem ?? '') ?? undefined,
          weapon: toEquipmentItemId(networkPlayer.weaponItem ?? '') ?? undefined,
          'head-gem-1': networkPlayer.headGemItem1 ? (networkPlayer.headGemItem1 as EquipmentState['head-gem-1']) : undefined,
          'head-gem-2': networkPlayer.headGemItem2 ? (networkPlayer.headGemItem2 as EquipmentState['head-gem-2']) : undefined,
          'head-gem-3': networkPlayer.headGemItem3 ? (networkPlayer.headGemItem3 as EquipmentState['head-gem-3']) : undefined,
          'body-gem-1': networkPlayer.bodyGemItem1 ? (networkPlayer.bodyGemItem1 as EquipmentState['body-gem-1']) : undefined,
          'body-gem-2': networkPlayer.bodyGemItem2 ? (networkPlayer.bodyGemItem2 as EquipmentState['body-gem-2']) : undefined,
          'body-gem-3': networkPlayer.bodyGemItem3 ? (networkPlayer.bodyGemItem3 as EquipmentState['body-gem-3']) : undefined,
          'weapon-gem-1': networkPlayer.weaponGemItem1 ? (networkPlayer.weaponGemItem1 as EquipmentState['weapon-gem-1']) : undefined,
          'weapon-gem-2': networkPlayer.weaponGemItem2 ? (networkPlayer.weaponGemItem2 as EquipmentState['weapon-gem-2']) : undefined,
          'weapon-gem-3': networkPlayer.weaponGemItem3 ? (networkPlayer.weaponGemItem3 as EquipmentState['weapon-gem-3']) : undefined,
        };

        if (!character) {
          character = createCharacter(
            networkPlayer.x,
            networkPlayer.y,
            networkPlayer.name,
            networkPlayer.health,
            networkPlayer.maxHealth,
            equipment,
          );
          characters.set(sessionId, character);
        }

        const wasDead = character.isDead;
        syncDeathState(character, networkPlayer.dead === true, scene.time.now);
        if (wasDead !== character.isDead) {
          setCharacterVisibility(
            character,
            character.isVisible ?? true,
            sessionId === localSessionId,
            hideStatusIcon,
          );
        }

        character.targetX = networkPlayer.x;
        character.targetY = networkPlayer.y;
        if (sessionId !== localSessionId) {
          const now = scene.time.now;
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
            character.interpNextAt =
              Math.max(character.interpPrevAt, now) + expectedServerTickMs;
          }
        }
        if (character.currentName !== networkPlayer.name) {
          character.nameplate.setText(networkPlayer.name);
          character.currentName = networkPlayer.name;
        }
        if (
          character.currentHealth !== networkPlayer.health ||
          character.currentMaxHealth !== networkPlayer.maxHealth
        ) {
          applyCharacterHealthToVisual(character, networkPlayer.health, networkPlayer.maxHealth);
        }
        if (
          character.currentBurnTicksRemaining !== (networkPlayer.burnTicksRemaining ?? 0) ||
          character.currentBurnEndsAt !== (networkPlayer.burnEndsAt ?? 0)
        ) {
          applyBurningToCharacterVisual(
            character,
            networkPlayer.burnTicksRemaining ?? 0,
            networkPlayer.burnEndsAt ?? 0,
          );
        }
        if (
          character.currentHealingTicksRemaining !== (networkPlayer.healingTicksRemaining ?? 0) ||
          character.currentHealingEndsAt !== (networkPlayer.healingEndsAt ?? 0)
        ) {
          applyHealingToCharacterVisual(
            character,
            networkPlayer.healingTicksRemaining ?? 0,
            networkPlayer.healingEndsAt ?? 0,
          );
        }
        if (
          character.currentCastingSkillId !== (networkPlayer.castingSkillId ?? '') ||
          character.currentCastStartedAt !== (networkPlayer.castStartedAt ?? 0) ||
          character.currentCastEndsAt !== (networkPlayer.castEndsAt ?? 0)
        ) {
          applyCastingToCharacterVisual(
            character,
            networkPlayer.castingSkillId ?? '',
            networkPlayer.castStartedAt ?? 0,
            networkPlayer.castEndsAt ?? 0,
          );
        }
        applyEquipmentToVisual(scene, tileSize, character, equipment);

        if (sessionId === localSessionId && !character.isFollowTarget) {
          playerVisualRef.current = {
            weaponItem: character.weaponItem,
          };
          positionSyncState.setLastSyncedPosition(networkPlayer.x, networkPlayer.y, scene.time.now);
          playerVitalsChangeRef.current?.({
            health: networkPlayer.health,
            maxHealth: networkPlayer.maxHealth,
          });
          playerProgressChangeRef.current?.({
            level: networkPlayer.level ?? latestProfileRef.current.playerLevel,
            experience: networkPlayer.experience ?? latestProfileRef.current.playerExperience,
          });
          const nextCooldowns = {
            woodStaffStrike: networkPlayer.woodStaffStrikeCooldownEndsAt ?? 0,
            fireball: networkPlayer.fireballCooldownEndsAt ?? 0,
            fireNova: networkPlayer.fireNovaCooldownEndsAt ?? 0,
            fireField: networkPlayer.fireFieldCooldownEndsAt ?? 0,
          };
          skillCooldownsRef.current = nextCooldowns;
          skillCooldownsChangeRef.current?.(nextCooldowns);
          if (isRaidScene) {
            movementState.setLastProcessedRaidInput(networkPlayer.lastProcessedInput ?? 0);
            const nextPending = movementState
              .getPendingRaidInputs()
              .filter((input) => input.sequence > movementState.getLastProcessedRaidInput());
            movementState.setPendingRaidInputs(nextPending);
          } else {
            movementState.setLastProcessedWorldInput(networkPlayer.lastProcessedInput ?? 0);
            const nextPending = movementState
              .getPendingWorldInputs()
              .filter((input) => input.sequence > movementState.getLastProcessedWorldInput());
            movementState.setPendingWorldInputs(nextPending);
          }
          camera.startFollow(character.container, true, 0.18, 0.18);
          character.isFollowTarget = true;
        } else if (sessionId === localSessionId) {
          playerVitalsChangeRef.current?.({
            health: networkPlayer.health,
            maxHealth: networkPlayer.maxHealth,
          });
          playerProgressChangeRef.current?.({
            level: networkPlayer.level ?? latestProfileRef.current.playerLevel,
            experience: networkPlayer.experience ?? latestProfileRef.current.playerExperience,
          });
          const nextCooldowns = {
            woodStaffStrike: networkPlayer.woodStaffStrikeCooldownEndsAt ?? 0,
            fireball: networkPlayer.fireballCooldownEndsAt ?? 0,
            fireNova: networkPlayer.fireNovaCooldownEndsAt ?? 0,
            fireField: networkPlayer.fireFieldCooldownEndsAt ?? 0,
          };
          skillCooldownsRef.current = nextCooldowns;
          skillCooldownsChangeRef.current?.(nextCooldowns);

          if (isRaidScene) {
            const processedInput = networkPlayer.lastProcessedInput ?? 0;
            if (processedInput > movementState.getLastProcessedRaidInput()) {
              movementState.setLastProcessedRaidInput(processedInput);
              const nextPending = movementState
                .getPendingRaidInputs()
                .filter((input) => input.sequence > processedInput);
              movementState.setPendingRaidInputs(nextPending);
            }
            reconcileRaidLocalCharacter(
              character,
              networkPlayer.x,
              networkPlayer.y,
              getLastRaidTilesWidth() || raidWidth,
              getLastRaidTilesHeight() || raidHeight,
            );
          } else {
            const processedInput = networkPlayer.lastProcessedInput ?? 0;
            if (processedInput > movementState.getLastProcessedWorldInput()) {
              movementState.setLastProcessedWorldInput(processedInput);
              const nextPending = movementState
                .getPendingWorldInputs()
                .filter((input) => input.sequence > processedInput);
              movementState.setPendingWorldInputs(nextPending);
            }
            reconcileWorldLocalCharacter(
              character,
              networkPlayer.x,
              networkPlayer.y,
            );
          }
        }
      });

      [...characters.keys()].forEach((sessionId) => {
        if (!seen.has(sessionId)) {
          destroyCharacter(sessionId);
        }
      });
    },
    [setCharacterVisibility],
  );

  return {
    syncPlayersFromRoom,
    setCharacterVisibility,
  };
}
