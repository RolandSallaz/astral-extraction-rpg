import { ArraySchema } from "@colyseus/schema";
import { type } from "@colyseus/schema";
import { BasePlayerState } from "./BasePlayerState.js";

export class RaidPlayerState extends BasePlayerState {
  @type(["string"]) inventory = new ArraySchema<string>();
}
