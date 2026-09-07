import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The design-system inventory is internal by nature: it renders every
 * component and every motion primitive out of context, with demonstration
 * copy in the same Ukrainian domain vocabulary as the landing page. Indexed,
 * it competes with `/` on exactly the terms `/` is trying to own.
 *
 * The tag lives here rather than in the two page files because both start with
 * `"use client"`, and a client module cannot export `metadata` — putting it
 * there is a build error, not a fix. One layout covers both routes.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function KitchenSinkLayout({ children }: { children: ReactNode }) {
  return children;
}
