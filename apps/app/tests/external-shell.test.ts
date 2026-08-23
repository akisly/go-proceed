import { describe, it, expect } from "vitest";

/**
 * «NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, and
 * no claim is made that any assertion below passes. Static reading is the only
 * check that was available.» — RETRACTED 2026-08-22 (Plan D slice D1 final fix
 * wave). It runs in the app suite and passes: 17 tests in this file, verified
 * by running it on its own as well as inside the full run. The claim was
 * already false when the D1 slice began; it was carried into this wave from the
 * Task 6 controller note that flagged it.
 *
 * ---------------------------------------------------------------------------
 * THE REVIEW SHELL AS A DOCUMENT — the gesture, and the ids it renders through.
 *
 * NOT an integration test, and named `.test.ts` rather than `.int.test.ts` for
 * that reason: `external.review_shell` touches no database, so this file opens
 * no connection and truncates nothing. It is the unit half of what
 * `m5-external.int.test.ts` §"INV-010" proves against a live grant.
 *
 * WHAT IT IS FOR. On 2026-08-08 the exchange moved from «on load» to «on a
 * click», because a JavaScript-executing mail-security scanner — Defender Safe
 * Links, Proofpoint URL Defense — opens the link in a real browser with the
 * fragment intact, and the auto-exchange handed it the технагляд's single-use
 * grant. `m5-external.int.test.ts:391` models a scanner that issues a plain GET
 * and therefore cannot burn anything; nothing modelled the one that runs the
 * script. This file is that model, and it is a STRING model: it reads the
 * served document, because there is no DOM in this test environment and adding
 * one for a page with two buttons would be a dependency in exchange for a
 * simulation.
 *
 * WHAT A STRING MODEL CANNOT DO, said before it is mistaken for more: it does
 * not run the script. «The exchange is inside the click handler» is asserted as
 * a property of the SOURCE LAYOUT — one call site, positioned between the
 * handler's declaration and the next function's. A rewrite that moved the call
 * into a helper called from the top level would keep the call site count at one
 * and would have to be caught by reading, or by a browser test this project
 * does not have. It is still worth having: the specific regression it stops is
 * the specific defect that shipped.
 */

async function shellHtml(): Promise<{ res: Response; html: string }> {
  const { GET } = await import("../app/external/review/route");
  const res = await GET();
  return { res, html: await res.text() };
}

const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

