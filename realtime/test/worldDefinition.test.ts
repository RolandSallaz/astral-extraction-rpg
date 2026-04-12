import assert from "assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadWorldDefinition } from "../src/rooms/worldDefinition.js";

describe("world definition loading", () => {
  it("loads static mobs from the dedicated world mobs file", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "mmorpg-world-definition-"));
    const realtimeDir = path.join(tempRoot, "realtime");
    const gameDataDir = path.join(tempRoot, "game-data");
    const previousCwd = process.cwd();

    mkdirSync(realtimeDir, { recursive: true });
    mkdirSync(path.join(gameDataDir, "worlds"), { recursive: true });
    mkdirSync(path.join(gameDataDir, "mobs"), { recursive: true });

    writeFileSync(
      path.join(gameDataDir, "worlds", "test-world.json"),
      `${JSON.stringify({
        id: "test-world",
        name: "Test World",
        tileSize: 32,
        width: 24,
        height: 18,
        safeLobby: false,
        hostileMobsEnabled: true,
        spawn: { x: 4, y: 5 },
        blockedTiles: [{ x: 1, y: 2 }],
        staticChests: [],
        staticMobs: [
          {
            id: "legacy-rat",
            kind: "rat",
            spawn: { x: 1, y: 1 },
            patrol: {
              minX: 1,
              maxX: 2,
              y: 1,
              radiusY: 0,
              phase: 0,
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(gameDataDir, "mobs", "test-world.json"),
      `${JSON.stringify([
        {
          id: "world-skeleton",
          kind: "skeleton",
          spawn: { x: 9, y: 10 },
          patrol: {
            minX: 9,
            maxX: 11,
            y: 10,
            radiusY: 1,
            phase: 0.5,
          },
        },
      ], null, 2)}\n`,
      "utf8",
    );

    try {
      process.chdir(realtimeDir);
      const worldDefinition = loadWorldDefinition("test-world");

      assert.strictEqual(worldDefinition.name, "Test World");
      assert.strictEqual(worldDefinition.width, 24);
      assert.deepStrictEqual(worldDefinition.staticMobs, [
        {
          id: "world-skeleton",
          kind: "skeleton",
          spawn: { x: 9, y: 10 },
          patrol: {
            minX: 9,
            maxX: 11,
            y: 10,
            radiusY: 1,
            phase: 0.5,
          },
        },
      ]);
    } finally {
      process.chdir(previousCwd);
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
