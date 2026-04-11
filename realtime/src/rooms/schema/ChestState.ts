import { ArraySchema, Schema, type } from "@colyseus/schema";

export class ChestState extends Schema {
  @type("string") id = "";
  @type("string") title = "Wooden Chest";
  @type("string") subtitle = "Container";
  @type("number") columns = 4;
  @type("number") rows = 3;
  @type("number") x = 0;
  @type("number") y = 0;
  @type(["string"]) slots = new ArraySchema<string>();
}
