import { cn } from '@/lib/utils'

/**
 * The readiness / gap-type filter.
 *
 * WHY CHIPS AND NOT A SELECT. Radix Select is installed and would be far more
 * compact for eight options. It is the wrong control here: this demo's whole
 * claim is that it covers the state catalog honestly, and a dropdown hides that
 * catalog behind a click. The visible option set IS content on this screen.
 *
 * WHY `aria-pressed` BUTTONS AND NOT TABS. These filter a list in place; they do
 * not switch between panels. `role="tab"` would promise a `tabpanel`
 * relationship that does not exist, and screen-reader users would be told to
 * expect one. A group of toggle buttons says exactly what this is.
 *
 * The row scrolls horizontally rather than wrapping: eight chips wrapping to
 * three lines at tablet width pushed the register down the page, and wrapping
 * also destroys the single-row shape that makes this read as one control.
 */
export default function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  renderLabel: (option: T) => string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:thin]"
    >
      {options.map(option => {
        const isActive = option === value
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={cn(
              'h-11 shrink-0 rounded-control px-3 font-medium whitespace-nowrap md:h-8 wide:px-2.5',
              'transition-colors duration-150 ease-out-strong active:scale-[0.98]',
              isActive
                ? 'bg-carbon text-surface'
                : 'bg-surface-muted text-foreground-secondary hover:bg-surface-sunken hover:text-foreground',
            )}
          >
            {renderLabel(option)}
          </button>
        )
      })}
    </div>
  )
}
