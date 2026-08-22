import {
  EXTERNAL_CSRF_HEADER, externalSecurityHeaders, newCspNonce,
} from "../../../src/lib/external-link";

export const runtime = "nodejs";
// The shell is a constant document plus a per-request nonce. Nothing about it
// may be cached or prerendered: a cached page would carry a stale nonce, and a
// prerendered one would be a page a CDN can hold.
export const dynamic = "force-dynamic";

/**
 * `external.review_shell` — GET /external/review
 * (technical/openapi/scope-v0.1.csv:55; query, natural idempotency, PUBLIC
 * plane, request contract «none (HTML shell; fragment never sent)»).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS HANDLER TOUCHES NO DATABASE. THAT IS THE WHOLE OF INV-010.
 *
 * «Email prefetch or ordinary GET never consumes or activates the bearer
 * token», enforced by «fragment-only delivery plus deliberate POST exchange;
 * GET handlers perform no grant mutation». There is no import of
 * `@goproceed/database` in this file and no query anywhere in it.
 *
 * The handler also reads NOTHING from the URL. Not `searchParams`, not the path.
 * A caller who puts a token in the query string gets a shell that ignores it,
 * and the token they leaked is a token nothing here can consume.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT «DELIBERATE POST» MEANS, AND WHAT IT USED TO MEAN — 2026-08-08
 *
 * WHAT WAS TRUE. Until this date the script below exchanged the token the
 * instant it parsed: the IIFE read `location.hash` and POSTed with no user
 * action in between. Against the threat model INV-010 was written for — a
 * server-side fetcher: an email scanner that issues a plain GET, a link-preview
 * generator, a CDN prefetch, an uptime check — that is airtight and REMAINS SO.
 * None of them ever receives the fragment, because a browser does not transmit
 * one; the header used to say «none of them can burn the grant» and, for a
 * fetcher, it still cannot.
 *
 * WHAT WAS NOT TRUE. The next threat model up is a scanner that renders and
 * EXECUTES: Microsoft Defender for Office 365 Safe Links and Proofpoint URL
 * Defense open links in a real browser, and the URL they open carries the
 * fragment because a rewritten URL keeps it. That browser ran this script, and
 * this script POSTed. A corporate mail gateway therefore consumed the технагляд's
 * single-use grant somewhere between «sent» and «read», and what the технагляд
 * then saw was `EXTERNAL_SHARE_INVALID` — the same generic refusal a revoked
 * link produces, so neither they nor the foreman who sent it could tell a
 * scanner from a revocation. `apps/app/tests/m5-external.int.test.ts:391` models
 * the fetcher and only the fetcher; nothing modelled the browser.
 *
 * WHAT CHANGED. The exchange now runs from a click handler and from nowhere
 * else. On load the page shows one button and consumes nothing; the token is
 * held in a closure variable, having been taken out of the address bar first,
 * and is spent only when a person taps.
 *
 * WHAT THAT COSTS, WEIGHED RATHER THAN WAVED AT. It is one extra tap for a
 * технагляд standing on a site holding a phone, on a screen that can say nothing
 * useful yet — there is no session, so there is nothing to show but the button.
 * That is real friction on the one surface an outside professional judges this
 * product by, and it was weighed against the alternative: a link that is dead on
 * arrival for every recipient behind a rendering gateway, with a message that
 * blames the link. A tap costs a second; a burnt grant costs a phone call, a
 * reissue, and the reviewer's belief that the system works. THE TAP WINS, and it
 * is the only defence available at this layer — a heuristic (pointer movement, a
 * dwell timer, `visibilityState`) is a race a detonation sandbox wins, and there
 * is no server-side signal that separates the two browsers.
 *
 * WHAT IT DOES NOT STOP, SAID PLAINLY: a sandbox that clicks. `event.isTrusted`
 * is checked below and eliminates `element.click()` from an injected script, but
 * a CDP-driven click is trusted and indistinguishable. A gateway that clicks
 * every button on every page still burns the grant. The next defence up is
 * making the grant survive one hostile exchange — a second single-use token, or
 * an issue-time «this link was opened by a machine» observation — and that is a
 * protocol change with an ADR in front of it, not an edit to this file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A RELOAD NO LONGER KILLS THE PAGE — 2026-08-08
 *
 * The fragment is stripped from the address bar before anything else, so any
 * reload of this URL arrives without a token. Until this date that produced the
 * dead-link message even though the session cookie in the same browser was
 * live, which meant a backgrounded tab that iOS Safari discarded and reloaded
 * read as a revoked link. A tokenless load now RESUMES: it asks
 * `GET /external/occurrence`, which consumes nothing and mutates no grant, and
 * renders the scope if the cookie still resolves.
 *
 * A RESUMED PAGE IS READ-ONLY, AND SAYS SO. The synchronizer token is returned
 * once, by the exchange, and lives only in memory (INV-058); a reload loses it
 * and `GET /external/occurrence` does not carry a replacement — its response
 * contract has no such field, and inventing one here would be inventing a
 * contract. So a resumed reviewer can read the obligation and read whether a
 * decision is recorded against it, and must ask for a new link to decide. That
 * is a REAL GAP and it is stated on screen rather than discovered at the moment
 * the button fails.
 *
 * THE SAME READ IS WHAT ANSWERS «DID MY DECISION LAND». A submit whose response
 * is lost leaves this page unable to say what happened, and INV-007's replay
 * cannot tell it either — the submit rotates the session last, so the retry is
 * refused before it reaches the idempotent branch
 * (`occurrence-decisions/route.ts` §"INV-007's replay is unreachable"). What
 * this page does instead is offer «Перевірити стан», which re-reads the scope:
 * `decision.byThisGrant` is true exactly when the current head was written
 * through this link, so the reviewer learns the outcome from a GET that mutates
 * nothing. It is a mitigation on the client and NOT a fix — the fix is the
 * policy change that route names — and it is written here so the next reader
 * does not mistake one for the other.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `history.replaceState` runs BEFORE any network call and before any rendering,
 * so the token is out of the address bar, out of the back/forward history and
 * out of anything a screenshot or a screen share would capture, before the page
 * has done anything else. It now also runs long before the token is SPENT, which
 * is the one ordering this file must never lose:
 *
 *     → fragment remains client-side and is absent from the HTTP request
 *     → shell reads it and immediately calls history.replaceState
 *     → THE PERSON TAPS
 *     → POST /external/exchange with the raw token in a redacted body
 *     → atomic grant validation/consumption and session creation
 *     → render only the exact review scope
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY STRING THE REVIEWER READS IS RENDERED WITH `textContent`.
 *
 * The acceptance criterion and the normative reference are ДБН text that came
 * out of a database; the reviewer's own claims are echoed back to them. Nothing
 * on this page is ever assigned to `innerHTML`. The CSP would already stop an
 * injected `<script>` — `script-src 'nonce-…'` with no `'unsafe-inline'` — but a
 * page that relies on its CSP to be safe is a page that becomes unsafe when
 * somebody adds a hash source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS SHELL IS NOT. It is a functional review surface and not a designed
 * one: no framework, no external stylesheet, no fonts — the CSP forbids them
 * from anywhere but this origin, and inlining a design system would put
 * kilobytes of unreviewed markup on the one page an outside professional judges
 * this product by. `docs/product/` owns that decision and has not taken it;
 * migration 0049 §11 item 6 records that `technical/copy-catalog.csv` carries no
 * row for any of these strings, and the six strings the gate and the resume
 * notice add on 2026-08-08 have no row either.
 *
 * «NO IMAGES» WAS IN THAT LIST AND IS NOT ANY MORE — 2026-08-22, Plan D slice
 * D1. There is exactly one kind of image on this page: the evidence
 * photographs themselves, each a same-origin `GET /external/evidence?…` the
 * CSP's own `img-src 'self'` already admitted. That is not a design import and
 * it is not decoration — it is the material the reviewer is being asked to
 * judge, and the acceptance walk («reads the requirement in the standard's own
 * wording WITH THE PHOTO») fails without it. The list above still holds for
 * everything else.
 *
 * IT HAS BEEN EXECUTED SINCE 2026-08-22, and the previous paragraph — «this
 * page has never been served, never been opened in a browser, and the exchange
 * it performs has never run» — is retracted rather than edited, because it was
 * load-bearing: every claim in this header used to be unverified. What now
 * exercises it is `apps/app/qa/field.mjs`'s seventh audit, which opens a real
 * link in a SECOND browser context holding no cookies, taps the gate, and
 * asserts the photo decoded (`naturalWidth > 0`) — so the exchange, the
 * fragment strip, the session cookie and the byte stream have all run in a
 * real browser. What is still unexercised there is the DECIDE path: that audit
 * issues a view-only grant, so `submit()` below has still never been pressed.
 */
