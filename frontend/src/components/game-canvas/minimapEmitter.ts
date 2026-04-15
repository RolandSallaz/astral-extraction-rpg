'use client';

export type MinimapSnapshot = {
  roomName: 'world' | 'raid';
  width: number;
  height: number;
  tiles: string[];
  explored: number[];
  visible: number[];
  playerTile: {
    x: number;
    y: number;
  };
};

type CreateMinimapEmitterParams = {
  tileSize: number;
  meadowWidth: number;
  meadowHeight: number;
  meadowTiles: string[];
  raidMinimapUpdateIntervalMs: number;
  onMinimapChange: (snapshot: MinimapSnapshot | null) => void;
};

type EmitRaidMinimapParams = {
  playerTileX: number;
  playerTileY: number;
  width: number;
  height: number;
  tiles: string[];
  exploredTiles: Set<number>;
  visibleTiles: Set<number>;
  visionKey: string;
  now: number;
  force?: boolean;
};

export function createMinimapEmitter({
  tileSize,
  meadowWidth,
  meadowHeight,
  meadowTiles,
  raidMinimapUpdateIntervalMs,
  onMinimapChange,
}: CreateMinimapEmitterParams) {
  let lastMinimapPlayerTileKey = '';
  let lastRaidMinimapVisionKey = '';
  let lastRaidMinimapUpdateAt = 0;

  const emitLobbyMinimapSnapshot = (playerWorldX: number, playerWorldY: number) => {
    const playerTileX = Math.max(0, Math.min(meadowWidth - 1, Math.floor(playerWorldX / tileSize)));
    const playerTileY = Math.max(0, Math.min(meadowHeight - 1, Math.floor(playerWorldY / tileSize)));
    const playerTileKey = `${playerTileX}:${playerTileY}`;

    if (playerTileKey === lastMinimapPlayerTileKey) {
      return;
    }

    lastMinimapPlayerTileKey = playerTileKey;
    onMinimapChange({
      roomName: 'world',
      width: meadowWidth,
      height: meadowHeight,
      tiles: meadowTiles,
      explored: meadowTiles.map((_, index) => index),
      visible: meadowTiles.map((_, index) => index),
      playerTile: {
        x: playerTileX,
        y: playerTileY,
      },
    });
  };

  const emitRaidMinimapSnapshot = ({
    playerTileX,
    playerTileY,
    width,
    height,
    tiles,
    exploredTiles,
    visibleTiles,
    visionKey,
    now,
    force = false,
  }: EmitRaidMinimapParams) => {
    if (!force && now - lastRaidMinimapUpdateAt < raidMinimapUpdateIntervalMs) {
      return;
    }
    if (visionKey === lastRaidMinimapVisionKey) {
      return;
    }

    const explored = Array.from(exploredTiles.values()).sort((left, right) => left - right);
    const visible = Array.from(visibleTiles.values()).sort((left, right) => left - right);
    const playerTileKey = `${playerTileX}:${playerTileY}`;
    lastRaidMinimapVisionKey = visionKey;
    lastRaidMinimapUpdateAt = now;
    lastMinimapPlayerTileKey = playerTileKey;
    onMinimapChange({
      roomName: 'raid',
      width,
      height,
      tiles: [...tiles],
      explored,
      visible,
      playerTile: {
        x: playerTileX,
        y: playerTileY,
      },
    });
  };

  const resetRaidMinimapState = () => {
    lastRaidMinimapVisionKey = '';
    lastRaidMinimapUpdateAt = 0;
  };

  return {
    emitLobbyMinimapSnapshot,
    emitRaidMinimapSnapshot,
    resetRaidMinimapState,
  };
}
