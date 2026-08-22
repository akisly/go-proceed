"use client";

import { useState, type FormEvent } from "react";
import type { ExternalLinkDelivery } from "@goproceed/contracts";
import { Banner, Button, Field, Input } from "@goproceed/ui/components";

import { issueReviewLink } from "../../services/grants.service";

/**
 * «Відправити на перевірку» — the control that issues an external review link
 * for ONE requirement occurrence, and the last piece of Plan D slice D1's
 * loop. The stream (`GET /external/evidence`), the shell (`/external/review`)
 * and the scope read (`GET /external/occurrence`) all shipped before this
 * file; until it existed the only way to put a link in a технагляд's hands was
 * for the owner to run `POST /v1/occurrences/{id}/grants` by hand.
 *
 * ─── INV-044 IS ON THE FACE OF THE RESULT ─────────────────────────────────
 *
 * The token is returned ONCE. GoProceed stores an HMAC of it and nothing else,
 * so it cannot be reconstructed, cannot be re-shown and cannot be retried; the
 * only recovery is an authorized revoke-and-reissue
 * (`external_grants.revoke_reissue`). That is not a hint, a tooltip or a
 * hover: it is a sentence rendered directly above the link, in the same block,
 * before the reader has done anything with it. A screen that softened it would
 * be a screen that teaches ПТВ the link can be found again later, and the
 * moment they believe that is the moment a reviewer is left without one.
 *
 * ─── THE GRANT IS VIEW-ONLY, AND THE SCREEN SAYS SO ───────────────────────
 *
 * `grants.service.ts`'s `VIEW_ONLY_PERMISSIONS` carries the whole reason: a
 * deciding grant must name the occurrence's own `approver_role`, and the only
 * interface this screen consumes (`assignmentEvidenceResponse`) carries the
 * occurrence's id and nothing else. Rather than let that be discovered when a
 * reviewer opens the link and finds no accept/return control, the form states
 * it before the button is pressed.
 *
 * ─── DELIVERY IS THE SENDER'S, BY DESIGN AND NOT BY OMISSION ──────────────
 *
 * `ExternalLinkDelivery.deliveredBy` is `"caller"` in v0.1: there is no email
 * provider in this repository, `delivery.protected_link_email` has no
 * producer, and the issuing member IS the delivery mechanism. So the address
 * typed here is what the grant is BOUND to (it is checked at exchange time and
 * recorded in the audit event), not an address anything sends to — and the
 * copy says «скопіюйте й надішліть» rather than implying a send.
 *
 * ─── WHY THIS IS A CLIENT COMPONENT AND WHAT THAT COSTS ───────────────────
 *
 * It holds three pieces of state that only a browser has: what the person
 * typed, whether a request is in flight, and a token that must live in memory
 * and nowhere else. A Server Action would put the returned link through
 * Next's own RSC payload; a client `fetch` keeps it in one JavaScript
 * variable, rendered once, never re-fetched, and gone on reload — which is the
 * same property `/external/review`'s own shell relies on for the CSRF token.
 */

/**
 * The workspace's own timezone. SAME STAND-IN, SAME REASON, AND DELIBERATELY
 * NOT IMPORTED FROM `evidence-card.tsx`: that module is a server component
 * file, and importing its formatter here would pull it — and its `lucide-react`
 * icon — into this screen's client bundle to reuse four lines. The real fix
 * for both call sites is the same one already filed in `TODOS.md`'s "Surfaced
 * by Plan D slice D1 task 6" entry: thread the caller's actual workspace
 * `timezone` through instead of defaulting it. Until then the zone is named
 * explicitly and SHOWN (`timeZoneName`), because a time that does not say
 * which zone it is in is a time that can be silently misread — and this one is
 * a deadline.
 */
const WORKSPACE_TIMEZONE_DEFAULT = "Europe/Kyiv";

export function formatExpiresAt(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: WORKSPACE_TIMEZONE_DEFAULT,
    timeZoneName: "short",
  });
}

/** THE SENTENCE INV-044 REQUIRES, verbatim from the task brief. */
export const ONE_TIME_LINK_NOTICE =
  "Посилання показано один раз. Скопіюйте його зараз — відновити його неможливо, "
  + "лише відкликати й видати нове.";

const GENERIC_FAILURE =
  "Не вдалося створити посилання. Перевірте з'єднання та спробуйте ще раз.";
const SESSION_EXPIRED =
  "Сесія завершилася. Оновіть сторінку, увійдіть знову та повторіть.";
const INVALID_INPUT =
  "Перевірте адресу електронної пошти та роль одержувача.";
/**
 * The replay branch, worded as what it IS. The grant exists — a row, an audit
 * event, an expiry — and its token does not, anywhere, for anyone. Telling the
 * reader to «спробувати ще раз» here would be telling them to press a button
 * that cannot produce the missing token.
 */
