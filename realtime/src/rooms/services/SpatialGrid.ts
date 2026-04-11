/**
 * Simple grid-based spatial index for broad-phase collision checks.
 *
 * Instead of O(n*m) distance checks between projectiles and
 * entities, entities register in grid cells and queries only
 * inspect nearby cells — reducing collision checks to O(n*k)
 * where k is the average number of entities per cell neighbourhood.
 */

export type SpatialEntity = {
  id: string;
  x: number;
  y: number;
};

export class SpatialGrid<T extends SpatialEntity> {
  private readonly cellSize: number;
  private readonly cells = new Map<string, T[]>();

  constructor(cellSize = 64) {
    this.cellSize = cellSize;
  }

  private cellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX}:${cellY}`;
  }

  /**
   * Rebuild the entire grid from a fresh collection of entities.
   * Call this once per tick, before any queries.
   */
  rebuild(entities: Iterable<T>) {
    this.cells.clear();
    for (const entity of entities) {
      const key = this.cellKey(entity.x, entity.y);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = [];
        this.cells.set(key, cell);
      }
      cell.push(entity);
    }
  }

  /**
   * Return all entities within `radius` world-units of (`x`, `y`).
   * Uses the grid for broad-phase, then filters by exact distance.
   */
  queryRadius(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const baseCellX = Math.floor(x / this.cellSize);
    const baseCellY = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;

    for (let cy = baseCellY - cellRadius; cy <= baseCellY + cellRadius; cy++) {
      for (let cx = baseCellX - cellRadius; cx <= baseCellX + cellRadius; cx++) {
        const cell = this.cells.get(`${cx}:${cy}`);
        if (!cell) {
          continue;
        }

        for (const entity of cell) {
          const dx = entity.x - x;
          const dy = entity.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Find the closest entity to (`x`, `y`) within `maxDistance`.
   */
  findNearest(
    x: number,
    y: number,
    maxDistance: number,
    predicate?: (entity: T) => boolean,
  ): { entity: T; distance: number } | null {
    const candidates = this.queryRadius(x, y, maxDistance);
    let best: { entity: T; distance: number } | null = null;

    for (const entity of candidates) {
      if (predicate && !predicate(entity)) {
        continue;
      }

      const distance = Math.hypot(entity.x - x, entity.y - y);
      if (!best || distance < best.distance) {
        best = { entity, distance };
      }
    }

    return best;
  }

  clear() {
    this.cells.clear();
  }
}
