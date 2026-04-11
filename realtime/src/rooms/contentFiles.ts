import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createGameDataCandidateDirs } from "@mmorpg/shared/content/paths";

export function resolveGameDataDirectory() {
  const candidateDirs = createGameDataCandidateDirs(process.cwd()).map((candidatePath) =>
    path.resolve(candidatePath),
  );

  return candidateDirs.find((candidatePath) => existsSync(candidatePath)) ?? candidateDirs[0];
}

export function readGameDataJson<T>(
  candidatePaths: string[],
  normalize: (value: unknown) => T,
  fallback: unknown = null,
) {
  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    const rawValue = readFileSync(candidatePath, "utf8");
    return normalize(JSON.parse(rawValue));
  }

  return normalize(fallback);
}
