import { Schema, type } from "@colyseus/schema";

export class GroundEffectState extends Schema {
  @type("string") id = "";
  @type("string") ownerId = "";
  @type("string") skillId = "fireField";
  @type("number") tileX = 0;
  @type("number") tileY = 0;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") expiresAt = 0;
  @type("number") nextTickAt = 0;
}
