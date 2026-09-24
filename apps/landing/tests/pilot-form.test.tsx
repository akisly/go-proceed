// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { PilotForm } from "../components/blocks/pilot-form";
import { landingContent } from "../content/landing-content";
import { PILOT_EMAIL } from "../content/pilot-request";

// jsdom implements no media queries at all. The submit and copy buttons are
// now wrapped in `Magnetic`, whose `usePointerFine`/`useBelowBreakpoint` gates
// call `window.matchMedia` unconditionally in an effect — harmless in the
// `renderToStaticMarkup` tests (effects never run there) but this file mounts
// with `render()`, which does. The stub reports no fine pointer and no
// breakpoint match, so the gates resolve to their off state, same as every
// other test on this page.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

afterEach(cleanup);

const f = landingContent.pilot.form;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  // @testing-library/user-event@14 installs its own navigator.clipboard stub
  // (with a private marker symbol) the instant userEvent.setup() runs inside
  // an `it`, unconditionally replacing whatever `navigator.clipboard` held —
  // so defining a plain replacement object here would just be clobbered a
  // moment later. Calling setup() once up front attaches that stub now, and
  // patching its writeText (rather than replacing the whole clipboard
  // object) leaves the marker intact, so the `it`'s own setup() call sees an
  // already-stubbed clipboard and skips re-creating it.
  userEvent.setup();
  Object.defineProperty(navigator.clipboard, "writeText", { value: writeText, configurable: true });
});

/**
 * Look a field up by its ACCESSIBLE NAME rather than by the label's text.
 *
 * Required labels carry a visible `*` in an `aria-hidden` span: the marker is
 * for the eye, and the accessible name stays «Ім'я». `getByLabelText` matches
 * the label's raw `textContent` and so would see «Ім'я *» — asking through the
 * role proves the name a screen reader actually hears.
 */
const field = (name: string) => screen.getByRole("textbox", { name });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field(f.fields.name.label), "Ірина");
  await user.type(field(f.fields.contact.label), "@iryna");
}

describe("PilotForm", () => {
  it("posts JSON and shows the sent state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, via: ["telegram"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.sent));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/pilot");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ name: "Ірина", contact: "@iryna", website: "" });
    expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "sent");
  });

  it("falls back to the clipboard and the mail client when the server fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "delivery" }), { status: 502 })));
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await waitFor(() => expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "failed"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Об'єкт і пакет робіт:"));
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining(PILOT_EMAIL));
    expect(screen.getByRole("link", { name: f.mail })).toHaveAttribute("href", expect.stringContaining(`mailto:${PILOT_EMAIL}`));
    // The failed state names no address: the mail-client link carries it.
    expect(screen.getByRole("status")).not.toHaveTextContent(PILOT_EMAIL);
  });

  // A stalled connection used to leave the button disabled on «Надсилаємо…»
  // for as long as the platform allowed, with no way to reach the fallback.
  it("aborts a stalled request and lands in the failed state", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init.signal!;
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetchMock);
    // The form's 15 s `AbortSignal.timeout` is replaced by a controller the test
    // aborts: under Vitest 5's jsdom environment the signal and a hand-made
    // `new Event("abort")` come from different realms, and dispatching one on
    // the other throws (DEV-069). `abort()` fires the same listener.
    const timeout = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));

    try {
      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(timeoutSpy).toHaveBeenCalledWith(15_000);
      expect(init.signal).toBe(timeout.signal);
      timeout.abort();
    } finally {
      timeoutSpy.mockRestore();
    }

    await waitFor(() => expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "failed"));
    expect(writeText).toHaveBeenCalled();
  });

  it("does not post when a required field is empty, and focuses it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.type(field(f.fields.name.label), "Ірина");
    await user.click(screen.getByRole("button", { name: f.submit }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field(f.fields.contact.label)).toHaveFocus();
  });

  // The validator has always returned `{ ok: false, error: "required" }` and
  // the component always threw that away, moving focus and nothing else. With
  // `noValidate` on the form there was no browser bubble either, so a sighted
  // visitor pressed the only call to action on the site and saw the page do
  // nothing at all, and a screen-reader user was dropped into a field with no
  // statement that anything had failed. WCAG 3.3.1, 3.3.3 and 4.1.3.
  it("names the field that failed, so the error is not colour-and-focus alone", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.type(field(f.fields.name.label), "Ірина");
    await user.click(screen.getByRole("button", { name: f.submit }));

    const contact = field(f.fields.contact.label);
    expect(contact).toHaveAttribute("aria-invalid", "true");
    expect(contact).toHaveAccessibleDescription(f.fields.contact.error);
    expect(field(f.fields.name.label)).not.toHaveAttribute("aria-invalid");
  });

  it("announces the failure, because moving focus announces only the label", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.click(screen.getByRole("button", { name: f.submit }));
    expect(screen.getByRole("status")).toHaveTextContent(f.invalid);
    expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "invalid");
  });

  it("clears the error once the field is filled, rather than leaving it stale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, via: ["telegram"] }), { status: 200 })));
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.click(screen.getByRole("button", { name: f.submit }));
    expect(field(f.fields.name.label)).toHaveAttribute("aria-invalid", "true");

    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.sent));
    expect(field(f.fields.name.label)).not.toHaveAttribute("aria-invalid");
  });

  // WCAG 2.4.3. `disabled` removes the focused button from the focus order the
  // instant it is pressed, so focus fell to <body> and the next Tab restarted
  // at the skip link — roughly eighteen stops back to the form, and a screen
  // reader lost its place entirely. And between the press and the result the
  // live region said nothing at all.
  it("keeps focus on the submit button while it is sending, and says so", async () => {
    let release;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise((res) => { release = res; })));
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    const button = screen.getByRole("button", { name: f.submit });
    await user.click(button);

    const sending = screen.getByRole("button", { name: f.submitting });
    expect(sending).toHaveFocus();
    expect(sending).toHaveAttribute("aria-disabled", "true");
    expect(sending).not.toHaveAttribute("disabled");
    expect(screen.getByRole("status")).toHaveTextContent(f.submitting);

    release(new Response(JSON.stringify({ ok: true, via: ["telegram"] }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.sent));
  });

  it("refuses a second submit while one is in flight", async () => {
    // The guard `disabled` used to provide has to move into the handler, or
    // keeping the button focusable would let a double press fire two requests.
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await user.click(screen.getByRole("button", { name: f.submitting }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // WCAG 3.3.2: `required` reaches a screen reader through the native
  // attribute, but «Ім'я» and «Компанія» were visually identical, so a sighted
  // visitor could not tell which fields were needed before submitting.
  it("marks the required fields visibly, not only in the accessibility tree", () => {
    render(<PilotForm />);
    expect(screen.getByText(f.requiredNote)).toBeInTheDocument();
    for (const label of [f.fields.name.label, f.fields.contact.label]) {
      expect(field(label)).toBeRequired();
    }
    expect(field(f.fields.company.label)).not.toBeRequired();
  });

  // WCAG 4.1.3. Both copy buttons signalled success by swapping their own
  // label, and neither NVDA nor JAWS re-announces a focused button whose name
  // changes. `share-link.tsx` also swallowed a clipboard failure in silence.
  it("announces the copy, rather than only relabelling the button", async () => {
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.copy }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.copied));
  });

  it("says so when the clipboard refuses, instead of looking like nothing happened", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.copy }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.copyFailed));
  });

  it("copies the request text on demand", async () => {
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.copy }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Ім'я: Ірина"));
    await waitFor(() => expect(screen.getByRole("button", { name: f.copied })).toBeInTheDocument());
  });
});
