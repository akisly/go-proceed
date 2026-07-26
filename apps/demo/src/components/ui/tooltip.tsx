import type { ComponentProps } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

/**
 * shadcn's Tooltip over Radix.
 *
 * It earns its place in exactly one situation: between 768px and 1240px the
 * rail collapses to icons, and an icon with no label is a guess. The previous
 * implementation revealed the label with a `max-width: 0 -> 140px` transition
 * on hover/focus — which animates layout (dropping frames), pushes the rail's
 * own geometry around, and gives assistive tech nothing at all, since the
 * label was only ever visually hidden rather than described.
 *
 * CARBON MEANS CHROME. The disclosure strip, the rail and this tooltip are the
 * three Carbon surfaces in the product, and they are all the same thing: the
 * application talking about itself rather than showing data. Content surfaces
 * are Paper and White, without exception.
 */
function TooltipProvider({
  delayDuration = 200,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // `font-sans` and `motion-reduce:` are stated here rather than
          // inherited: Radix portals this to document.body, which is OUTSIDE
          // `.aktflow-app`, so neither the shell's font nor its reduced-motion
          // block reaches it. Anything that portals has to carry its own.
          'z-50 rounded-control bg-carbon px-2 py-1 font-sans text-meta font-medium text-surface shadow-raised',
          // Origin-aware: the chip grows out of the icon it belongs to, not out
          // of its own centre. Radix computes the origin per resolved side.
          'origin-(--radix-tooltip-content-transform-origin)',
          'data-[state=delayed-open]:animate-chip-in data-[state=instant-open]:animate-chip-in',
          'motion-reduce:animate-none',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
