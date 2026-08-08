import { readFileSync } from "node:fs";

/**
 * NOTHING IN THE M4 SUITES THAT USE THIS FILE HAS BEEN EXECUTED. There is no
 * node_modules, no database and no docker in the environment it was written in:
 * `pnpm`, `vitest`, `tsc`, `psql` and `supabase` were never run, and no claim is
 * made that any of it passes. Static reading is the only check that was
 * available.
 *
 * ---------------------------------------------------------------------------
 * docs/product/hidden-works-content-rules.md, READ AT TEST TIME.
 *
 * WHY THE DOCUMENT IS READ RATHER THAN TRANSCRIBED. It is the same argument
 * `helpers/dodatok-n.ts` makes about the Додаток Н CSV, and it is stronger here:
 * the document is **Approved and restricts at every precedence level, including
 * over ADRs** (docs/README.md §"Source of truth"). A disclaimer pasted into a
 * test is a second copy of a mandatory string, and two copies of a mandatory
 * string is exactly one copy too many — the renderer's constant could drift from
 * the rule and both tests would still be green, because both would be comparing
 * the renderer with itself.
 *
 * SO THE ASSERTIONS THIS FILE FEEDS ARE COMPARISONS BETWEEN TWO INDEPENDENT
 * ARTIFACTS: `apps/app/src/lib/statutory-act-form.ts` on one side and the
 * Approved document on the other. If the document gains a mandated disclaimer,
 * `requiredDisclaimers()` returns one more entry and the count assertion fails —
 * which is the point. A newly mandated string that no renderer prints is a
 * defect, and it must not be invisible.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. It reads no field of Додаток В and
 * builds none: the В.1/В.2 field list is committed nowhere in this repository
 * (docs/delivery/test-strategy.md:139-152) and **no test may substitute one
 * typed from memory**. Nothing below reconstructs a caption, an order or a
 * count of the form's fields.
 */

export const CONTENT_RULES_PATH = new URL(
  "../../../../docs/product/hidden-works-content-rules.md", import.meta.url);

export const CONTENT_RULES_REPO_PATH = "docs/product/hidden-works-content-rules.md";

function text(): string {
  return readFileSync(CONTENT_RULES_PATH, "utf-8");
}

/**
 * The lines of one `## ` section, from its heading to the next `## ` heading.
 * `### ` subheadings stay inside, because the assurance ladder's table lives
 * under one.
 */
function section(heading: string): string[] {
  const lines = text().split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) {
    throw new Error(`hidden-works-content-rules.md has no section "## ${heading}"`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * A markdown paragraph as one line: the wrap is a property of the file, not of
 * the string the product prints.
 *
 * EMPHASIS MARKERS ARE REMOVED AND NOTHING ELSE IS. `**` is markdown; the words
 * between them are the rule. No trim of an interior space, no `.normalize()`,
 * no punctuation repair — prohibition **F** («never silently "fix" the
 * original's language») binds this reader exactly as it binds the renderer, and
 * a reader that tidied a string would make the byte-identity assertions
 * compare a cleaned-up copy with a cleaned-up copy.
 */
function unwrap(lines: readonly string[]): string {
  return lines.map((l) => l.trim()).join(" ").replaceAll("**", "");
}

export interface RequiredDisclaimer {
  /** Where in the document it is mandated, unwrapped: the sentence before it. */
  introduction: string;
  /** The blockquote itself, unwrapped, with `**` removed and nothing else. */
  body: string;
}

/**
 * Every blockquote of §"Required disclaimers", in document order.
 *
 * A blockquote is a maximal run of consecutive `>` lines. The introduction is
 * the run of non-blank, non-`>` lines immediately above it, which is what says
 * WHERE the disclaimer is mandatory — «On every page of a generated act blank»,
 * «Under every generated requirement list», «Next to every rendered decision or
 * signatory block». Those sentences are assertions the render has to satisfy and
 * are therefore carried rather than discarded.
 */
export function requiredDisclaimers(): RequiredDisclaimer[] {
  const lines = section("Required disclaimers");
  const out: RequiredDisclaimer[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]!.startsWith(">")) { i += 1; continue; }
    const quote: string[] = [];
    while (i < lines.length && lines[i]!.startsWith(">")) {
      quote.push(lines[i]!.replace(/^>\s?/, ""));
      i += 1;
    }
    // Walk back over the blank line to the prose that introduces it.
    const intro: string[] = [];
    let k = i - quote.length - 1;
    while (k >= 0 && lines[k]!.trim() === "") k -= 1;
    while (k >= 0 && lines[k]!.trim() !== "" && !lines[k]!.startsWith(">")) {
      intro.unshift(lines[k]!);
      k -= 1;
    }
    out.push({ introduction: unwrap(intro), body: unwrap(quote) });
  }
  if (out.length === 0) {
    throw new Error('hidden-works-content-rules.md §"Required disclaimers" has no blockquote');
  }
  return out;
}

/**
 * One numbered item of §"What the product MAY assert, with attribution",
 * unwrapped. Item 3 licenses the Додаток В form and its attribution; item 7 the
 * form's title.
 */
export function allowListItem(itemNo: number): string {
  const lines = section("What the product MAY assert, with attribution");
  const start = lines.findIndex((l) => l.startsWith(`${itemNo}. `));
  if (start < 0) {
    throw new Error(`hidden-works-content-rules.md allow-list has no item ${itemNo}`);
  }
  const body = [lines[start]!];
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i]!;
    if (l.trim() === "" || /^\d+\. /.test(l) || l.startsWith("#") || l.startsWith("|")) break;
    body.push(l);
  }
  return unwrap(body);
}

