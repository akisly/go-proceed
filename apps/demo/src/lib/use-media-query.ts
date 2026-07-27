import { useEffect, useState } from 'react'

/**
 * The three shell states and the two register renderings are driven by the same
 * two breakpoints the theme defines, so both halves have to read them from one
 * place or they will eventually disagree about what "narrow" means.
 *
 * Kept in `lib/` rather than beside a component because it is imported by both
 * AppShell and WorkRegister, and because a `.tsx` file that exports a hook
 * alongside a component trips `react-refresh/only-export-components`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Below this the rail is a drawer and the register renders as cards. */
export const MEDIA_NARROW = '(max-width: 767px)'
/** The 68px icon rail: labels are off screen, so tooltips are mounted. */
export const MEDIA_ICON_RAIL = '(min-width: 768px) and (max-width: 1239px)'
