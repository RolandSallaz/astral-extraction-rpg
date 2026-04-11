import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { ChestState } from "./ChestState.js";
import { GroundEffectState } from "./GroundEffectState.js";
import { MobState } from "./MobState.js";
import { ProjectileState } from "./ProjectileState.js";
import { RaidPlayerState } from "./RaidPlayerState.js";

export class RaidRoomState extends Schema {
  @type("string") raidRunId = "";
  @type("string") templateCode = "";
  @type("string") templateName = "";
  @type("string") biome = "crypt";
  @type("string") seed = "";
  @type("string") status = "forming";
  @type("number") width = 0;
  @type("number") height = 0;
  @type(["string"]) tiles = new ArraySchema<string>();
  @type(["string"]) rooms = new ArraySchema<string>();
  @type(["string"]) spawnPoints = new ArraySchema<string>();
  @type(["string"]) exitPoints = new ArraySchema<string>();
  @type({ map: RaidPlayerState }) players = new MapSchema<RaidPlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
  @type({ map: ChestState }) chests = new MapSchema<ChestState>();
  @type({ map: GroundEffectState }) groundEffects = new MapSchema<GroundEffectState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
}