const ISSUED_WITHOUT_LINK =
  "Доступ створено, але посилання не повернулося (повтор запиту). Відновити його "
  + "неможливо — відкличте цей доступ і видайте новий.";

type State =
  | { phase: "form" }
  | { phase: "pending" }
  | { phase: "issued"; link: ExternalLinkDelivery }
  | { phase: "failed"; message: string };

export function IssueReviewLink({ occurrenceId }: { occurrenceId: string }) {
  const [state, setState] = useState<State>({ phase: "form" });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [copied, setCopied] = useState<null | "ok" | "failed">(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ phase: "pending" });
    const result = await issueReviewLink({
      occurrenceId, recipientEmail: email, recipientRole: role,
    });
    switch (result.kind) {
      case "ok":
        setState({ phase: "issued", link: result.link });
        return;
      case "issued_without_link":
        setState({ phase: "failed", message: ISSUED_WITHOUT_LINK });
        return;
      case "invalid":
        setState({ phase: "failed", message: INVALID_INPUT });
        return;
      case "session_expired":
        setState({ phase: "failed", message: SESSION_EXPIRED });
        return;
      case "refused":
        // The server's own Ukrainian sentence, not a generic one: the three
        // refusals this route owns each say something the reader can act on.
        setState({ phase: "failed", message: result.detail });
        return;
      default:
        setState({ phase: "failed", message: GENERIC_FAILURE });
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      // A refused clipboard permission is not a lost link — the URL is on
      // screen and selectable. Say which of the two happened rather than
      // leaving a button that appears to do nothing.
      setCopied("failed");
    }
  }

  if (state.phase === "issued") {
    return (
      <section className="flex flex-col gap-3 border-t border-line pt-4" aria-label="Посилання для зовнішньої перевірки">
        <h3 className="text-h3 font-semibold text-ink">Посилання створено</h3>
        {/* `role="status"` so the sentence and the link are announced when they
            appear — this block replaces the form the reader just submitted, and
            a screen-reader user would otherwise be told nothing at all. */}
        {/* `max-w-measure`, AND IT IS A ROLE THIS THEME ACTUALLY DEFINES —
         * checked in `packages/ui/src/theme.generated.css`, not assumed. That
         * file clears the stock container scale outright (`--container-*:
         * initial`, line 21) and then defines exactly three: `measure` 680px,
         * `content` 1240px, `nav` 880px. So `max-w-md`/`max-w-sm` compile to
         * `max-width: var(--container-md)` with nothing behind the variable —
         * an invalid declaration, no error, no width — and `max-w-measure` is
         * the one that means «a column a person can read». A sentence and a
         * URL stretched across a 1920px panel are the reason it is here. */}
        <div role="status" className="flex max-w-measure flex-col gap-2">
          <p className="text-data font-medium text-ink">{ONE_TIME_LINK_NOTICE}</p>
          <p className="break-all font-mono text-meta text-ink">{state.link.url}</p>
          <p className="text-meta text-ink-muted">
            Діє до {formatExpiresAt(state.link.expiresAt)}. Надішліть його одержувачу самостійно.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => copy(state.link.url)}>
            Копіювати посилання
          </Button>
          {copied === "ok" && <span className="text-meta text-ink-muted">Скопійовано</span>}
          {copied === "failed" && (
            <span className="text-meta text-ink-muted">
              Не вдалося скопіювати — виділіть посилання та скопіюйте вручну.
            </span>
          )}
        </div>
      </section>
    );
  }

  const pending = state.phase === "pending";

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      {/* See the issued branch above for why `max-w-measure` and not
       * `max-w-md`: this theme clears the stock container scale and defines
       * three roles of its own. A 1200px-wide email field is not a form. */}
      <div className="flex max-w-measure flex-col gap-1">
        <h3 className="text-h3 font-semibold text-ink">Відправити на перевірку</h3>
        <p className="text-meta text-ink-muted">
          Одноразове посилання відкриває цю вимогу та її фото зовнішньому перевіряльнику
          без облікового запису. Рішення за ним не ухвалюють — лише переглядають.
        </p>
      </div>

      <form className="flex max-w-measure flex-col gap-3" onSubmit={submit}>
        <Field label="Пошта одержувача" required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="tehnahliad@example.com"
              value={email}
              disabled={pending}
              aria-invalid={invalid}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Роль одержувача"
          description="Як одержувач представляється. Це не підтвердження особи й не повноваження поза цим посиланням."
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="text"
              required
              placeholder="технічний нагляд"
              value={role}
              disabled={pending}
              aria-invalid={invalid}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
              onChange={(e) => setRole(e.target.value)}
            />
          )}
        </Field>

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Створюємо посилання…" : "Відправити на перевірку"}
          </Button>
        </div>
      </form>

      {state.phase === "failed" && (
        <Banner tone="blocked" title="Посилання не створено">{state.message}</Banner>
      )}
    </section>
  );
}
