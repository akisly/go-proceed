/** The reference's divider between sections (DEV-026): a 50px raster band between two hairlines. Decorative.
 *
 * [2026-09-22, DEV-029] The band now has a tone, because nine identical rasters
 * a page was most of what the owner meant by «монотонно»: the divider RESET the
 * ground every time instead of belonging to it.
 *
 *   paper — as it was, between two paper sections;
 *   fade  — the raster thins downward, for the seam into a section that carries
 *           its own ground;
 *   tint  — the raster on the warm ground, for a seam where BOTH sides already
 *           have one.
 *
 * A third tone, `deep`, existed for one revision — the raster on the inverse
 * ground, for a dark section that a paper stripe would have cut open. It went
 * out with the dark sections it served.
 *
 * The tone is a `data-` attribute, not a class, so both literal selectors live
 * together in `globals.css` and no caller can assemble one from a string.
 */
export function Band({ tone = "paper" }: { tone?: "paper" | "fade" | "tint" }) {
  return <div aria-hidden="true" data-band="" data-tone={tone} className="landing-band" />;
}
