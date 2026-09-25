/**
 * Times on the office screens, in the workspace's own zone (DEV-089, BL-034).
 *
 * NO DIRECTIVE AND NO IMPORTS. `evidence-card.tsx` formats on the server and
 * `issue-review-link.tsx` is a client component that formats in the viewer's
 * browser; both read this one module, so it may pull nothing into the client
 * bundle.
 *
 * THE ZONE IS NAMED, NEVER THE PROCESS'S. A call without `timeZone` formats in
 * the runtime's own zone — UTC on Vercel, the viewer's in a browser — and a
 * photo received at 09:30Z would read "09:30" with nothing on screen to say a
 * zone was involved (the fix-round-1 bug `evidence-card.tsx` records).
 *
 * THE ZONE IS SHOWN (`timeZoneName: "short"`), and its label comes from the
 * zone actually used. So when the stored zone is not one this runtime knows
 * — creation accepts any string (BL-206) — and the chain below falls back,
 * the screen still tells the truth about which offset it shows: «GMT+3», not
 * a silently shifted time. `timeZoneName` cannot combine with the
 * `dateStyle`/`timeStyle` shorthand, so the components are spelled out; they
 * reproduce `dateStyle: "medium", timeStyle: "short"`'s shape.
 *
 * THE CHAIN ENDS IN "UTC". The default is not enough on its own: a browser
 * whose tzdata predates 2022b knows `Europe/Kiev` and throws on `Europe/Kyiv`,
 * so the old name comes next and keeps Kyiv time there; ECMA-402 requires
 * every implementation to accept "UTC".
 *
 * A MALFORMED INSTANT IS SHOWN AS GIVEN. `Intl.DateTimeFormat#format` throws
 * on an invalid Date where `toLocaleString` printed «Invalid Date»; a throw
 * here would take the page — and a one-time link already issued — with it.
 * No producer emits one today (every value is a `toISOString()`).
 */
export const WORKSPACE_TIMEZONE_DEFAULT = "Europe/Kyiv";

/** After the workspace's own zone: the default, then its pre-2022b name. */
export const WORKSPACE_TIMEZONE_FALLBACKS = [WORKSPACE_TIMEZONE_DEFAULT, "Europe/Kiev"] as const;

const OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric", month: "short", day: "numeric",
  hour: "2-digit", minute: "2-digit",
  timeZoneName: "short",
};

/** The first zone in `candidates` this runtime accepts; "UTC" when none is. */
export function workspaceTimeFormat(
  candidates: readonly string[],
): Intl.DateTimeFormat {
  for (const timeZone of candidates) {
    try {
      return new Intl.DateTimeFormat("uk-UA", { ...OPTIONS, timeZone });
    } catch {
      // A RangeError for a zone this runtime does not know: try the next one.
    }
  }
  return new Intl.DateTimeFormat("uk-UA", { ...OPTIONS, timeZone: "UTC" });
}

/** `iso` in the workspace's zone, with the zone's label. */
export function formatWorkspaceTime(iso: string, timeZone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return workspaceTimeFormat([timeZone, ...WORKSPACE_TIMEZONE_FALLBACKS]).format(at);
}
