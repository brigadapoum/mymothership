// Собирает компендиумы: src/packs/<имя>/*.json → packs/<имя> (LevelDB, формат Foundry 13).
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src", "packs");
for (const name of fs.readdirSync(src)) {
  const dest = path.join(root, "packs", name);
  fs.rmSync(dest, { recursive: true, force: true });
  await compilePack(path.join(src, name), dest, { log: false });
  console.log(`компендиум ${name} собран`);
}
