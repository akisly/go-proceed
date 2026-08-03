import type { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * shadcn's Button, restyled onto doc 05 §3: "primary ink or signal background,
 * secondary outline, tertiary text". The variant set is the doc's, minus the
 * one it names that this product has no call site for.
 *
 * NO DESTRUCTIVE VARIANT. doc 05 lists one, and `--color-destructive` exists in
 * the theme for the evidence-blocking signal — but nothing under `/app/**`
 * deletes or discards anything, so a destructive button here would be a variant
 * that only ever gets used by being reached for wrongly. It goes in when a
 * destructive action does.
 *
 * NO FOCUS RING EITHER. `src/styles/theme.css` gives every focusable element
 * inside `.goproceed-app` one focus treatment — Slate outline plus a Lime halo,
 * matching the public routes. Restating it per variant is how two focus styles
 * end up disagreeing.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-control font-sans font-semibold',
    'transition-colors duration-150 ease-out-strong',
    // Press feedback: tactile, instant, and never far enough to look like a
    // bounce. Not a transition, so the reduced-motion block leaves it alone.
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        /** Carbon. The default commit action. */
        primary: 'bg-carbon text-surface hover:bg-carbon-hover',
        /**
         * Lime. Exactly one per screen, and only for the single highest-intent
         * action — doc 05 caps Lime at 5% of surface, and a second Lime button
         * is how that budget gets spent without anyone deciding to spend it.
         */
        signal: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        /** The workhorse. Border carries it; nothing lifts off the page. */
        outline: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
        /** Chrome — rail toggles, close controls. No edge until touched. */
        ghost: 'text-foreground hover:bg-surface-muted',
        /** Inline, inside running text. */
        link: 'text-foreground underline underline-offset-4 hover:text-accent-ink',
      },
      size: {
        /**
         * Two numbers per size, and the small one is never below 44px.
         *
         * WCAG 2.5.5's 44px is a floor, not a preference, and the audience for
         * the phone layout is a site engineer working one-handed and often
         * gloved — so every size collapses to the same 44px there. The variants
         * only diverge at the desk, where the pointer is precise and the whole
         * period has to fit in one fold.
         */
        default: 'h-11 px-4 md:h-9',
        sm: 'h-11 px-3 md:h-8',
        icon: 'size-11 md:size-9',
        'icon-sm': 'size-11 md:size-8',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

/**
 * `buttonVariants` is deliberately NOT exported, though upstream shadcn exports
 * it. Nothing needs it: `asChild` already covers rendering a link or a NavLink
 * with button styling, which is the only reason it usually gets reached for. An
 * exported variant function with no call site is a second, parallel way to
 * style a button — and the first thing to drift.
 */
export { Button }
