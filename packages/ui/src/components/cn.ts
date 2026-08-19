import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { TW_MERGE_OVERRIDE } from "../tw-merge.generated";

/**
 * Class merge for every component in this package.
 *
 * `clsx` for conditionals, `tailwind-merge` for conflict resolution, and the
 * merge is TAUGHT this theme by a generated config — because untaught it
 * silently deletes classes. Measured on tailwind-merge 3.6.0:
 *
 *     cn("text-data", "text-ink")  // untaught -> "text-ink", size gone
 *     cn("text-data", "text-ink")  // taught   -> "text-data text-ink"
 *
 * `text-data` is not a t-shirt size, so stock tailwind-merge files it as a
 * colour and resolves it against `text-ink` as a conflict. Nothing warns; the
 * element renders at the inherited size and looks nearly right. That is why
 * `packages/testing/src/tw-merge.test.ts` asserts the exact pairs rather than
 * asserting that a config exists.
 */
export const cn = extendTailwindMerge({ override: TW_MERGE_OVERRIDE });

/** `cx` composes conditionals; `cn` resolves conflicts. Most components want both. */
export function cx(...inputs: ClassValue[]): string {
  return cn(clsx(inputs));
}

/**
 * A NOTE ON OPTIONAL PROPS IN THIS PACKAGE
 * ----------------------------------------
 * `tsconfig.base.json` sets `exactOptionalPropertyTypes: true`, which draws a
 * distinction most React code never has to think about: `error?: string` means
 * "may be absent", NOT "may be undefined". Passing a computed
 * `invalid ? "…" : undefined` into such a prop is a type error, and the call
 * site's only fixes are ugly — a conditional spread, or a non-null assertion
 * that lies.
 *
 * So every optional prop in this package is declared `?: T | undefined`. It is
 * two extra words at the definition and it keeps every call site honest, which
 * is the right side of that trade for a component library.
 */
