import { type } from "@colyseus/schema";
import { BasePlayerState } from "./BasePlayerState.js";

export class PlayerState extends BasePlayerState {
  @type("boolean") isOnline = true;
  @type("number") offlineExpiresAt = 0;
  @type("number") moveX = 0;
  @type("number") moveY = 0;
}
