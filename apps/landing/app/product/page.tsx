import type { Metadata } from "next";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Band } from "../../components/blocks/band";
import { Route } from "../../components/blocks/route";
import { StateBoard } from "../../components/blocks/state-board";
import { Capture } from "../../components/blocks/capture";
import { Provenance } from "../../components/blocks/provenance";
import { Position } from "../../components/blocks/position";
import { Cta } from "../../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "product");

/**
 * «Як працює». [DEV-022] The route, the capture channels, who sees what and the
 * limits of v0.1. [DEV-023] In the reference's form: the sticky list of five
 * steps beside their cards, the large application view with its four
 * statements, then the channels, the provenance cells and the position —
 * a raster band between each.
 */
export default function ProductPage() {
  return (
    <SiteShell page="product">
      <Route heading="h1" />
      <Band />
      <StateBoard />
      <Band />
      <Capture />
      <Band />
      <Provenance />
      <Position />
      <Band />
      <Cta />
    </SiteShell>
  );
}