/** One lettered prohibition of §"What the product MUST NOT assert", unwrapped. */
export function prohibition(letter: string): string {
  const lines = section("What the product MUST NOT assert");
  const start = lines.findIndex((l) => l.startsWith(`**${letter}. `));
  if (start < 0) {
    throw new Error(`hidden-works-content-rules.md has no prohibition ${letter}`);
  }
  const body = [lines[start]!];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i]!.trim() === "") break;
    body.push(lines[i]!);
  }
  return unwrap(body);
}

/** Every «…» quotation of a passage, in order. */
export function quoted(passage: string): string[] {
  return [...passage.matchAll(/«([^»]*)»/g)].map((m) => m[1] as string);
}

/**
 * PROHIBITION E's banned field list, read from the prohibition itself.
 *
 * «шифр», «аркуш», «ким видана», «паспорт», «Акт №», «м.п.» — and the seventh
 * item, «a fourth signatory», is not a string and is asserted structurally
 * instead (the primary key on (version, slot) over a three-value CHECK, and
 * `composeSignatories`'s three `.strict()` keys).
 *
 * READ RATHER THAN LISTED, so a prohibition the document gains is a prohibition
 * the suite starts checking on the day it is written, and not on the day
 * somebody remembers to widen an array in a test.
 */
export function prohibitionEBannedFields(): string[] {
  const fields = quoted(prohibition("E"));
  if (fields.length === 0) {
    throw new Error("prohibition E names no «…» field; the reader or the document changed");
  }
  return fields;
}

export interface LadderLevel {
  level: number;
  /** The ladder's own label, in the ladder's own words. */
  label: string;
}

/**
 * The five levels of §"Electronic-signature assurance ladder", read off its own
 * table.
 *
 * THE LADDER GIVES NO UKRAINIAN TRANSLATION, anywhere in this repository, and
 * `ASSURANCE_LEVEL_LABEL` therefore prints these English strings verbatim.
 * Comparing the two is what makes that a checked property rather than a comment:
 * a mistranslation of level 3 is precisely the conflation prohibition S and the
 * ladder exist to prevent, and an invented Ukrainian label would be
 * legal-adjacent product copy on a regulated document.
 */
export function assuranceLadder(): LadderLevel[] {
  const lines = section("Electronic-signature assurance ladder");
  const rows: LadderLevel[] = [];
  for (const line of lines) {
    const m = /^\|\s*([1-5])\s*\|([^|]*)\|/.exec(line);
    if (!m) continue;
    rows.push({ level: Number(m[1]), label: (m[2] as string).replaceAll("`", "").trim() });
  }
  if (rows.length !== 5) {
    throw new Error(`the assurance ladder table yielded ${rows.length} levels, not 5`);
  }
  return rows;
}
