import path from "node:path";
import { getRaidContentPath } from "@mmorpg/shared/content/paths";
import {
  getRaidTemplateContent,
  normalizeRaidContentConfig,
  type RaidContentConfig,
  type RaidTemplateContentDefinition,
} from "@mmorpg/shared/raids/content";
import {
  readGameDataJson,
  resolveGameDataDirectory,
} from "./contentFiles.js";

export function loadRaidContent(): RaidContentConfig {
  const gameDataDir = resolveGameDataDirectory();
  const candidatePaths = [
    path.normalize(getRaidContentPath(gameDataDir)),
  ];

  return readGameDataJson(candidatePaths, normalizeRaidContentConfig);
}

export function resolveRaidTemplateContent(
  content: RaidContentConfig,
  templateCode: string,
): RaidTemplateContentDefinition {
  return getRaidTemplateContent(content, templateCode);
}
