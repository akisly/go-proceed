import psl from "psl";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registrable domain per the Public Suffix List (ER-4).
 * Ukraine has ~30 second-level public suffixes (com.ua, kyiv.ua, lviv.ua, …),
 * so "last two labels" is wrong and collapses every lead into com.ua.
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") throw new Error("normalizeDomain: empty input");

  const withScheme = SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname: string;
  try {
    hostname = new URL(withScheme).hostname;
  } catch {
    throw new Error(`normalizeDomain: unparseable website: ${input}`);
  }
  if (hostname.startsWith("www.")) hostname = hostname.slice("www.".length);

  const registrable = psl.get(hostname);
  if (registrable === null || registrable === "") {
    throw new Error(`normalizeDomain: no registrable domain in: ${input}`);
  }
  return registrable;
}

/** Lowercase + trim only. +tags and dots are preserved deliberately (B.4.3). */
export function normalizeEmail(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!EMAIL.test(normalized)) {
    throw new Error(`normalizeEmail: not an address: ${input}`);
  }
  return normalized;
}
