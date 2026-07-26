import type { ComponentProps } from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

import { cn } from '@/lib/utils'

/**
 * shadcn's Separator over Radix. The reason it is a primitive rather than a
 * `<div className="h-px bg-border" />`: Radix defaults it to
 * `aria-orientation` + `role="none"` and flips to a real `separator` role only
 * when `decorative` is false. A hand-rolled divider is either always announced
 * (noise between every visual group) or never announced (a real structural
 * boundary that assistive tech cannot see) — this makes it a choice at the
 * call site instead of an accident.
 */
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
