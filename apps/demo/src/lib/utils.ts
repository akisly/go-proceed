import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge has to be TAUGHT this theme, not just installed.
 *
 * Its conflict resolution is driven by a built-in map of Tailwind's *default*
 * theme. `src/styles/theme.css` clears the stock `--color-*`, `--text-*`,
 * `--radius-*`, `--shadow-*` and `--breakpoint-*` namespaces and defines its
 * own, so every class this codebase writes is one tailwind-merge has never
 * heard of — and its fallbacks are actively wrong here rather than merely
 * unhelpful.
 *
 * The concrete failure: `text-*` is ambiguous in Tailwind (font-size AND
 * colour), so tailwind-merge disambiguates with a validator — a t-shirt size
 * is font-size, anything else is a colour. `text-data` is not a t-shirt size,
 * so stock tailwind-merge files it under text-colour, decides it conflicts
 * with `text-foreground`, and silently drops one of them. A cell would lose
 * either its size or its colour depending on argument order, with nothing
 * failing anywhere.
 *
 * `override` (not `extend`) is deliberate for the groups below: the stock
 * members are gone from the theme, so leaving them in the group would let
 * tailwind-merge keep treating `text-lg` or `rounded-md` as real, mergeable
 * classes when they now generate nothing at all.
 */
const twMerge = extendTailwindMerge({
  override: {
    classGroups: {
      'font-size': [{ text: ['micro', 'meta', 'data', 'body', 'h3', 'h2', 'h1', 'display'] }],
      'font-family': [{ font: ['display', 'sans'] }],
      rounded: [{ rounded: ['control', 'panel', 'pill', 'none', 'full'] }],
      shadow: [{ shadow: ['raised', 'drawer', 'none'] }],
    },
  },
})

/** Standard shadcn `cn`, with the merger above rather than the stock one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
