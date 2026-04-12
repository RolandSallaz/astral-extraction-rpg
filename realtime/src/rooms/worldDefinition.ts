import path from "node:path";
import { getWorldDefinitionPath, getWorldMobsPath } from "@mmorpg/shared/content/paths";
import {
  normalizeWorldDefinition,
  type WorldMobDefinition,
  type WorldDefinition,
} from "@mmorpg/shared/worlds/definition";
import {
  readGameDataJson,
  resolveGameDataDirectory,
} from "./contentFiles.js";

export function loadWorldDefinition(worldId = "lobby"): WorldDefinition {
  const gameDataDir = resolveGameDataDirectory();
  const worldDefinitionPaths = [
    path.normalize(getWorldDefinitionPath(gameDataDir, worldId)),
  ];
  const worldMobPaths = [
    path.normalize(getWorldMobsPath(gameDataDir, worldId)),
  ];

  const worldDefinition = readGameDataJson(worldDefinitionPaths, normalizeWorldDefinition);
  const staticMobs = readGameDataJson<WorldMobDefinition[]>(
    worldMobPaths,
    (value) => normalizeWorldDefinition({ staticMobs: value }).staticMobs,
    [],
  );

  return {
    ...worldDefinition,
    staticMobs,
  };
}
