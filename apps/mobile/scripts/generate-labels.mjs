// The CSV is the source; React Native cannot read it at runtime, so the subset
// the app needs is emitted as JSON at build time.
//
// technical/copy-catalog.csv follows RFC 4180: a field containing a comma (or
// a literal double quote) is wrapped in double quotes, and a literal quote
// inside a quoted field is written doubled (""). field.permission.camera_denied
// is one such row today — its ui_uk value has a comma inside quotes. A plain
// `line.split(",")` truncates that value at the embedded comma and produces a
// plausible-looking WRONG answer instead of an error, and the row-count guard
// below can't see it: the row is still there, just cut short. The parser below
// is quote-aware so a truncated or malformed field throws instead of passing
// through silently.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const csv = readFileSync(join(root, "technical/copy-catalog.csv"), "utf8");

// Splits one CSV line into fields per RFC 4180: an unquoted field ends at the
// next comma; a quoted field ends at the next unescaped closing quote and may
// itself contain commas, with `""` inside it decoding to a literal `"`.
// Throws if a quoted field never closes — an unbalanced quote, which is
// exactly what a truncated field (the naive split's failure mode) looks like.
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = "";
      i += 1;
      let closed = false;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        value += line[i];
        i += 1;
      }
      if (!closed) {
        throw new Error(`unbalanced quote in CSV field: ${line}`);
      }
      fields.push(value);
      if (line[i] === ",") {
        i += 1;
      } else if (i >= line.length) {
        break;
      } else {
        throw new Error(`unexpected character after quoted CSV field: ${line}`);
      }
    } else {
      const commaIndex = line.indexOf(",", i);
      const end = commaIndex === -1 ? line.length : commaIndex;
      fields.push(line.slice(i, end));
      i = end + 1;
      if (commaIndex === -1) break;
    }
  }
  return fields;
}

const out = {};
for (const line of csv.split("\n")) {
  if (!line.startsWith("status.client_state.")) continue;
  const [key, uk] = parseCsvLine(line);
  if (!uk) {
    throw new Error(`empty or missing ui_uk field for ${key} in copy-catalog.csv`);
  }
  out[key] = uk;
}
// A row-loss guard, not a vocabulary claim: it catches the catalog silently
// shedding a label, and nothing else. The count went 6 -> 7 on 2026-08-06 when
// ADR-007 decision 6 added the `discarded` row it records as owed; this script
// was not re-run, so it would have thrown, and the committed JSON below stayed
// six keys wide until 2026-08-08. What the seven keys are ALLOWED to be is
// checked in packages/testing/src/copy-catalog-fidelity.test.ts against the
// state machine that owns them, which is the check with the teeth.
const EXPECTED_LABELS = 7;
if (Object.keys(out).length !== EXPECTED_LABELS) {
  throw new Error(
    `expected ${EXPECTED_LABELS} client_state labels, found ${Object.keys(out).length}`);
}
writeFileSync(join(import.meta.dirname, "..", "src/lib/status-labels.generated.json"),
  JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${EXPECTED_LABELS} labels`);
