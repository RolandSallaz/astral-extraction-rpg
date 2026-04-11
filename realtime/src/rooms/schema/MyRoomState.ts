import { MapSchema, Schema, type } from "@colyseus/schema";
import { ChestState } from "./ChestState.js";
import { GroundEffectState } from "./GroundEffectState.js";
import { MobState } from "./MobState.js";
import { PlayerState } from "./PlayerState.js";
import { ProjectileState } from "./ProjectileState.js";

export class MyRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
  @type({ map: ChestState }) chests = new MapSchema<ChestState>();
  @type({ map: GroundEffectState }) groundEffects = new MapSchema<GroundEffectState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
}
