import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DEV-035 review R5-01: text written after a JSX comment's closing `*\/}` on
 * the same line is not a comment — React renders it. It shipped once as
 * «[deleted 2026-09-23, DEV-035]» on a Ukrainian refusal screen. Anything but
 * whitespace or the start of the next JSX token after `*\/}` fails here.
 */
const root = join(__dirname, "..", "..");

function* tsx(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "qa-output") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* tsx(path);
    else if (path.endsWith(".tsx")) yield path;
  }
}

describe("JSX comments", () => {
  it("carry no text after their closing `*/}` on the same line", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of ["app", "src"]) {
      for (const file of tsx(join(root, dir))) {
        scanned += 1;
        readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          const m = line.match(/\*\/\}(.*)$/);
          if (m && m[1]!.trim() !== "" && !/^\s*[<{)]/.test(m[1]!)) {
            offenders.push(`${relative(root, file)}:${i + 1}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
    // Positive control: an empty walk must not pass as «no offender».
    expect(scanned).toBeGreaterThan(20);
  });
});
