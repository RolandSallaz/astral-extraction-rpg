export type RaidTemplateDefinition = {
  code: string;
  name: string;
  description: string;
  biome: string;
  minPlayers: number;
  maxPlayers: number;
  width: number;
  height: number;
  isActive: boolean;
};

export function normalizeRaidTemplateDefinition(rawTemplate: Partial<RaidTemplateDefinition>): RaidTemplateDefinition | null {
  const code = typeof rawTemplate.code === 'string' ? rawTemplate.code.trim() : '';
  if (!code) {
    return null;
  }

  return {
    code,
    name: typeof rawTemplate.name === 'string' && rawTemplate.name.trim() ? rawTemplate.name.trim() : code,
    description: typeof rawTemplate.description === 'string' ? rawTemplate.description : '',
    biome: typeof rawTemplate.biome === 'string' && rawTemplate.biome.trim() ? rawTemplate.biome.trim() : 'crypt',
    minPlayers: typeof rawTemplate.minPlayers === 'number' ? Math.max(1, Math.floor(rawTemplate.minPlayers)) : 1,
    maxPlayers: typeof rawTemplate.maxPlayers === 'number' ? Math.max(1, Math.floor(rawTemplate.maxPlayers)) : 1,
    width: typeof rawTemplate.width === 'number' ? Math.max(8, Math.floor(rawTemplate.width)) : 32,
    height: typeof rawTemplate.height === 'number' ? Math.max(8, Math.floor(rawTemplate.height)) : 16,
    isActive: rawTemplate.isActive !== false,
  };
}
