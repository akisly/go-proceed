import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A NATIVE `<select>`, restyled to match `./input.tsx` — deliberately not
 * shadcn's Radix Select, even though `@radix-ui/react-select` is already a
 * dependency of this app.
 *
 * The four selects on /pilot (спеціалізація, кількість об'єктів, час закриття,
 * готовність поділитися) are short, flat lists of fixed options with no search,
 * no grouping, no multi-select and no custom option rendering. A native control
 * handles every one of those cases already, and it brings things the Radix
 * version reimplements and can therefore get wrong: the device's own native
 * picker at phone width, hardware keyboard type-ahead, and the browser's
 * native form-validation and autofill paths. The audience here is a site
 * engineer on a building site working one-handed — whatever picker their
 * device already gives them beats a listbox reimplementation of one.
 *
 * (Note for whoever edits this comment: qa/forbidden-claims.mjs scans comments
 * as well as copy, and naming either of the two usual phone platforms trips
 * the `mobile-app` pattern. That guard is right to — this product ships no
 * native app — so describe the device generically, as above.)
 *
 * The Radix version earns its complexity when a control needs something native
 * cannot do. None of these do, so this is the one that ships. If a future
 * select needs rich options, that is the moment to add the Radix one ALONGSIDE
 * this — not to migrate these four onto it.
 *
 * `appearance-none` plus a drawn chevron, rather than the platform arrow,
 * because the platform arrow is sized and coloured by the OS and would be the
 * only control in the system not using the product's own iconography.
 * `pr-9` reserves the space it sits in, so a long option label never runs
 * underneath it.
 */
function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'h-11 w-full min-w-0 appearance-none rounded-control border border-border bg-surface-muted pl-3 pr-9 md:h-9',
          'text-foreground',
          'transition-colors duration-150 ease-out-strong hover:border-border-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
      />
    </div>
  )
}

export { Select }
