import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useMatch, useResolvedPath } from 'react-router-dom'
import { Boxes, Compass, ListChecks, Menu, MessageSquare, ScanLine, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Dashboard from '../pages/App'
import Work from '../pages/Work'
import Evidence from '../pages/Evidence'
import Rules from '../pages/Rules'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

/**
 * Exactly three live entries plus one roadmap entry, zero disabled items
 * (spec A.4.9). doc 05 §10's three nav groups are honestly collapsed to what
 * exists; everything else is named once, on /roadmap.
 *
 * `Boxes`/`ScanLine`/`ListChecks` are the exact icons
 * `prototype/src/components/AppShell.jsx` already uses for these same three
 * routes (/app/work, /app/evidence, /app/rules) — read for icon choice only,
 * no copy or structure borrowed. /roadmap has no prototype equivalent (it is
 * this deployment's own "Що далі" surface), so `Compass` was picked fresh.
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/nav.test.ts imports this constant directly from the shell component (see task interface contract).
export const SIDEBAR_ITEMS = [
  { to: '/app/work', label: 'Роботи', icon: Boxes },
  { to: '/app/evidence', label: 'Докази', icon: ScanLine },
  { to: '/app/rules', label: 'Правила', icon: ListChecks },
  { to: '/roadmap', label: 'Що далі', icon: Compass },
] as const

/**
 * The rail has three states, and they are a contract (task 15's viewport
 * table), not a preference:
 *
 *   <768px       off-canvas drawer behind a >=44px control
 *   768..1239px  collapsed to 68px of icons, labels in a tooltip
 *   >=1240px     240px open, labels visible
 *
 * Both hooks below read the same two breakpoints the theme defines, so the
 * behavioural half and the visual half can never drift onto different numbers.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/**
 * A tooltip on a labelled link is noise, so it is mounted only in the one
 * range where the label is not on screen. Note this is a *supplement*: the
 * label stays in the DOM at every width (visually hidden in the icon range),
 * so the link's accessible name never depends on the tooltip being reachable.
 */
function RailLabel({ children }: { children: string }) {
  return <span className="truncate md:sr-only wide:not-sr-only">{children}</span>
}

function RailLink({
  to,
  label,
  icon: Icon,
  showTooltip,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof Boxes
  showTooltip: boolean
  onNavigate: () => void
}) {
  /*
   * NEVER PASS A FUNCTION-VALUED `className` OR `children` INTO A RADIX
   * `asChild`. NavLink supports both in function form, and this used them —
   * until `TooltipTrigger asChild` wrapped the link between 768 and 1240px.
   * Radix's Slot MERGES props onto its child, and it merges `className` by
   * string concatenation. Handed a function, it stringifies it, so the live
   * DOM carried the source text of the arrow function as its class attribute.
   *
   * What made this genuinely nasty is that it half-worked. A class attribute
   * is a whitespace-delimited token list, and the stringified source still
   * contains most of the Tailwind names as separate tokens — so `flex`,
   * `min-h-11` and `relative` kept applying and the rail looked plausible in a
   * screenshot and measured 35x44 in a geometry probe. Only the tokens sitting
   * against a quote or comma were dropped: `px-3`, `font-medium`,
   * `duration-150`, `ease-out-strong`, `wide:px-3` — and, worst,
   * `text-surface` and `text-rail-muted`, which meant BOTH ternary branches
   * died and the active item lost every colour cue it had. Four nav links all
   * inheriting the rail's own foreground, with no "you are here" left but the
   * Lime bar.
   *
   * So `isActive` is resolved here instead, with the same two hooks NavLink
   * uses internally, and every prop below is a plain string or plain JSX.
   * `end: false` matches NavLink's own default. NavLink is kept rather than a
   * bare Link because it still contributes `aria-current="page"`, which is the
   * part of it that carries accessibility value.
   *
   * qa/verify.mjs now fails any route whose DOM contains a class attribute
   * that looks like source code, so this whole class of bug cannot return
   * silently anywhere in the app.
   */
  const resolved = useResolvedPath(to)
  const isActive = useMatch({ path: resolved.pathname, end: false }) !== null

  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 rounded-control px-3',
        'font-medium transition-colors duration-150 ease-out-strong',
        'md:justify-center md:px-0 wide:justify-start wide:px-3',
        isActive ? 'bg-rail-hover text-surface' : 'text-rail-muted hover:bg-rail-hover hover:text-rail-foreground',
      )}
    >
      {/*
       * Review 07 · A3: "you are here" used to be a solid Lime block, which
       * collapsed wayfinding and the primary action into one signal and spent
       * the <=5% Lime budget on every /app route before any action had been
       * offered. A tonal shift carries the state; a 3px Lime edge makes it
       * unmistakable. Absolutely positioned rather than a `border-l`, so the
       * active item's text does not shift 3px sideways as you navigate.
       */}
      {isActive ? (
        <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[3px] rounded-pill bg-accent" />
      ) : null}
      <Icon size={18} aria-hidden="true" />
      <RailLabel>{label}</RailLabel>
    </NavLink>
  )

  if (!showTooltip) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const isNarrow = useMediaQuery('(max-width: 767px)')
  const isIconRail = useMediaQuery('(min-width: 768px) and (max-width: 1239px)')
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setOpen(false)
  }

  /*
   * BEHAVIOUR PRESERVED VERBATIM FROM THE PRE-REWRITE SHELL. This is a
   * presentation rewrite; the drawer's focus contract was established by live
   * verification in an earlier round and is not being re-derived here. Only
   * the selectors changed, from the old `.sidebar*` class names to the
   * `data-*` hooks below — see qa/verify.mjs, which uses the same query.
   *
   * Focus into the drawer on open, an Escape path, and focus back to the
   * toggle on close — all via one effect keyed on `open`, not a direct
   * `.focus()` call inside `closeMenu`. The main column (including
   * `toggleRef`'s button) is `inert` while the drawer is open; a bare
   * `toggleRef.current?.focus()` called synchronously inside the click/key
   * handler ran BEFORE React committed the re-render that clears that `inert`,
   * so the browser silently dropped the focus call and left focus on <body>
   * (confirmed live: Escape closed the drawer but did not return focus). The
   * cleanup function below runs after React has committed the DOM for the
   * render where `open` became false, by which point `inert` is already
   * cleared, so the focus call actually lands.
   */
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    /*
     * `inert` on the rail/main alone stops focus ever landing on background
     * content, but it does not make Tab/Shift+Tab wrap in a single keystroke —
     * a browser's native Tab order has no "last" element that loops. Explicit
     * wrap-around, matching the WAI-ARIA APG modal dialog pattern, computed
     * fresh on every Tab (not cached at open-time) so it stays correct
     * regardless of DOM order changes. The backdrop is deliberately the trap's
     * last stop — it is a real, already-focusable <button> (aria-label
     * "Закрити меню").
     */
    function getDrawerFocusable(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-app-rail] a[href], [data-app-rail] button, [data-rail-backdrop]',
        ),
      )
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getDrawerFocusable()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // `noUncheckedIndexedAccess`: both are `HTMLElement | undefined` by type
      // even though `getDrawerFocusable()` can only return an empty array here
      // if the drawer's own markup vanished mid-session.
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    // Captured now rather than read from the ref inside the cleanup below —
    // react-hooks/exhaustive-deps flags reading `.current` inside a cleanup on
    // principle, so this satisfies the rule without disabling it.
    const toggle = toggleRef.current
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      toggle?.focus()
    }
  }, [open])

  const drawerHidden = isNarrow && !open

  return (
    <TooltipProvider>
      <div className="goproceed-app grid min-h-screen grid-cols-1 bg-background md:grid-cols-[68px_1fr] wide:grid-cols-[240px_1fr]">
        <a className="skip-link" href="#main-content" inert={isNarrow && open}>
          До основного вмісту
        </a>

        {/*
         * THE RAIL. doc 05 puts Carbon at 17-21% of surface; a full-height
         * 240px rail on a 1440px viewport is ~16.7% of it, so this dark region
         * IS that budget rather than an extra helping of it. Everything else in
         * the product is Paper or White.
         *
         * 240px against an otherwise unconstrained content column states the
         * relationship plainly: navigation serves the register, it is not its
         * peer.
         */}
        <aside
          data-app-rail
          data-open={open ? 'true' : 'false'}
          inert={drawerHidden}
          className={[
            'z-40 flex flex-col bg-rail text-rail-foreground',
            // Below md the rail is an overlay drawer, so it leaves the grid.
            'fixed inset-y-0 left-0 w-[min(300px,84vw)] shadow-drawer',
            open ? 'translate-x-0' : '-translate-x-full',
            'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out-strong',
            // From md up it is a real column again: sticky, full height, and
            // stopping just under the disclosure strip rather than at the
            // viewport edge, which would slide the brand out of sight.
            'md:sticky md:inset-auto md:top-strip md:h-[calc(100vh-var(--spacing-strip))]',
            'md:w-auto md:translate-x-0 md:shadow-none md:transition-none',
            'md:border-r md:border-rail-line',
            /*
             * NOT `md:items-center`. Measured: it shrank every rail child to
             * its content box, so at the 68px icon width a nav link's hit area
             * was 18x44 instead of 36x44 and the /pilot CTA was 16px wide. The
             * children stay full-width; each one centres its OWN content with
             * `md:justify-center`, which is the difference between a centred
             * icon and a collapsed control.
             */
            'px-3 py-4 md:px-4 wide:px-3',
          ].join(' ')}
        >
          <div className="mb-6 flex items-center justify-between gap-2 md:mb-8 md:justify-center wide:justify-between">
            <Link
              to="/"
              aria-label="AktFlow — головна"
              className="brand brand--light flex min-h-11 items-center gap-2.5 rounded-control px-1 wide:px-3 md:px-0"
            >
              <span className="brand__mark">
                <span />
              </span>
              <span className="md:sr-only wide:not-sr-only">AktFlow</span>
            </Link>
            <Button
              ref={closeRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeMenu}
              aria-label="Закрити меню"
              data-rail-close
              className="text-rail-muted hover:bg-rail-hover hover:text-rail-foreground md:hidden"
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Основна навігація">
            {SIDEBAR_ITEMS.map(item => (
              <RailLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                showTooltip={isIconRail}
                onNavigate={closeMenu}
              />
            ))}
          </nav>

          {/*
           * ER-7c: /pilot is the only structured capture surface and the email
           * permits exactly one link, so it needs a reachable entry that is NOT
           * a sidebar nav item. Review 07 · A1/A2 moved it out of a band above
           * every /app <h1>, where it outranked the page title on a triage
           * screen, to the foot of the rail — one click away, consuming none of
           * the fold. It is the single Lime fill in the product.
           */}
          <div className="mt-auto pt-6">
            <Button asChild variant="signal" className="w-full md:px-0 wide:px-4">
              {/* MessageSquare, not Compass: /roadmap already owns Compass in
                  the nav above, and at the 68px rail both collapse to icon
                  only — two different destinations behind one glyph. */}
              <NavLink to="/pilot" data-testid="pilot-cta">
                <MessageSquare size={16} aria-hidden="true" />
                <span className="md:sr-only wide:not-sr-only">Розкажіть, як у вас</span>
              </NavLink>
            </Button>
          </div>
        </aside>

        {/*
         * The content column. `min-w-0` is load-bearing: a grid item defaults
         * to `min-width: auto`, so the register's own horizontal overflow would
         * otherwise widen this track and push the whole page sideways instead
         * of scrolling inside its own panel.
         */}
        <div className="flex min-w-0 flex-col">
          {/*
           * Below md the rail is off-canvas, so this bar carries the only route
           * back to it — and the brand, which lives in the rail at every other
           * width. Above md it is gone entirely: 56px of chrome that repeats
           * what the rail already says is 56px not spent on the register.
           */}
          <header
            className="sticky top-strip z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:hidden"
            inert={isNarrow && open}
          >
            <Button
              ref={toggleRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              aria-label="Відкрити меню"
              aria-expanded={open}
              data-rail-toggle
            >
              <Menu size={20} aria-hidden="true" />
            </Button>
            <Link className="brand flex min-h-11 items-center gap-2.5" to="/" aria-label="AktFlow — головна">
              <span className="brand__mark">
                <span />
              </span>
              <span>AktFlow</span>
            </Link>
          </header>

          <main
            className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 md:px-6 md:py-8 wide:px-8"
            id="main-content"
            tabIndex={-1}
            inert={isNarrow && open}
          >
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="work" element={<Work />} />
              <Route path="evidence" element={<Evidence />} />
              <Route path="rules" element={<Rules />} />
              <Route path="*" element={<Navigate to="/demo" replace />} />
            </Routes>
          </main>

          {/*
           * A genuine contentinfo landmark for /app/*. It is a sibling of
           * <main> inside a plain <div>, never a descendant of it: the
           * HTML/ARIA mapping strips a <footer>'s implicit contentinfo role
           * when it sits inside main/article/aside/nav/section, so nesting it
           * there would render the same markup carrying no landmark at all.
           */}
          <footer className="border-t border-border" inert={isNarrow && open}>
            {/* The rule spans the column; the content inside it stops at the
                same 1240px measure as <main>, so the two align rather than the
                footer running wider than everything it closes off. */}
            <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-4 text-foreground-muted md:px-6 wide:px-8">
              <span>AktFlow — демонстраційний прототип.</span>
              {/* min-w-11 alongside min-h-11: WCAG 2.5.5 is 44px in BOTH
                  directions, and «Умови» measures ~46px of text — close enough
                  to the floor that a font or weight change would silently drop
                  it under. */}
              <Link
                className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-foreground"
                to="/legal/privacy"
              >
                Конфіденційність
              </Link>
              <Link
                className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-foreground"
                to="/legal/terms"
              >
                Умови
              </Link>
            </div>
          </footer>
        </div>

        {open ? (
          <button
            type="button"
            data-rail-backdrop
            className="fixed inset-0 z-30 border-0 bg-carbon/45 md:hidden"
            onClick={closeMenu}
            aria-label="Закрити меню"
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
