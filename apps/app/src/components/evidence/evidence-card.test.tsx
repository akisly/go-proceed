// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import type { EvidenceObjectView } from "@goproceed/contracts";

import { EvidenceCard, formatReceivedAt } from "./evidence-card";
import { WORKSPACE_TIMEZONE_DEFAULT } from "../../lib/workspace-time";

const KYIV = "Europe/Kyiv";

// Testing Library's own auto-cleanup only registers itself
// `if (typeof afterEach === 'function')` at import time — true only when
// vitest injects `afterEach` as a global. This project deliberately does not
// set `test.globals: true` (this file imports `describe`/`it`/`expect`/
// `afterEach` explicitly, from "vitest"), so that auto-registration never
// fires and jsdom's `document` would otherwise keep accumulating every
// previous test's rendered markup. Harmless here (one `render()` call), but
// load-bearing the moment a file renders more than once — copy this line
// along with the `// @vitest-environment jsdom` docblock whenever this
// pattern is reused.
afterEach(cleanup);

/**
 * FIX ROUND 1: the two load-bearing behaviours this file's own commit
 * shipped with no coverage at all — the `readUrl`-absent branch, and the
 * timezone bug the reviewer's own render caught that this task's §6 visual
 * pass structurally could not (a Kyiv developer machine renders the old,
 * timezone-less code correctly; only a non-Kyiv server process would have
 * shown the defect). `renderToStaticMarkup`, no DOM — the same string-model
 * approach `apps/app/tests/external-shell.test.ts` already established for
 * this repo, and the cheapest way to prove server-component JSX output
 * without adding a DOM testing dependency. No `import React` — this file's
 * own `vitest.config.ts` fix (fix round 1, same commit) sets esbuild's `jsx`
 * to `"automatic"`, matching Next's own runtime for every `.tsx` file
 * vitest touches, `EvidenceCard` included; before that fix, rendering
 * `EvidenceCard` under vitest failed with `ReferenceError: React is not
 * defined` regardless of what this test file itself imported, since the
 * classic runtime needs `React` in scope in `evidence-card.tsx`, not here.
 */

function baseItem(overrides: Partial<EvidenceObjectView> = {}): EvidenceObjectView {
  return {
    evidenceObjectId: "aaaaaaaa-0000-4000-8000-000000000001",
    mediaType: "image/jpeg",
    byteSize: 1_048_576,
    contentHash: "a".repeat(64),
    originalFilename: "IMG_0142.jpg",
    originMethod: "native_camera",
    captureTimeTrust: "device_claimed",
    claimedCaptureTime: null,
    serverReceivedAt: "2026-08-22T09:30:00.000Z",
    readUrl: "https://storage.example.test/signed/photo.jpg",
    ...overrides,
  };
}

describe("formatReceivedAt — the timezone fix", () => {
  it("formats an explicit Europe/Kyiv time, not the host process's own zone", () => {
    // 09:30 UTC in August is 12:30 in Kyiv (EEST, UTC+3) — this is exactly
    // the case the reviewer named: a server process running in UTC (Vercel's
    // runtime zone) must still show 12:30, never a bare 09:30.
    expect(formatReceivedAt("2026-08-22T09:30:00.000Z", KYIV)).toContain("12:30");
  });

  it("shows the zone on screen, so a time can never be silently misread", () => {
    expect(formatReceivedAt("2026-08-22T09:30:00.000Z", KYIV)).toMatch(/GMT[+-]\d/);
  });

  it("resolves the correct offset across Kyiv's own DST transition, not a hardcoded one", () => {
    // August (EEST, summer) is UTC+3; January (EET, winter) is UTC+2. A
    // constant offset would be wrong for half the year.
    expect(formatReceivedAt("2026-08-22T09:30:00.000Z", KYIV)).toContain("GMT+3");
    expect(formatReceivedAt("2026-01-15T09:30:00.000Z", KYIV)).toContain("GMT+2");
  });

  it("uses the modelled workspace default, named as a constant", () => {
    expect(WORKSPACE_TIMEZONE_DEFAULT).toBe("Europe/Kyiv");
  });

  it("renders the zone it is handed, not Kyiv (DEV-089, BL-034)", () => {
    const html = renderToStaticMarkup(<EvidenceCard item={baseItem()} timeZone="Europe/Warsaw" />);
    // 09:30Z in August is 11:30 in Warsaw (CEST, UTC+2), 12:30 in Kyiv.
    expect(html).toContain(formatReceivedAt("2026-08-22T09:30:00.000Z", "Europe/Warsaw"));
    expect(html).toContain("11:30");
    expect(html).not.toContain("12:30");
  });
});

describe("EvidenceCard — the readUrl-absent branch", () => {
  it("renders the unavailable copy and no <img> at all, never a broken one", () => {
    const html = renderToStaticMarkup(
      <EvidenceCard item={baseItem({ readUrl: undefined })} timeZone={KYIV} />,
    );
    expect(html).toContain("Зображення тимчасово недоступне");
    expect(html).not.toContain("<img");
  });

  it("still shows all four retyped facts when the photo itself is unavailable", () => {
    const html = renderToStaticMarkup(
      <EvidenceCard
        item={baseItem({
          readUrl: undefined,
          originMethod: "photo_picker",
          captureTimeTrust: "server_estimated",
          contentHash: "b".repeat(64),
        })}
        timeZone={KYIV}
      />,
    );
    // The four facts task-6-brief.md names — a missing photo must not also
    // hide the metadata a ПТВ still needs.
    expect(html).toContain("Отримано сервером");
    expect(html).toContain(formatReceivedAt("2026-08-22T09:30:00.000Z", KYIV));
    expect(html).toContain("Спосіб фіксації");
    expect(html).toContain("Вибір із галереї"); // originMethodLabel("photo_picker")
    expect(html).toContain("Довіра до часу");
    expect(html).toContain("Оцінка сервера"); // captureTimeTrustLabel("server_estimated")
    expect(html).toContain("Контрольна сума (SHA-256)");
    expect(html).toContain("b".repeat(64));
  });
});

describe("EvidenceCard — the readUrl-present branch", () => {
  it("renders a lazy <img> with the signed URL as its src", () => {
    const html = renderToStaticMarkup(
      <EvidenceCard item={baseItem({ readUrl: "https://storage.example.test/signed/x.jpg" })} timeZone={KYIV} />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("https://storage.example.test/signed/x.jpg");
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain("Зображення тимчасово недоступне");
  });

  // The first jsdom-backed case in this app: `renderToStaticMarkup` above
  // can only prove the string `IMG_0142.jpg` appears somewhere in the
  // markup — it would pass just as well if the filename leaked into the
  // wrong attribute, or a stray text node, or a second unrelated element.
  // `getByRole` walks jsdom's actual accessibility tree: it resolves the
  // rendered `<img>`'s IMPLICIT role and its accessible name (from `alt`)
  // the way a screen reader would, and throws if zero or more than one
  // element matches. That is a claim about rendered DOM structure a string
  // comparison cannot make.
  it("exposes the original filename as the rendered image's accessible name", () => {
    render(<EvidenceCard item={baseItem()} timeZone={KYIV} />);
    expect(screen.getByRole("img", { name: "IMG_0142.jpg" })).toBeTruthy();
  });
});
