'use client';

import { useCallback, type MutableRefObject } from 'react';
import type {
  ConsumableCooldownMessage,
  DamageTextMessage,
  DiedMessage,
  InventoryUpdateMessage,
  RaidExitStateMessage,
  RealtimeChatMessage,
  RespawnedMessage,
  ThrownConsumableMessage,
} from '@mmorpg/shared/realtime/contracts';
import type { MobBalanceConfig, SkillBalanceConfig } from '@mmorpg/shared';

type RealtimeRoom = {
  onStateChange: (handler: () => void) => void;
  onMessage: (type: string, handler: (payload: any) => void) => void;
};

type RoomSyncHandlers = {
  syncRaidTilesFromRoom: () => void;
  syncPlayersFromRoom: () => void;
  syncMobsFromRoom: () => void;
  syncChestsFromRoom: () => void;
  syncRaidExitPointsFromRoom: () => void;
  syncGroundEffectsFromRoom: () => void;
  syncProjectilesFromRoom: () => void;
  updateRaidVisibility: (force?: boolean) => void;
  createFloatingDamageText: (x: number, y: number, text: string, color?: string) => void;
  playThrownConsumable: (payload: ThrownConsumableMessage) => void;
};

type UseRoomInboundSyncParams = {
  chatHistoryRef: MutableRefObject<((messages: RealtimeChatMessage[]) => void) | undefined>;
  chatMessageRef: MutableRefObject<((message: RealtimeChatMessage) => void) | undefined>;
  hasReceivedSkillBalanceRef: MutableRefObject<boolean>;
  lastKnownSkillBalanceSerializedRef: MutableRefObject<string>;
  skillBalanceConfigChangeRef: MutableRefObject<((config: SkillBalanceConfig) => void) | undefined>;
  hasReceivedMobBalanceRef: MutableRefObject<boolean>;
  lastKnownMobBalanceSerializedRef: MutableRefObject<string>;
  mobBalanceConfigChangeRef: MutableRefObject<((config: MobBalanceConfig) => void) | undefined>;
  playerDeathRef: MutableRefObject<((payload: DiedMessage) => void) | undefined>;
  beforePlayerRespawnRef: MutableRefObject<((payload: RespawnedMessage) => void) | undefined>;
  playerRespawnRef: MutableRefObject<((payload: RespawnedMessage) => void) | undefined>;
  playerInventoryChangeRef: MutableRefObject<((inventory: Array<string | null>) => void) | undefined>;
  consumableCooldownChangeRef: MutableRefObject<
    ((payload: { itemId: string; cooldownEndsAt: number }) => void) | undefined
  >;
  raidExitRef: MutableRefObject<((payload: RaidExitStateMessage) => void) | undefined>;
};

export function useRoomInboundSync({
  chatHistoryRef,
  chatMessageRef,
  hasReceivedSkillBalanceRef,
  lastKnownSkillBalanceSerializedRef,
  skillBalanceConfigChangeRef,
  hasReceivedMobBalanceRef,
  lastKnownMobBalanceSerializedRef,
  mobBalanceConfigChangeRef,
  playerDeathRef,
  beforePlayerRespawnRef,
  playerRespawnRef,
  playerInventoryChangeRef,
  consumableCooldownChangeRef,
  raidExitRef,
}: UseRoomInboundSyncParams) {
  const attachRoomInboundHandlers = useCallback(
    (room: RealtimeRoom, handlers: RoomSyncHandlers, initialSync = true) => {
      room.onStateChange(() => {
        handlers.syncRaidTilesFromRoom();
        handlers.syncPlayersFromRoom();
        handlers.syncMobsFromRoom();
        handlers.syncChestsFromRoom();
        handlers.syncRaidExitPointsFromRoom();
        handlers.syncGroundEffectsFromRoom();
        handlers.syncProjectilesFromRoom();
        handlers.updateRaidVisibility(true);
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

      room.onMessage('died', (payload: DiedMessage) => {
        playerDeathRef.current?.(payload);
      });

      room.onMessage('respawned', (payload: RespawnedMessage) => {
        beforePlayerRespawnRef.current?.(payload);
        playerRespawnRef.current?.(payload);
      });

      room.onMessage('inventoryUpdate', (payload: InventoryUpdateMessage) => {
        if (!Array.isArray(payload.inventory)) {
          return;
        }

        playerInventoryChangeRef.current?.(
          payload.inventory.map((item) => item || null),
        );
      });

      room.onMessage('consumableCooldown', (payload: ConsumableCooldownMessage) => {
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
      });

      room.onMessage('damageText', (payload: DamageTextMessage) => {
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

        handlers.createFloatingDamageText(payload.x, payload.y, payload.text, payload.color ?? '#ff5959');
      });

      room.onMessage('thrownConsumable', (payload: ThrownConsumableMessage) => {
        if (
          typeof payload?.itemId !== 'string' ||
          typeof payload?.startX !== 'number' ||
          typeof payload?.startY !== 'number' ||
          typeof payload?.targetX !== 'number' ||
          typeof payload?.targetY !== 'number' ||
          typeof payload?.durationMs !== 'number' ||
          !Number.isFinite(payload.startX) ||
          !Number.isFinite(payload.startY) ||
          !Number.isFinite(payload.targetX) ||
          !Number.isFinite(payload.targetY) ||
          !Number.isFinite(payload.durationMs) ||
          payload.durationMs <= 0
        ) {
          return;
        }

        handlers.playThrownConsumable(payload);
      });

      room.onMessage('raidExited', (payload: RaidExitStateMessage) => {
        raidExitRef.current?.(payload);
      });

      room.onMessage('raidExpired', (payload: RaidExitStateMessage) => {
        raidExitRef.current?.(payload);
      });

      if (initialSync) {
        handlers.syncRaidTilesFromRoom();
        handlers.syncPlayersFromRoom();
        handlers.syncMobsFromRoom();
        handlers.syncChestsFromRoom();
        handlers.syncRaidExitPointsFromRoom();
        handlers.syncGroundEffectsFromRoom();
        handlers.syncProjectilesFromRoom();
        handlers.updateRaidVisibility(true);
      }
    },
    [
      chatHistoryRef,
      chatMessageRef,
      hasReceivedSkillBalanceRef,
      lastKnownSkillBalanceSerializedRef,
      skillBalanceConfigChangeRef,
      hasReceivedMobBalanceRef,
      lastKnownMobBalanceSerializedRef,
      mobBalanceConfigChangeRef,
      playerDeathRef,
      beforePlayerRespawnRef,
      playerRespawnRef,
      playerInventoryChangeRef,
      consumableCooldownChangeRef,
      raidExitRef,
    ],
  );

  return {
    attachRoomInboundHandlers,
  };
}
