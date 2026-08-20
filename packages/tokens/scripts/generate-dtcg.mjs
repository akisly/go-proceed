/**
 * Emits the W3C Design Tokens Community Group format, which is what Figma
 * Variables imports and what every design tool that is not Figma has settled
 * on too.
 *
 * WHY THIS IS A GENERATOR AND NOT A FIGMA-SIDE EDIT
 * ------------------------------------------------
 * The failure this repository has already recorded once — `muted` documented
 * as #686E6A and shipped as #666979, name identical, no test catching it — is
 * exactly the failure a design tool introduces when it becomes a second place
 * a value can be typed. Figma is downstream of this file, never upstream. A
 * designer changing a variable in Figma changes nothing; the change lands here
 * or it does not land.
 *
 * Semantic roles are emitted as DTCG aliases (`{primitive.color.neutral-25}`)
 * rather than as resolved values, so the Figma variable collection keeps the
 * same indirection the CSS has — a designer re-pointing a role sees every
 * component follow, which is the whole point of the layer.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readSource, repoRoot, shadowTokens, semanticRef, scale, SCALE_BLOCKS } from "./lib/source.mjs";

const src = readSource();
const outDir = process.env.TOKENS_OUT_DIR ?? join(repoRoot, "packages/tokens/src");

const DIMENSION = new Set(["text", "radius", "space", "breakpoint", "container", "blur"]);
const DURATION = new Set(["duration", "stagger"]);
const CUBIC = new Set(["ease"]);

const doc = {
  $description:
    "GENERATED from packages/tokens/src/tokens.json — do not edit, and do not treat Figma as the source. Regenerate: node packages/tokens/scripts/generate-dtcg.mjs",
  primitive: { color: {} },
  semantic: { light: {}, dark: {} },
  shadow: {},
  component: {},
};

for (const [name, t] of Object.entries(src.primitive.color)) {
  doc.primitive.color[name] = { $type: "color", $value: t.hex, $description: t.ruling };
}
for (const block of SCALE_BLOCKS) {
  const entries = scale(src.primitive[block]);
  if (!entries.length) continue;
  doc.primitive[block] = {};
  for (const [n, v] of entries) {
    doc.primitive[block][n] = {
      $type: DIMENSION.has(block) ? "dimension" : DURATION.has(block) ? "duration"
        : CUBIC.has(block) ? "cubicBezier" : "string",
      $value: String(v),
      $description: src.primitive[block][n].ruling,
    };
  }
}

for (const theme of ["light", "dark"]) {
  for (const [name, t] of Object.entries(src.semantic.color)) {
    const { ref, alpha } = semanticRef(t[theme]);
    doc.semantic[theme][name] = {
      $type: "color",
      $value: `{primitive.color.${ref}}`,
      $description: alpha === 1 ? t.ruling : `${t.ruling} Applied at ${Math.round(alpha * 100)}% alpha.`,
      $extensions: { "app.goproceed.tailwind": t.tw ?? null, "app.goproceed.alpha": alpha },
    };
  }
}

for (const [name, t] of shadowTokens(src.shadow)) {
  doc.shadow[name] = {
    $type: "shadow",
    $value: t.layers.map((l) => ({
      offsetX: `${l.offsetX}px`, offsetY: `${l.offsetY}px`,
      blur: `${l.blurRadius}px`, spread: `${l.spreadDistance}px`,
      color: l.color.hex, alpha: l.color.alpha,
    })),
    $description: t.ruling,
  };
}

for (const [name, t] of Object.entries(src.component)) {
  doc.component[name] = { $type: "dimension", $value: String(t.value), $description: t.ruling };
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.dtcg.json"), JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${join(outDir, "tokens.dtcg.json")}`);
