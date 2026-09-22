import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "../../app/page";
import PilotPage from "../../app/pilot/page";
import ProductPage from "../../app/product/page";
import RolesPage from "../../app/roles/page";
import type { PageKey } from "../../content/landing-content";

/**
 * The four pages (DEV-024), each rendered whole: `SiteShell` puts the header,
 * `<main>` and the footer inside the page component, so one import is one
 * complete document body.
 *
 * A test that needs the motion-enabled tree still declares its own `vi.mock`
 * of `use-reduced` — the mock is hoisted per test file and cannot live here.
 */
const PAGES = { home: HomePage, product: ProductPage, roles: RolesPage, pilot: PilotPage } satisfies Record<PageKey, () => React.ReactElement>;

export const PAGE_KEYS = Object.keys(PAGES) as PageKey[];

export function renderPage(page: PageKey): string {
  const Page = PAGES[page];
  return renderToStaticMarkup(<Page />).replace(/&#x27;/g, "'");
}

/** `html` from `id="…"` up to the next named section, or to the end. */
export const sectionOf = (html: string) => (id: string, next?: string) =>
  html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);
