import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn's Textarea, restyled to match `./input.tsx` exactly.
 *
 * Same reasoning as Input: inset rather than raised, because the field RECEIVES
 * content. The only divergence is height — a textarea cannot use Input's
 * `h-11 md:h-9`, because the whole point of the three free-text answers on
 * /pilot is that people write several lines into them. `min-h-28` is roughly
 * four lines at this type size, which is enough to look like it expects prose
 * rather than a phrase, and `resize-y` leaves the visitor in control past that.
 *
 * No focus ring here: `theme.css` gives every focusable element inside
 * `.aktflow-app` the same treatment.
 */
function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-28 w-full min-w-0 resize-y rounded-control border border-border bg-surface-muted px-3 py-2',
        'text-foreground placeholder:text-foreground-muted',
        'transition-colors duration-150 ease-out-strong hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