describe("external.review_shell — the exchange needs a person", () => {
  it("has exactly one exchange call site and it sits inside the click handler", async () => {
    const { html } = await shellHtml();

    // ONE call site. Two would mean one of them is somewhere this file has not
    // read.
    expect(occurrences(html, "/external/exchange")).toBe(1);

    const handler = html.indexOf("function openLink(");
    const call = html.indexOf('post("/external/exchange"');
    // `render` is the next function declared after the handler, so the call
    // being between them is the call being inside the handler, given the
    // layout. The layout is asserted first, so a reordering fails HERE, with a
    // legible message, rather than making the containment check meaningless.
    const next = html.indexOf("function render(");
    expect(handler).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(handler);
    expect(call).toBeGreaterThan(handler);
    expect(call).toBeLessThan(next);
  });

  it("binds that handler to a click and to nothing else", async () => {
    const { html } = await shellHtml();
    expect(html).toContain('el("open").addEventListener("click", openLink)');
    // The handler must not also be invoked. `openLink(` appears twice: the
    // declaration and the reference passed to addEventListener — never as a
    // call with parentheses of its own.
    expect(occurrences(html, "openLink(")).toBe(1);
    expect(occurrences(html, "openLink)")).toBe(1);
  });

  it("refuses a synthetic click and a second tap", async () => {
    const { html } = await shellHtml();
    // `element.click()` from an injected script produces isTrusted false. It is
    // not a defence against a CDP-driven sandbox and the route header says so;
    // it is a defence against the cheapest automation there is.
    expect(html).toContain("ev.isTrusted === false");
    // A double tap on a phone must not send two exchanges: the second is a
    // replay, the replay is refused, and the reviewer would be told their live
    // link is dead.
    expect(html).toContain("if (exchanging) { return; }");
    expect(html).toContain('el("open").disabled = true');
  });

  it("still strips the fragment before anything else, and now long before it spends it", async () => {
    const { html } = await shellHtml();
    const strip = html.indexOf("history.replaceState");
    expect(strip).toBeGreaterThan(-1);
    expect(strip).toBeLessThan(html.indexOf("/external/exchange"));
    expect(strip).toBeLessThan(html.indexOf("/external/occurrence"));
    // The token is read from the fragment and from nowhere else: a shell that
    // read `location.search` would be a shell that accepts a token an email
    // scanner DOES transmit.
    expect(html).toContain("window.location.hash");
    expect(html).not.toContain("location.search");
    expect(html).not.toContain("searchParams");
  });

  it("shows a gate the reviewer can find, hidden until the script reveals it", async () => {
    const { html } = await shellHtml();
    expect(html).toContain('<section id="gate" hidden>');
    expect(html).toContain('id="open"');
    expect(html).toContain("Відкрити вимогу");
    // One tap, on a phone, and the тап target is the width of the page. This is
    // the friction the route header weighs against a burnt grant; a 12-pixel
    // link would be a worse trade than the one that was argued for.
    expect(html).toContain("button.wide");
    expect(html).toContain("min-height: 2.75rem");
    // A scanner that renders without executing sees this and no button at all.
    expect(html).toContain("<noscript>");
  });

  it("exports no POST, so there is nowhere for an exchange to move back to", async () => {
    const mod = await import("../app/external/review/route");
    // Next.js answers an unexported method with 405 from the framework, before
    // any code in the file runs. The absence is the defence, so the absence is
    // what is asserted — `Object.keys` rather than a cast, because a cast that
    // silences the type is a cast that would also silence a rename.
    expect(Object.keys(mod)).toContain("GET");
    expect(Object.keys(mod)).not.toContain("POST");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});

describe("external.review_shell — the resume, and what it may not become", () => {
  it("resumes with a GET when there is no token, and never with an exchange", async () => {
    const { html } = await shellHtml();
    // The tokenless branch reads the scope and renders it. It cannot consume a
    // grant: `GET /external/occurrence` performs no grant mutation, which is
    // the same sentence INV-010 makes about this page.
    expect(html).toContain('readScope().then(render).catch(dead)');
    expect(occurrences(html, '"/external/occurrence"')).toBe(1);
  });

  it("does not offer a decision it cannot submit", async () => {
    const { html } = await shellHtml();
    // The synchronizer token is returned once, by the exchange, and lives in
    // memory only. A resumed page has none, so the form stays hidden and the
    // reason is on the page.
    expect(html).toContain("} else if (csrf !== null) {");
    expect(html).toContain('id="readonly"');
    expect(html).toContain("попросіть надіслати нове посилання");
  });

  it("tells a reviewer whose submit was lost how to find out what happened", async () => {
    const { html } = await shellHtml();
    // INV-007's replay is unreachable while the submit rotates the session last
    // (`occurrence-decisions/route.ts`). This is the client-side substitute and
    // it is a read: `decision.byThisGrant` is true exactly when the head was
    // written through this link.
    expect(html).toContain("byThisGrant === true");
    expect(html).toContain('id="recheck"');
    expect(html).toContain("Перевірити стан");
    // The advice it replaced could not work — the link in the letter carries a
    // grant this session already consumed.
    expect(html).not.toContain("Оновіть сторінку за посиланням із листа");
  });
});

describe("external.review_shell — every string is text and every id resolves", () => {
  it("never assigns innerHTML, anywhere", async () => {
    const { html } = await shellHtml();
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("insertAdjacentHTML");
    expect(html).not.toContain("document.write");
  });

  it("resolves every getElementById against an id the document actually has", async () => {
    const { html } = await shellHtml();
    const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
    const used = new Set([...html.matchAll(/el\("([^"]+)"\)/g)].map((m) => m[1]!));
    // A typo here is a `null.textContent` at run time, on the one page an
    // outside professional judges this product by — and it is invisible to
    // every check this project has, because the page is never rendered.
    expect([...used].filter((id) => !declared.has(id)).sort()).toEqual([]);
    // The three inputs are read through a loop rather than through `el(…)`, so
    // they are checked by name.
    for (const id of ["name", "company", "title"]) expect(declared.has(id)).toBe(true);
  });

  it("loads nothing off-origin and asks for no third party", async () => {
    const { res, html } = await shellHtml();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).not.toMatch(/src=["']https?:\/\//);
    expect(html).not.toMatch(/href=["']https?:\/\//);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    // The gate added markup and no capability: still one nonced inline script,
    // still no font, frame or style from anywhere. IMAGES ARE NO LONGER IN
    // THAT SENTENCE — see the describe below: this page now loads the evidence
    // photographs themselves, from THIS origin, under the `img-src 'self'` the
    // CSP already carried. The two assertions above are what keep that honest:
    // no `src=` or `href=` naming a scheme and a host appears anywhere in the
    // document, so the one image source is same-origin by construction.
    expect(occurrences(html, "<script")).toBe(1);
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
  });
});

/**
 * THE PHOTO — Plan D slice D1 task 7. `GET /external/evidence` shipped in task
 * 4 and, until this change, nothing called it: the shell told the reviewer in
 * so many words that the files could not be viewed, while the stream that
 * serves them was already deployed beside it. These assertions are the string
 * model of the fix; the browser half — that the bytes actually decode in a
 * cookie-less context — is `qa/field.mjs`'s seventh audit, and neither
 * replaces the other.
 */
describe("external.review_shell — the evidence photographs", () => {
  it("builds one same-origin src against the byte route, with no scheme and no host", async () => {
    const { html } = await shellHtml();
    expect(occurrences(html, "/external/evidence?evidenceObjectId=")).toBe(1);
    // A CSP binds what it is served on. `img-src 'self'` admits a path on this
    // origin and refuses a Supabase-hosted signed URL outright — which is why
    // the external plane STREAMS while the member plane signs, and why an
    // absolute URL creeping in here would be a broken image rather than a
    // slower one.
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*\/external\/evidence/);
  });

  it("puts the id through encodeURIComponent rather than concatenating it raw", async () => {
    const { html } = await shellHtml();
    expect(html).toContain('encodeURIComponent(e.evidenceObjectId)');
  });

  it("renders an image only for a server-sniffed image/ media type", async () => {
    const { html } = await shellHtml();
    // `application/pdf` is the other recognised type and an <img> cannot show
    // it: a broken-image icon where a file exists is worse than the identity
    // line the list already carries. The guard is on `mediaType`, which
    // `evidence-inspection.ts` measured from the bytes at finalize — never on
    // a filename, and never on anything the client declared.
    expect(html).toContain('e.mediaType.indexOf("image/") === 0');
  });

  it("no longer tells the reviewer the files cannot be viewed", async () => {
    const { html } = await shellHtml();
    // The sentence this replaces was true when it was written and false the
    // moment task 4 shipped. Pinned as an ABSENCE so it cannot come back by a
    // revert that looks like a copy edit.
    expect(html).not.toContain("Перегляд самих файлів у цій версії недоступний");
    expect(html).toContain("Зображення завантажуються за цим посиланням");
  });

  it("still assigns every reviewer-visible string as text, the image included", async () => {
    const { html } = await shellHtml();
    // `alt` comes from `originalFilename`, which is device-supplied. It is set
    // as a PROPERTY on an element the script created, never interpolated into
    // markup — the same rule the rest of this page follows, restated because
    // this is the first attribute on this page that carries client data.
    expect(html).toContain("img.alt = e.originalFilename");
    expect(html).not.toContain("innerHTML");
  });
});
