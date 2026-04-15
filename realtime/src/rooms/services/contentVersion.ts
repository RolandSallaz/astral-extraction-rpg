import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createGameDataCandidateDirs,
  getItemBalancePath,
  getMobBalancePath,
  getMobVisualsPath,
  getSkillBalancePath,
} from "@mmorpg/shared/content/paths";

let cachedVersionPromise: Promise<string> | null = null;

function resolveGameDataDirectory() {
  const candidateDirs = createGameDataCandidateDirs(process.cwd()).map((candidatePath) =>
    path.resolve(candidatePath),
  );

  return candidateDirs.find((candidatePath) => existsSync(candidatePath)) ?? candidateDirs[0];
}

async function computeContentVersion() {
  const gameDataDir = resolveGameDataDirectory();
  const files = [
    path.normalize(getSkillBalancePath(gameDataDir)),
    path.normalize(getMobBalancePath(gameDataDir)),
    path.normalize(getItemBalancePath(gameDataDir)),
    path.normalize(getMobVisualsPath(gameDataDir)),
  ];
  const hash = createHash("sha1");

  for (const filePath of files) {
    const content = await readFile(filePath);
    hash.update(path.basename(filePath));
    hash.update(":");
    hash.update(content);
    hash.update(";");
  }

  return hash.digest("hex");
}

export async function readLocalContentVersion() {
  if (!cachedVersionPromise) {
    cachedVersionPromise = computeContentVersion().catch((error) => {
      cachedVersionPromise = null;
      throw error;
    });
  }

  return cachedVersionPromise;
}
