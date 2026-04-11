export const GAME_DATA_DIRNAME = 'game-data';

export function createGameDataCandidateDirs(cwd: string) {
  return [
    `${cwd}/../${GAME_DATA_DIRNAME}`,
    `${cwd}/${GAME_DATA_DIRNAME}`,
    `${cwd}/../../${GAME_DATA_DIRNAME}`,
  ];
}

export function getSkillBalancePath(gameDataDir: string) {
  return `${gameDataDir}/skill-balance.json`;
}

export function getMobBalancePath(gameDataDir: string) {
  return `${gameDataDir}/mob-balance.json`;
}

export function getItemBalancePath(gameDataDir: string) {
  return `${gameDataDir}/item-balance.json`;
}

export function getMobVisualsPath(gameDataDir: string) {
  return `${gameDataDir}/mob-visuals.json`;
}

export function getWorldDefinitionPath(gameDataDir: string, worldId: string) {
  return `${gameDataDir}/worlds/${worldId}.json`;
}

export function getWorldTradersPath(gameDataDir: string, worldId: string) {
  return `${gameDataDir}/traders/${worldId}.json`;
}

export function getWorldMobsPath(gameDataDir: string, worldId: string) {
  return `${gameDataDir}/mobs/${worldId}.json`;
}

export function getRaidTemplatesPath(gameDataDir: string) {
  return `${gameDataDir}/raids/templates.json`;
}

export function getLegacyRaidTemplatesPath(gameDataDir: string) {
  return `${gameDataDir}/raid-templates.json`;
}

export function getRaidContentPath(gameDataDir: string) {
  return `${gameDataDir}/raids/content.json`;
}
