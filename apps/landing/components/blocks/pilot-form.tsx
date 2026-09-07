"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cx } from "@goproceed/ui/components";
import { Magnetic } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import {
  PILOT_EMAIL, buildPilotClipboardText, buildPilotMailto, type PilotFields,
  type RequiredPilotField, validatePilotFields,
} from "../../content/pilot-request";

type FormState = "idle" | "sending" | "sent" | "failed" | "invalid";
const f = landingContent.pilot.form;
const CONTROL = "h-(--gp-control-height-marketing) bg-canvas";

/**
 * The pilot request. Posts to /api/pilot; on any failure copies the request
 * text to the clipboard and offers the mail client — the prototype's honest
 * fallback. Required fields are checked here before a request is made, and
 * the first empty one takes focus. One live region announces every state.
 */
export function PilotForm() {
  const [state, setState] = useState<FormState>("idle");
  // Which required fields failed the last submit. The validator names them —
  // the form does not restate what counts as empty.
  const [missing, setMissing] = useState<RequiredPilotField[]>([]);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string>(f.roles[0]);
  const [fields, setFields] = useState<PilotFields>({ name: "", company: "", contact: "", role: f.roles[0], context: "" });

  const read = (form: HTMLFormElement): PilotFields & { website: string } => {
    const data = new FormData(form);
    const s = (k: string) => String(data.get(k) ?? "");
    return { name: s("name"), company: s("company"), contact: s("contact"), role, context: s("context"), website: s("website") };
  };

  async function copy(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const all = read(form);
    setFields(all);
    const checked = validatePilotFields(all);
    if (!checked.ok) {
      // Say what failed, then move. Focus alone announces only the field's
      // label — it never says the submit was refused, and it says nothing at
      // all to someone who is looking rather than listening.
      setMissing(checked.missing);
      setState("invalid");
      const first = form.elements.namedItem(checked.missing[0] ?? "name");
      if (first instanceof HTMLInputElement) first.focus();
      return;
    }
    setMissing([]);
    setState("sending");
    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(all),
        // Fifteen seconds — comfortably longer than the handler's own eight, so
        // a slow-but-alive delivery still wins. Without it a connection that
        // opens and never answers left the button disabled on «Надсилаю…»
        // indefinitely and the clipboard fallback out of reach; the abort
        // throws, and the catch below is already the failed state.
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (response.ok && json.ok) { setState("sent"); form.reset(); return; }
      throw new Error(String(response.status));
    } catch {
      await copy(buildPilotClipboardText(checked.fields));
      setState("failed");
    }
  }

  async function onCopy() {
    const ok = await copy(buildPilotClipboardText(fields));
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    /* `method="post" action="/api/pilot"` is what a visitor WITHOUT JavaScript
     * gets. A form with neither submits a default GET to the current URL, which
     * puts the applicant's name, company and phone into the address bar, the
     * browser history, the Referer of every later request and the CDN log —
     * and delivers nothing while doing it. The POST reaches the handler, which
     * answers a 4xx problem for a form-encoded body (tests/pilot-route.test.ts)
     * rather than claiming to have sent anything; the address below the buttons
     * is the route that actually works without JS. */
    <form
      method="post"
      action="/api/pilot"
      onSubmit={onSubmit}
      onChange={(e) => setFields(read(e.currentTarget))}
      aria-label="Заявка на пілот GoProceed"
      data-form-state={state}
      noValidate
      className="grid gap-3 rounded-surface border border-line-strong bg-surface p-5 shadow-float wide:sticky wide:top-24 md:p-7"
    >
      <AuthorNote />
      <h3 className="text-h3 font-semibold text-ink">{f.title}</h3>
      <p className="text-data text-ink-muted">{f.note}</p>
      <label className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
        Website<input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-name">{f.fields.name.label}</Label>
          <Input
            id="pilot-name" name="name" required autoComplete="name"
            placeholder={f.fields.name.placeholder} className={CONTROL}
            {...(missing.includes("name")
              ? { "aria-invalid": true, "aria-describedby": "pilot-name-error" }
              : {})}
          />
          {missing.includes("name") && (
            <p id="pilot-name-error" className="text-meta text-status-attention-fg">{f.fields.name.error}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-company">{f.fields.company.label}</Label>
          <Input id="pilot-company" name="company" autoComplete="organization" placeholder={f.fields.company.placeholder} className={CONTROL} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-role">{f.fields.role.label}</Label>
          <Select value={role} onValueChange={setRole} name="role">
            <SelectTrigger id="pilot-role" className={cx("w-full", CONTROL)}><SelectValue /></SelectTrigger>
            <SelectContent>{f.roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-contact">{f.fields.contact.label}</Label>
          <Input
            id="pilot-contact" name="contact" required
            placeholder={f.fields.contact.placeholder} className={CONTROL}
            {...(missing.includes("contact")
              ? { "aria-invalid": true, "aria-describedby": "pilot-contact-error" }
              : {})}
          />
          {missing.includes("contact") && (
            <p id="pilot-contact-error" className="text-meta text-status-attention-fg">{f.fields.contact.error}</p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pilot-context">{f.fields.context.label}</Label>
        <Textarea id="pilot-context" name="context" placeholder={f.fields.context.placeholder} className="bg-canvas" />
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Magnetic className="w-full"><Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>{state === "sending" ? f.submitting : f.submit}</Button></Magnetic>
        <Magnetic className="w-full"><Button type="button" size="lg" variant="outline" className="w-full" onClick={onCopy}>{copied ? f.copied : f.copy}</Button></Magnetic>
      </div>
      <p role="status" aria-live="polite" className={state === "sent"
        ? "rounded-card border border-status-ready-line bg-status-ready px-3.5 py-3 text-data text-ink"
        : state === "failed" || state === "invalid"
          ? "rounded-card border border-status-attention-line bg-status-attention px-3.5 py-3 text-data text-ink"
          : "sr-only"}>
        {state === "invalid" && f.invalid}
        {state === "sent" && f.sent}
        {state === "failed" && (
          <>
            {f.failed} <a className="font-medium underline underline-offset-4" href={`mailto:${PILOT_EMAIL}`}>{PILOT_EMAIL}</a> {f.failedTail}
            <span className="mt-2 block"><Button asChild variant="outline" size="sm"><a href={buildPilotMailto(fields)}>{f.mail}</a></Button></span>
          </>
        )}
      </p>
      {/* Spec §9.1: the address is visible in the copy under the form, always —
        * not only in the failed state, which only JavaScript can produce. One
        * line, and a link rather than a second call to action. */}
      <p className="text-data text-ink-secondary">
        {f.mailNote}{" "}
        <a className="font-medium underline underline-offset-4 hover:text-ink" href={`mailto:${PILOT_EMAIL}`}>{PILOT_EMAIL}</a>
      </p>
      <p className="text-meta text-ink-muted">{f.fine}</p>
    </form>
  );
}

function AuthorNote() {
  const a = landingContent.pilot.author;
  return (
    <div className="mb-1.5 grid grid-cols-[44px_1fr] gap-3.5 rounded-card border border-line bg-canvas px-4 py-3.5">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-pill bg-action text-data font-semibold tracking-wide text-action-fg">{a.initials}</span>
      <div>
        <b className="mb-1 block text-data font-semibold text-ink">{a.title}</b>
        <p className="text-data leading-relaxed text-ink-secondary">{a.body}</p>
        <span className="mt-2 block text-meta text-ink-muted">{a.signature}</span>
      </div>
    </div>
  );
}
