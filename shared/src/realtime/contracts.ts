import { z } from "zod";
import type { MobBalanceConfig } from "../balance/mobBalance";
import type { SkillBalanceConfig } from "../balance/skillBalance";
import { canonicalizeItemId } from "../items/catalog";
import type { MobKind } from "../mobs/catalog";
import type { EquipmentState, InventoryState } from "../player/contracts";
import type { QuestLog } from "../quests/core";
import type { RaidRuntimeState } from "../raids/runtime";

const finiteNumberSchema = z.number().finite();
const finiteIntegerSchema = z.number().int().finite();

export type MoveMessage = {
  x: number;
  y: number;
  sequence?: number;
  clientEstimatedLatencyMs?: number;
};

export const moveMessageSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  sequence: finiteIntegerSchema.optional(),
  clientEstimatedLatencyMs: finiteIntegerSchema.optional(),
});

export type CastSkillMessage = {
  skillId?: string;
  targetX?: number;
  targetY?: number;
  clientEstimatedLatencyMs?: number;
  clientSentAt?: number;
};

export const castSkillMessageSchema = z.object({
  skillId: z.string().optional(),
  targetX: finiteNumberSchema.optional(),
  targetY: finiteNumberSchema.optional(),
  clientEstimatedLatencyMs: finiteIntegerSchema.optional(),
  clientSentAt: finiteIntegerSchema.optional(),
});

export type SyncChestMessage = {
  chestId?: string;
  slots?: string[];
};

export const syncChestMessageSchema = z.object({
  chestId: z.string().optional(),
  slots: z.array(z.string()).optional(),
});

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

export const chatInputMessageSchema = z.object({
  text: z.string().optional(),
});

export type RespawnMessage = Record<string, never>;

export type UseConsumableMessage = {
  source?: "inventory" | "container";
  slotIndex?: number;
  containerId?: string;
  mode?: "self" | "throw";
  targetX?: number;
  targetY?: number;
};

export const useConsumableMessageSchema = z.object({
  source: z.enum(["inventory", "container"]).optional(),
  slotIndex: finiteIntegerSchema.optional(),
  containerId: z.string().optional(),
  mode: z.enum(["self", "throw"]).optional(),
  targetX: finiteNumberSchema.optional(),
  targetY: finiteNumberSchema.optional(),
});

export type UseExitMessage = {
  exitId?: string;
};

export const useExitMessageSchema = z.object({
  exitId: z.string().optional(),
});

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
  sessionToken?: string;
  contentVersion?: string;
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
  gold?: number;
  quests?: QuestLog;
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
  runtimeState?: RaidRuntimeState | null;
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
