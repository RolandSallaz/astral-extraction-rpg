import path from "node:path";
import { getWorldDefinitionPath } from "@mmorpg/shared/content/paths";
import {
  normalizeWorldDefinition,
  type WorldDefinition,
} from "@mmorpg/shared/worlds/definition";
import {
  readGameDataJson,
  resolveGameDataDirectory,
} from "./contentFiles.js";

export function loadWorldDefinition(worldId = "lobby"): WorldDefinition {
  const gameDataDir = resolveGameDataDirectory();
  const candidatePaths = [
    path.normalize(getWorldDefinitionPath(gameDataDir, worldId)),
  ];

  return readGameDataJson(candidatePaths, normalizeWorldDefinition);
}
