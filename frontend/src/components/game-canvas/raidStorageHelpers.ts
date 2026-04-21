const RAID_MINIMAP_EXPLORED_STORAGE_PREFIX = 'mmorpg.raid-minimap-explored.v1';

export function getRaidExploredStorageKey(raidRunId: string) {
  return `${RAID_MINIMAP_EXPLORED_STORAGE_PREFIX}:${raidRunId}`;
}

export function loadStoredRaidExploredTiles(raidRunId: string, maxTiles: number) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getRaidExploredStorageKey(raidRunId));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < maxTiles,
    );
  } catch {
    return [];
  }
}

export function saveStoredRaidExploredTiles(raidRunId: string, exploredTiles: Set<number>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const serialized = JSON.stringify(Array.from(exploredTiles.values()).sort((left, right) => left - right));
    window.localStorage.setItem(getRaidExploredStorageKey(raidRunId), serialized);
  } catch {
    // ignore storage quota / parsing failures
  }
}
