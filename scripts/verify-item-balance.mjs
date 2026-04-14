import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_ITEM_BALANCE_CONFIG } from "@mmorpg/shared/balance/itemBalance";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const balancePath = path.join(repoRoot, "game-data", "item-balance.json");

const raw = JSON.parse(await fs.readFile(balancePath, "utf8"));
const expectedKeys = Object.keys(DEFAULT_ITEM_BALANCE_CONFIG);
const actualKeys = Object.keys(raw ?? {});

const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
const extra = actualKeys.filter((key) => !expectedKeys.includes(key));

if (missing.length > 0) {
  console.error("[item-balance] Missing entries:", missing.join(", "));
  process.exit(1);
}

if (extra.length > 0) {
  console.warn("[item-balance] Extra entries not in shared defaults:", extra.join(", "));
}

console.log(`[item-balance] OK (${expectedKeys.length} entries)`);
