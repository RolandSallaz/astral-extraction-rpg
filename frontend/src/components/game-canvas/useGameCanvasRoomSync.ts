'use client';

import { useRoomInboundSync } from '@/components/game-canvas/useRoomInboundSync';
import { useRoomOutboundSync } from '@/components/game-canvas/useRoomOutboundSync';
import { useProjectileEffectsRenderer } from '@/components/game-canvas/useProjectileEffectsRenderer';
import { useMobRenderer } from '@/components/game-canvas/useMobRenderer';
import { usePlayerRenderer } from '@/components/game-canvas/usePlayerRenderer';

type UseGameCanvasRoomSyncParams = {
  inbound: Parameters<typeof useRoomInboundSync>[0];
  outbound: Parameters<typeof useRoomOutboundSync>[0];
};

export function useGameCanvasRoomSync({ inbound, outbound }: UseGameCanvasRoomSyncParams) {
  const { attachRoomInboundHandlers } = useRoomInboundSync(inbound);
  const {
    syncProjectilesFromRoom,
    syncGroundEffectsFromRoom,
  } = useProjectileEffectsRenderer();
  const {
    syncMobsFromRoom,
    setMobVisibility,
  } = useMobRenderer();
  const {
    syncPlayersFromRoom,
    setCharacterVisibility,
  } = usePlayerRenderer();

  useRoomOutboundSync(outbound);

  return {
    attachRoomInboundHandlers,
    syncProjectilesFromRoom,
    syncGroundEffectsFromRoom,
    syncMobsFromRoom,
    setMobVisibility,
    syncPlayersFromRoom,
    setCharacterVisibility,
  };
}
