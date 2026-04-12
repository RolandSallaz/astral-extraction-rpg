import type { MobBalanceConfig } from "../balance/mobBalance";
import type { SkillBalanceConfig } from "../balance/skillBalance";
import { canonicalizeItemId } from "../items/catalog";
import type { MobKind } from "../mobs/catalog";
import type { EquipmentState, InventoryState } from "../player/contracts";

export type MoveMessage = {
  x: number;
  y: number;
  sequence?: number;
};

export type CastSkillMessage = {
  skillId?: string;
  targetX?: number;
  targetY?: number;
  clientEstimatedLatencyMs?: number;
  clientSentAt?: number;
};

export type SyncChestMessage = {
  chestId?: string;
  slots?: string[];
};

export type ChatChannel = "general" | "combat";

export type RealtimeChatMessage = {
  id: string | number;
  author: string;
  text: string;
  channel: ChatChannel;
  createdAt: string;
};

export type ChatInputMessage = {
  text?: string;
};

export type RespawnMessage = Record<string, never>;

export type UseConsumableMessage = {
  source?: "inventory" | "container";
  slotIndex?: number;
  containerId?: string;
};

export type UseExitMessage = {
  exitId?: string;
};

export type EquipmentSyncFields = {
  bodyItem?: string;
  headItem?: string;
  weaponItem?: string;
  headGemItem1?: string;
  headGemItem2?: string;
  headGemItem3?: string;
  bodyGemItem1?: string;
  bodyGemItem2?: string;
  bodyGemItem3?: string;
  weaponGemItem1?: string;
  weaponGemItem2?: string;
  weaponGemItem3?: string;
};

export type BaseProfileMessage = EquipmentSyncFields & {
  name?: string;
  role?: string;
  health?: number;
  maxHealth?: number;
  level?: number;
  experience?: number;
  strength?: number;
  agility?: number;
  intellect?: number;
  inventory?: string[];
};

export type WorldProfileMessage = BaseProfileMessage & {
  position?: {
    x?: number;
    y?: number;
  };
  worldSpawn?: {
    x?: number;
    y?: number;
  };
};

export type WorldRoomJoinOptions = WorldProfileMessage & {
  worldOwner?: string;
};

export type RaidProfileMessage = BaseProfileMessage;

export type RaidRoomJoinOptions = RaidProfileMessage & {
  raidRunId?: string;
  templateCode?: string;
  templateName?: string;
  biome?: string;
  seed?: string;
  width?: number;
  height?: number;
};

export type AdminUpdateSkillBalanceMessage = Partial<{
  fireball: Partial<SkillBalanceConfig["fireball"]>;
  fireNova: Partial<SkillBalanceConfig["fireNova"]>;
  fireField: Partial<SkillBalanceConfig["fireField"]>;
}>;

export type AdminUpdateMobBalanceMessage = Partial<Record<MobKind, Partial<MobBalanceConfig[MobKind]>>>;

export type DiedMessage = {
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  equipment: EquipmentState;
  inventory: InventoryState;
};

export type RespawnedMessage = {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
};

export type InventoryUpdateMessage = {
  inventory?: string[];
};

export type ConsumableCooldownMessage = {
  itemId?: string;
  cooldownEndsAt?: number;
};

export type DamageTextMessage = {
  x?: number;
  y?: number;
  text?: string;
  color?: string;
};

export type RaidExitReason = "extracted" | "defeated" | "expired";

export type RaidExitStateMessage = {
  raidRunId?: string;
  exitId?: string;
  reason?: RaidExitReason;
  health?: number;
  maxHealth?: number;
  level?: number;
  experience?: number;
  equipment?: EquipmentState;
  inventory?: InventoryState;
};

export function createEquipmentStateSnapshot(fields: Partial<EquipmentSyncFields>): EquipmentState {
  const nextEquipment: EquipmentState = {};

  const assignments: Array<[keyof EquipmentState, string | undefined]> = [
    ["head", fields.headItem],
    ["body", fields.bodyItem],
    ["weapon", fields.weaponItem],
    ["head-gem-1", fields.headGemItem1],
    ["head-gem-2", fields.headGemItem2],
    ["head-gem-3", fields.headGemItem3],
    ["body-gem-1", fields.bodyGemItem1],
    ["body-gem-2", fields.bodyGemItem2],
    ["body-gem-3", fields.bodyGemItem3],
    ["weapon-gem-1", fields.weaponGemItem1],
    ["weapon-gem-2", fields.weaponGemItem2],
    ["weapon-gem-3", fields.weaponGemItem3],
  ];

  assignments.forEach(([slot, value]) => {
    const canonical = canonicalizeItemId(value);
    if (canonical) {
      nextEquipment[slot] = canonical as EquipmentState[typeof slot];
    }
  });

  return nextEquipment;
}
