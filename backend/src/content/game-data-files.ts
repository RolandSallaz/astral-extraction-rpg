import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGameDataCandidateDirs } from '@mmorpg/shared/content/paths';

export function resolveGameDataDirectory(explicitRootDir?: string) {
  if (explicitRootDir) {
    return explicitRootDir;
  }

  const candidateDirs = createGameDataCandidateDirs(process.cwd()).map((candidatePath) =>
    path.resolve(candidatePath),
  );

  return candidateDirs.find((candidatePath) => existsSync(candidatePath)) ?? candidateDirs[0];
}

export async function ensureJsonFile<T>(filePath: string, defaults: T) {
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeJsonFile(filePath, defaults);
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const rawValue = await readFile(filePath, 'utf8');
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
