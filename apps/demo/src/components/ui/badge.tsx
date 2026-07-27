import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * shadcn's Badge, with the tone set this product actually has.
 *
 * The tones are not decorative: seven catalog states collapse to a handful, and
 * each pairs a tinted surface with a foreground measured against it (5.4:1 to
 * 7.5:1). The LABEL always carries the meaning — a tone only tints a label that
 * is already saying the thing, never replaces it. That is why there is no
 * icon-only badge here and no tone without accompanying text.
 *
 * THREE tones, though the theme defines four. `readinessTone()`
 * (src/domain/readiness.ts) currently groups «Очікує перевірки» with «Бракує
 * доказів» as one amber tone, so the blue `readiness-review-*` tokens are
 * unreachable. Splitting them is defensible — a review queue is not an evidence
 * gap, and the frozen sheet even ships a `.status--review` nobody uses — but
 * `readinessTone` is shared with /demo, which this rewrite is explicitly told
 * not to redesign. A fourth variant here would be a variant with no call site.
 *
 * `text-meta` (12px) rather than the frozen sheet's 11px: the QA harness fails
 * any element under 12px on /app and /app/work, and this is read all day.
 */
const badgeVariants = cva(
  'inline-flex w-max max-w-full items-center gap-1.5 rounded-pill px-2 py-1 text-meta font-semibold whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        ready: 'bg-readiness-ready-surface text-readiness-ready-foreground',
        attention: 'bg-readiness-attention-surface text-readiness-attention-foreground',
        idle: 'bg-readiness-idle-surface text-readiness-idle-foreground',
      },
    },
    defaultVariants: { tone: 'idle' },
  },
)

function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge }
