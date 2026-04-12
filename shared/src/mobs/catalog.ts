export const MOB_KINDS = ["rat", "bat", "skeleton"] as const;

export type MobKind = (typeof MOB_KINDS)[number];

export type MobDefinition = {
  kind: MobKind;
  name: string;
  texture: MobKind;
  lootTableId: string | null;
};

export const MOB_DEFINITIONS: Record<MobKind, MobDefinition> = {
  rat: {
    kind: "rat",
    name: "Rat",
    texture: "rat",
    lootTableId: "mob_rat",
  },
  bat: {
    kind: "bat",
    name: "Bat",
    texture: "bat",
    lootTableId: "mob_bat",
  },
  skeleton: {
    kind: "skeleton",
    name: "Skeleton",
    texture: "skeleton",
    lootTableId: "mob_skeleton",
  },
};

export function isMobKind(value: string): value is MobKind {
  return MOB_KINDS.includes(value as MobKind);
}

export function getMobDefinition(kind: MobKind): MobDefinition {
  return MOB_DEFINITIONS[kind];
}
