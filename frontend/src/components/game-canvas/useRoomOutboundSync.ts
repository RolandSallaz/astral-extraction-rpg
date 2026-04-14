'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { Room } from '@colyseus/sdk';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import type { QuestLog } from '@mmorpg/shared/quests/core';
import type {
  AdminUpdateMobBalanceMessage,
  AdminUpdateSkillBalanceMessage,
  CastSkillMessage,
  SyncChestMessage,
  UseConsumableMessage,
  WorldProfileMessage,
} from '@mmorpg/shared/realtime/contracts';
import type { SkillBalanceConfig } from '@/lib/skillBalance';
import type { MobBalanceConfig } from '@/lib/mobBalance';

type RealtimeRoom = Room<unknown>;

type PlayerProfileSnapshot = {
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
  playerGold: number;
  playerQuests: QuestLog;
  playerInventory: Array<string | null>;
  playerEquipment: EquipmentState;
};

type UseConsumableRequest = {
  source: 'inventory' | 'container';
  slotIndex: number;
  containerId?: string;
  mode?: 'self' | 'throw';
  targetX?: number;
  targetY?: number;
  nonce: number;
} | null;

type UseRoomOutboundSyncParams = {
  activeRoomName: 'world' | 'raid';
  playerRole: string;
  playerProfile: PlayerProfileSnapshot;
  roomRef: MutableRefObject<RealtimeRoom | null>;
  skillBalanceConfig: SkillBalanceConfig;
  mobBalanceConfig: MobBalanceConfig;
  hasReceivedSkillBalanceRef: MutableRefObject<boolean>;
  lastKnownSkillBalanceSerializedRef: MutableRefObject<string>;
  hasReceivedMobBalanceRef: MutableRefObject<boolean>;
  lastKnownMobBalanceSerializedRef: MutableRefObject<string>;
  useConsumableRequest: UseConsumableRequest;
  containerStates?: Record<string, Array<string | null>>;
  serverContainersRef: MutableRefObject<Record<string, Array<string | null>>>;
  respawnRequestNonce: number;
  pendingRespawnNonceRef: MutableRefObject<number>;
  lastSentRespawnNonceRef: MutableRefObject<number>;
  fireNovaCastNonce: number;
  woodStaffStrikeCastNonce: number;
  estimatedOneWayLatencyMsRef: MutableRefObject<number>;
  lastPointerWorldRef: MutableRefObject<{ x: number; y: number }>;
  skillCooldownsRef: MutableRefObject<{
    woodStaffStrike?: number;
    fireball?: number;
    fireNova?: number;
    fireField?: number;
  }>;
  createWorldProfileMessage: (profile: PlayerProfileSnapshot) => WorldProfileMessage;
  createTimedCastSkillMessage: (
    payload: CastSkillMessage,
    estimatedLatencyMs: number,
  ) => CastSkillMessage;
};

export function useRoomOutboundSync({
  activeRoomName,
  playerRole,
  playerProfile,
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
  estimatedOneWayLatencyMsRef,
  lastPointerWorldRef,
  skillCooldownsRef,
  createWorldProfileMessage,
  createTimedCastSkillMessage,
}: UseRoomOutboundSyncParams) {
  useEffect(() => {
    const profileMessage = createWorldProfileMessage(playerProfile);
    roomRef.current?.send('profile', profileMessage);
  }, [
    activeRoomName,
    createWorldProfileMessage,
    playerProfile.playerAgility,
    playerProfile.playerEquipment,
    playerProfile.playerExperience,
    playerProfile.playerHealth,
    playerProfile.playerIntellect,
    playerProfile.playerInventory,
    playerProfile.playerLevel,
    playerProfile.playerMaxHealth,
    playerProfile.playerName,
    playerProfile.playerPosition,
    playerProfile.playerRole,
    playerProfile.playerStrength,
    roomRef,
  ]);

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
  }, [activeRoomName, playerRole, roomRef, skillBalanceConfig, hasReceivedSkillBalanceRef, lastKnownSkillBalanceSerializedRef]);

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
  }, [activeRoomName, playerRole, roomRef, mobBalanceConfig, hasReceivedMobBalanceRef, lastKnownMobBalanceSerializedRef]);

  useEffect(() => {
    if (!roomRef.current || !useConsumableRequest || useConsumableRequest.nonce <= 0) {
      return;
    }

    const useConsumableMessage: UseConsumableMessage = {
      source: useConsumableRequest.source,
      slotIndex: useConsumableRequest.slotIndex,
      containerId: useConsumableRequest.containerId,
      mode: useConsumableRequest.mode,
      targetX: useConsumableRequest.targetX,
      targetY: useConsumableRequest.targetY,
    };
    roomRef.current.send('useConsumable', useConsumableMessage);
  }, [roomRef, useConsumableRequest]);

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
  }, [containerStates, roomRef, serverContainersRef]);

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
  }, [activeRoomName, respawnRequestNonce, roomRef, pendingRespawnNonceRef, lastSentRespawnNonceRef]);

  useEffect(() => {
    if (fireNovaCastNonce <= 0) {
      return;
    }

    const castSkillMessage = createTimedCastSkillMessage(
      { skillId: 'fireNova' },
      estimatedOneWayLatencyMsRef.current,
    );
    roomRef.current?.send('castSkill', castSkillMessage);
  }, [activeRoomName, fireNovaCastNonce, createTimedCastSkillMessage, estimatedOneWayLatencyMsRef, roomRef]);

  useEffect(() => {
    if (woodStaffStrikeCastNonce <= 0) {
      return;
    }

    if (!roomRef.current) {
      return;
    }

    const now = Date.now();
    if ((skillCooldownsRef.current.woodStaffStrike ?? 0) > now) {
      return;
    }

    const target = lastPointerWorldRef.current;
    const castSkillMessage = createTimedCastSkillMessage(
      {
        skillId: 'woodStaffStrike',
        targetX: target.x,
        targetY: target.y,
      },
      estimatedOneWayLatencyMsRef.current,
    );
    roomRef.current.send('castSkill', castSkillMessage);
  }, [
    activeRoomName,
    woodStaffStrikeCastNonce,
    createTimedCastSkillMessage,
    estimatedOneWayLatencyMsRef,
    lastPointerWorldRef,
    roomRef,
    skillCooldownsRef,
  ]);
}
