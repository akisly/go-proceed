import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn's Input, restyled.
 *
 * Inset, not raised: the field is slightly darker than the surface it sits on
 * (`surface-muted` against White) because an input RECEIVES content. That reads
 * as "type here" without a heavy border, which is the same reason the rest of
 * the system leans on tonal shift rather than outlines.
 *
 * 44px tall below md and 36px from md up, matching Button — the phone floor is
 * WCAG 2.5.5, not a preference. No focus ring here either: `theme.css` gives
 * every focusable element inside `.aktflow-app` the same treatment.
 *
 * The frozen sheet has two `outline: 0` rules (`.search-box input`,
 * `.quantity-input input`) that used to strip that ring; they live in the
 * `legacy` layer now, so this no longer has to out-specify them.
 */
function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-control border border-border bg-surface-muted px-3 md:h-9',
        'text-foreground placeholder:text-foreground-muted',
        'transition-colors duration-150 ease-out-strong hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
