export const MOB_KINDS = ["rat", "bat"] as const;

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
};

export function isMobKind(value: string): value is MobKind {
  return value === "rat" || value === "bat";
}

export function getMobDefinition(kind: MobKind): MobDefinition {
  return MOB_DEFINITIONS[kind];
}