export async function GET(): Promise<Response> {
  const nonce = newCspNonce();
  return new Response(shell(nonce), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...externalSecurityHeaders(nonce),
    },
  });
}

function shell(nonce: string): string {
  // The CSRF header name is interpolated from the one constant that also
  // defines it server-side, so the two cannot drift.
  const csrfHeader = EXTERNAL_CSRF_HEADER;
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Перевірка вимоги</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 1rem;
         max-width: 44rem;
         /* MEASURED, NOT GUESSED — 2026-08-22. The first browser screenshot
            this page has ever produced (qa/field.mjs's seventh audit, at
            375px) showed the normative reference running off the right edge
            and taking the document's horizontal scroll with it: a ДБН
            citation ends in a URL and a 64-character sha256, and neither
            contains a break opportunity. The field client's own obligation
            screen already carries this exact fix for this exact string, on
            the argument that a regulatory citation which cannot be read on
            the device it is for is not really rendered. 'anywhere' rather
            than 'break-word' because only the former also shrinks the
            element's min-content width, which is what stops the SCROLL as
            opposed to merely wrapping the text. The audit now asserts no
            sideways scroll on this page, so this cannot silently regress. */
         overflow-wrap: anywhere; }
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1rem; margin-top: 1.5rem; }
  .muted { opacity: .75; font-size: .875rem; }
  .box { border: 1px solid currentColor; border-radius: .5rem; padding: .75rem;
         margin: .75rem 0; }
  .assurance { border-style: dashed; }
  label { display: block; margin: .5rem 0 .25rem; font-weight: 600; }
  textarea, input { width: 100%; box-sizing: border-box; font: inherit;
                    padding: .4rem; }
  button { font: inherit; padding: .5rem 1rem; margin-right: .5rem;
           min-height: 2.75rem; }
  /* The gate is tapped once, on a phone, possibly in gloves. */
  button.wide { width: 100%; margin: .5rem 0 0; font-size: 1.0625rem;
                padding: .9rem 1rem; }
  ul { padding-left: 1.25rem; }
  li + li { margin-top: 1rem; }
  .fact { margin: 0; }
  /* A photograph of a wall of conduit, read on a phone on site. 'max-width'
     because a 4000px original must not take the document's horizontal scroll
     with it; 'height: auto' so it is never distorted; no fixed aspect ratio,
     because cropping evidence is not this page's decision to make. */
  .evidence-image { display: block; margin: .5rem 0 0; max-width: 100%;
                    height: auto; border: 1px solid currentColor;
                    border-radius: .25rem; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1 id="heading">Перевірка вимоги</h1>
  <p id="status" role="status">Відкриваємо посилання…</p>
  <noscript>
    <p>Для перевірки потрібен увімкнений JavaScript. Відкрийте посилання
       у звичайному браузері.</p>
  </noscript>

  <section id="gate" hidden>
    <div class="box">
      <p>Це посилання відкриває одну вимогу для перевірки. Воно одноразове:
         відкрити його можна один раз, тому натисніть кнопку нижче, коли будете
         готові переглянути вимогу.</p>
      <p class="muted">Не пересилайте це посилання іншим.</p>
      <button type="button" id="open" class="wide">Відкрити вимогу</button>
    </div>
  </section>

  <section id="scope" hidden>
    <div class="box">
      <h2>Вимога</h2>
      <p id="criterion"></p>
      <p class="muted" id="norm"></p>
      <p class="muted" id="meta"></p>
    </div>

    <div class="box">
      <h2>Матеріали</h2>
      <ul id="evidence"></ul>
      <p class="muted" id="evidence-note"></p>
    </div>

    <div class="box" id="current" hidden>
      <h2>Поточне рішення</h2>
      <p id="current-text"></p>
    </div>

    <div class="box assurance">
      <p id="assurance-level"></p>
      <p id="assurance-not-signature"></p>
    </div>

    <form id="decide" hidden>
      <h2>Ваше рішення</h2>
      <label for="name">Імʼя</label>
      <input id="name" autocomplete="off">
      <label for="company">Компанія</label>
      <input id="company" autocomplete="off">
      <label for="title">Посада</label>
      <input id="title" autocomplete="off">
      <label for="reason">Причина (обовʼязково для повернення)</label>
      <textarea id="reason" rows="4"></textarea>
      <p id="confirmation" class="muted"></p>
      <p>
        <button type="button" id="accept">Прийняти</button>
        <button type="button" id="return">Повернути на доопрацювання</button>
      </p>
    </form>
    <p id="observer" class="muted" hidden>
      Це посилання надано лише для перегляду.
    </p>
    <p id="already" class="muted" hidden>
      За цим посиланням рішення вже зафіксовано — воно показане вище.
    </p>
    <p id="readonly" class="muted" hidden>
      Сторінку відкрито повторно, тому зафіксувати рішення тут уже не можна:
      вище показано вимогу та поточний стан рішення. Щоб прийняти або повернути,
      попросіть надіслати нове посилання.
    </p>
    <p id="recheck-wrap" hidden>
      <button type="button" id="recheck">Перевірити стан</button>
    </p>
  </section>

  <section id="receipt" hidden>
    <h2>Квитанція</h2>
    <p id="receipt-text"></p>
    <p class="muted" id="receipt-assurance"></p>
  </section>
</main>

<script nonce="${nonce}">
  /* NO BACKTICKS BELOW THIS LINE. Everything from here to </html> is inside a
     template literal, so a backtick in a COMMENT closes it and the browser JS
     that follows is parsed as TypeScript. Six comments did exactly that and
     tsc reported it as six unrelated syntax errors. Quote identifiers with ' . */
(function () {
  "use strict";

  // ── STEP 1: take the token out of the URL, before anything else ───────────
  // Not after the fetch, not after rendering: the address bar, the session
  // history and anything that reads either must never hold it for longer than
  // this statement takes. It runs before the gate is even shown, so the token
  // is out of the URL for the whole time the page sits waiting to be tapped.
  var token = window.location.hash.replace(/^#/, "");
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch (e) { /* a browser that refuses is a browser we still must not feed */ }

  var el = function (id) { return document.getElementById(id); };
  var say = function (text) {
    el("status").textContent = text;
    el("status").hidden = text === "";
  };
  var csrf = null;
  var scope = null;
  var exchanging = false;

  var DEAD = "Це посилання більше не дійсне. Попросіть надіслати нове.";

  var post = function (path, body, extra) {
    var headers = { "content-type": "application/json" };
    if (extra) { for (var k in extra) { headers[k] = extra[k]; } }
    return fetch(path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: headers,
      body: JSON.stringify(body)
    });
  };

  var readScope = function () {
    return fetch("/external/occurrence", {
      credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer"
    }).then(function (r) {
      if (!r.ok) { throw new Error("invalid"); }
      return r.json();
    });
  };

  var dead = function () { hideAll(); say(DEAD); };

  function hideAll() {
    el("gate").hidden = true;
    el("scope").hidden = true;
    el("receipt").hidden = true;
  }

  // ── STEP 2: the gate, or the resume ───────────────────────────────────────
  // A token means «this browser was handed a link»: show the button and spend
  // NOTHING until a person taps it. No token means either a reload after the
  // fragment was stripped or a bare visit; the first deserves its page back and
  // the second gets the same dead-link message it always got, because
  // 'GET /external/occurrence' without a live cookie is a 404.
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    say("");
    el("gate").hidden = false;
    el("open").addEventListener("click", openLink);
  } else {
    token = null;
    say("Відновлюємо сеанс…");
    readScope().then(render).catch(dead);
  }

  function openLink(ev) {
    // A synthetic click — 'element.click()' from an injected script, or a
    // headless driver that dispatches an untrusted event — is not a person.
    // It does not stop a CDP-driven click, which is trusted; it is one line and
    // it removes the cheapest automation.
    if (ev && ev.isTrusted === false) { return; }
    // A double tap on a phone must not send two exchanges: the second would be
    // refused as a replay and would tell the reviewer their live link is dead.
    if (exchanging) { return; }
    exchanging = true;
    el("open").disabled = true;
    say("Відкриваємо вимогу…");

    // Once the server has ANSWERED, the grant is spent whatever it answered, so
    // the button must not come back. Only a request that never reached it — a
    // dropped connection, a tunnel that died — leaves the token worth another
    // tap.
    var answered = false;
    post("/external/exchange", { token: token })
      .then(function (r) {
        answered = true;
        // The token is dropped here and is never read again. It is not stored in
        // a variable that outlives this chain, not put in localStorage or
        // sessionStorage, and not written into the DOM.
        token = null;
        if (!r.ok) { throw new Error("invalid"); }
        return r.json();
      })
      .then(function (session) {
        csrf = session.csrfToken;
        return readScope();
      })
      .then(function (data) {
        el("gate").hidden = true;
        render(data);
      })
      .catch(function () {
        if (answered) { dead(); return; }
        exchanging = false;
        el("open").disabled = false;
        say("Не вдалося звʼязатися з сервером. Спробуйте натиснути ще раз.");
      });
  }

  // THE FORM IS SHOWN WHERE IT CAN WORK AND NOWHERE ELSE, and «can work» is one
  // condition: this page holds a synchronizer token. A resumed page does not —
  // the token is returned once, by the exchange, and lives only in memory
  // (INV-058) — so it renders read-only and says why, rather than offering a
  // button that would fail its CSRF check.
  function render(data) {
    scope = data;
    say("");
    el("scope").hidden = false;
    el("receipt").hidden = true;

    var o = data.occurrence;
    el("criterion").textContent = o.acceptanceCriterion;
    if (o.normRef) {
      // The tag and the source travel WITH the string, always. A normative
      // string displayed without them is the thing INV-073 and the content
      // rules' architectural requirement forbid.
      el("norm").textContent = o.normRef.text + " — " + o.normRef.verification
        + " — " + o.normRef.source;
      el("norm").hidden = false;
    } else {
      el("norm").textContent = "";
      el("norm").hidden = true;
    }
    el("meta").textContent = "Етап: " + o.stageKey + " · вид доказу: " + o.evidenceKind
      + " · роль виконавця: " + o.performerRole + " · роль затверджувача: " + o.approverRole
      + " · мінімум матеріалів: " + o.minEvidenceCount;

    var list = el("evidence");
    // Emptied first: this function runs again on a re-check, and a list that
    // appended would show every material twice.
    list.textContent = "";
    for (var i = 0; i < data.evidence.length; i++) {
      var e = data.evidence[i];
      var li = document.createElement("li");
      var facts = document.createElement("p");
      facts.className = "fact";
      // «claimed» is in the text because it is a CLAIM: origin method and
      // capture time are client-supplied metadata and are labelled as such
      // (tenancy-and-security.md §"Capability evaluation").
      facts.textContent = e.mediaType + " · " + e.byteSize + " Б · SHA-256 "
        + e.contentHash.slice(0, 16) + "… · отримано сервером " + e.serverReceivedAt
        + " · заявлений спосіб: " + e.originMethod
        + (e.claimedCaptureTime ? " · заявлений час зйомки: " + e.claimedCaptureTime : "");
      li.appendChild(facts);
      // ── THE PHOTO ITSELF — added 2026-08-22, Plan D slice D1 task 7 ──────
      //
      // A SAME-ORIGIN IMG AND NOT A SIGNED URL, and that is the page's own CSP
      // deciding rather than a preference: 'externalSecurityHeaders' serves
      // this document with "default-src 'none'; … img-src 'self' data:", so a
      // Supabase-hosted signed URL is blocked before a byte is requested and a
      // path on this origin is admitted. 'GET /external/evidence' streams the
      // bytes for exactly this reason (see that route's header).
      //
      // THE ID IS NOT A NEW DISCLOSURE. 'evidenceObjectId' is already in the
      // response this function is rendering — 'GET /external/occurrence'
      // returns it per object — so the src names something the session was
      // already told exists, and the stream re-checks the grant, the session
      // and the occurrence for itself on every request.
      //
      // IMAGES ONLY, checked on the SERVER-SNIFFED 'mediaType'. The other
      // recognised type is 'application/pdf', which an img element cannot
      // render: pointing one at it would produce a broken-image icon where a
      // file exists, which is worse than the identity line this list already
      // shows. Nothing in this repository produces anything but 'image/jpeg'
      // today (every capture route sniffs and every rule's allowedMedia names
      // it), so the else-branch is latent — and the note below says what it
      // means rather than leaving the reader to infer it from a missing
      // picture.
      if (typeof e.mediaType === "string" && e.mediaType.indexOf("image/") === 0) {
        var img = document.createElement("img");
        img.className = "evidence-image";
        img.loading = "lazy";
        // 'alt' is the filename the DEVICE claimed, or a neutral fallback —
        // never a description this page invented of a photo it cannot see.
        img.alt = e.originalFilename || "Фото доказу";
        img.src = "/external/evidence?evidenceObjectId="
          + encodeURIComponent(e.evidenceObjectId);
        li.appendChild(img);
      }
      list.appendChild(li);
    }
    if (data.evidence.length === 0) {
      el("evidence-note").textContent = "Матеріалів не зафіксовано.";
    } else {
      // CORRECTED 2026-08-22. What stood here — «Перегляд самих файлів у цій
      // версії недоступний: показано лише їхні ідентифікатори та контрольні
      // суми.» — was true when it was written and became false the moment
      // 'GET /external/evidence' shipped. Leaving it would have told a
      // технагляд that the photo above them does not exist, and the acceptance
      // walk this whole arc is for («reads the requirement in the standard's
      // own wording WITH THE PHOTO») would have been refused by the page's own
      // copy while the bytes were already on screen.
      el("evidence-note").textContent =
        "Зображення завантажуються за цим посиланням. Файли інших типів показано "
        + "лише за ідентифікатором і контрольною сумою.";
    }

    if (data.decision) {
      el("current").hidden = false;
      el("current-text").textContent =
        (data.decision.currentOutcome === "accepted" ? "Прийнято" : "Повернуто")
        + " · рішення № " + data.decision.decisionNo + " · " + data.decision.decidedAt;
    } else {
      el("current").hidden = true;
    }

    el("assurance-level").textContent = data.assurance.levelStatement;
    el("assurance-not-signature").textContent = data.assurance.notASignature;

    el("decide").hidden = true;
    el("observer").hidden = true;
    el("already").hidden = true;
    el("readonly").hidden = true;
    el("recheck-wrap").hidden = true;
    if (!data.permissions.mayDecide) {
      el("observer").hidden = false;
    } else if (data.decision && data.decision.byThisGrant === true) {
      // THE ANSWER TO «did my decision land». 'byThisGrant' says the current
      // head was written through THIS grant, so a reviewer whose response was
      // lost gets their receipt's substance back from a read that mutates
      // nothing — which is the only recovery available while the replay branch
      // below the fold in 'occurrence-decisions/route.ts' stays unreachable.
      el("already").hidden = false;
    } else if (csrf !== null) {
      el("decide").hidden = false;
      el("confirmation").textContent = data.confirmationText;
    } else {
      el("readonly").hidden = false;
    }
  }

  function submit(outcome) {
    var reason = el("reason").value.trim();
    if (outcome === "returned" && reason.length === 0) {
      say("Повернення має містити причину.");
      return;
    }
    var claims = {};
    ["name", "company", "title"].forEach(function (k) {
      var v = el(k).value.trim();
      if (v.length > 0) { claims[k] = v; }
    });
    var headers = { "idempotency-key": idempotencyKey() };
    headers["${csrfHeader}"] = csrf;
    var body = {
      outcome: outcome,
      issues: [],
      expectedVersion: scope.decision ? scope.decision.headVersion : null,
      reviewerClaims: claims,
      confirmationTextVersion: scope.confirmationTextVersion
    };
    if (reason.length > 0) { body.reason = reason; }

    el("decide").hidden = true;
    say("Фіксуємо рішення…");
    post("/external/occurrence-decisions", body, headers)
      .then(function (r) { if (!r.ok) { throw new Error("refused"); } return r.json(); })
      .then(function (receipt) {
        csrf = receipt.csrfToken;
        el("scope").hidden = true;
        el("receipt").hidden = false;
        say("");
        el("receipt-text").textContent =
          (receipt.outcome === "accepted" ? "Прийнято" : "Повернуто")
          + " · квитанція " + receipt.receiptId
          + " · зафіксовано сервером " + receipt.serverReceivedAt;
        el("receipt-assurance").textContent =
          scope.assurance.levelStatement + " " + scope.assurance.notASignature;
      })
      .catch(function () {
        // THE HONEST MESSAGE, and it replaced a wrong one on 2026-08-08.
        //
        // What it used to say was «оновіть сторінку за посиланням із листа»,
        // which is advice that cannot work: the link in the letter carries a
        // grant this session already consumed, so following it produces the
        // dead-link message. And a submit that failed AFTER the server committed
        // has already rotated this session — the cookie the browser holds was
        // revoked in the same transaction — so a retry is not reliably
        // available either ('occurrence-decisions/route.ts' §"INV-007's replay
        // is unreachable" states the whole of it).
        //
        // What the reviewer can always do is ASK, which is a GET that mutates
        // nothing: if the decision landed, «Поточне рішення» will show it.
        el("recheck-wrap").hidden = false;
        say("Не вдалося отримати відповідь. Ваше рішення могло бути зафіксоване — "
            + "натисніть «Перевірити стан».");
      });
  }

  // One key per attempt, so a retry after a network failure REPLAYS rather than
  // decides twice (INV-007). It is regenerated only when the reviewer changes
  // their input, which they cannot do after a successful submit because the form
  // is gone.
  //
  // WHAT THIS KEY CANNOT DO TODAY, so that nobody reads it as a guarantee: the
  // replay it is the key TO is unreachable while the submit rotates the session
  // last. The key is still correct and still cheap, and it becomes load-bearing
  // the day 'edb_external_select' follows the rotation lineage.
  var currentKey = null;
  function idempotencyKey() {
    if (currentKey === null) {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      currentKey = Array.prototype.map.call(b, function (x) {
        return ("0" + x.toString(16)).slice(-2);
      }).join("");
    }
    return currentKey;
  }

  el("accept").addEventListener("click", function () { submit("accepted"); });
  el("return").addEventListener("click", function () { submit("returned"); });
  // A GET, and nothing else. It re-reads the scope the reviewer already has and
  // re-renders it — so if the decision landed, «Поточне рішення» and the
  // «вже зафіксовано» line appear; if it did not, and this page still holds its
  // synchronizer token, the form comes back with THE SAME Idempotency-Key.
  el("recheck").addEventListener("click", function () {
    say("Перевіряємо…");
    readScope().then(render).catch(dead);
  });
})();
</script>
</body>
</html>`;
}
