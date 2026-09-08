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

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(f.fields.name.label), "Ірина");
  await user.type(screen.getByLabelText(f.fields.contact.label), "@iryna");
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
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Надіслати на: ${PILOT_EMAIL}`));
    expect(screen.getByRole("link", { name: f.mail })).toHaveAttribute("href", expect.stringContaining(`mailto:${PILOT_EMAIL}`));
    expect(screen.getByRole("status")).toHaveTextContent(PILOT_EMAIL);
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
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    (init.signal as AbortSignal).dispatchEvent(new Event("abort"));

    await waitFor(() => expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "failed"));
    expect(writeText).toHaveBeenCalled();
  });

  it("does not post when a required field is empty, and focuses it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.type(screen.getByLabelText(f.fields.name.label), "Ірина");
    await user.click(screen.getByRole("button", { name: f.submit }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(f.fields.contact.label)).toHaveFocus();
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
