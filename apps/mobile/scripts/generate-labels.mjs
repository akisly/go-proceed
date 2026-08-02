// The CSV is the source; React Native cannot read it at runtime, so the subset
// the app needs is emitted as JSON at build time.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const csv = readFileSync(join(root, "technical/copy-catalog.csv"), "utf8");
const out = {};
for (const line of csv.split("\n")) {
  if (!line.startsWith("status.client_state.")) continue;
  const [key, uk] = line.split(",");
  out[key] = uk;
}
if (Object.keys(out).length !== 6) {
  throw new Error(`expected 6 client_state labels, found ${Object.keys(out).length}`);
}
writeFileSync(join(import.meta.dirname, "..", "src/lib/status-labels.generated.json"),
  JSON.stringify(out, null, 2) + "\n");
console.log(`wrote 6 labels`);
