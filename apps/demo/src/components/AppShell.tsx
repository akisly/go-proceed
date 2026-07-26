import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Boxes, Compass, ListChecks, Menu, ScanLine, X } from 'lucide-react'
import Dashboard from '../pages/App'
import Work from '../pages/Work'
import Evidence from '../pages/Evidence'
import Rules from '../pages/Rules'

/**
 * Exactly three live entries plus one roadmap entry, zero disabled items
 * (spec A.4.9). doc 05 §10's three nav groups are honestly collapsed to what
 * exists; everything else is named once, on /roadmap.
 *
 * Task 15: an `icon` is added to each entry for the 768–1239px "collapsed to
 * icons, labels on hover/focus" rail (see .sidebar__nav in styles/demo.css).
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
 * Task 15 (RULING 6's <768px off-canvas requirement): the sidebar becomes a
 * translated-offscreen drawer below 768px (`.sidebar` / `.sidebar--open` in
 * styles/demo.css, which moves the frozen stylesheet's 820px off-canvas
 * breakpoint to the brief's 768px). `transform: translateX(-100%)` alone
 * still leaves the drawer's links in the tab order while it is invisible —
 * a real keyboard trap — so `inert` (below) removes them from the
 * accessibility tree whenever the drawer is both narrow-viewport and
 * closed, and restores them the instant either condition changes.
 */
function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsNarrow(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isNarrow
}

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const isNarrow = useIsNarrowViewport()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setOpen(false)
  }

  /*
   * Fix round (task 15): focus into the drawer on open, an Escape path, and
   * focus back to the toggle on close — all via one effect keyed on `open`,
   * not a direct `.focus()` call inside `closeMenu`. `.app-main` (including
   * `toggleRef`'s button) is `inert` while the drawer is open; a bare
   * `toggleRef.current?.focus()` called synchronously inside the click/key
   * handler ran BEFORE React committed the re-render that clears that
   * `inert`, so the browser silently dropped the focus call and left focus
   * on <body> (confirmed live: Escape closed the drawer but did not return
   * focus). The cleanup function below runs after React has committed the
   * DOM for the render where `open` became false, by which point `inert`
   * is already cleared, so the focus call actually lands.
   */
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    // Captured now rather than read from the ref inside the cleanup below —
    // the button this ref points to does not change for the component's
    // lifetime, but react-hooks/exhaustive-deps flags reading `.current`
    // inside a cleanup on principle (it could be stale for a ref that DOES
    // get reassigned), so this satisfies the rule without disabling it.
    const toggle = toggleRef.current
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      toggle?.focus()
    }
  }, [open])

  return (
    <>
      <div className="app-frame">
        <a className="skip-link" href="#main-content">До основного вмісту</a>
        <aside className={`sidebar${open ? ' sidebar--open' : ''}`} inert={isNarrow && !open}>
          <button
            type="button"
            className="icon-button sidebar__close"
            onClick={closeMenu}
            aria-label="Закрити меню"
            ref={closeRef}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <nav className="sidebar__nav" aria-label="Основна навігація">
            {SIDEBAR_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Task 15 fix round: while the drawer is open on a narrow viewport,
            .app-main sits visually behind the dark backdrop but was still
            fully focusable — a keyboard user tabbing past the drawer's own
            links landed on header/pilot-cta/filter controls they could not
            see were "inside" an open modal-style overlay. `inert` mirrors
            the sidebar's own condition in reverse: exactly one of the two
            regions is interactive at a time on a narrow viewport. */}
        <main className="app-main" id="main-content" tabIndex={-1} inert={isNarrow && open}>
          <header className="app-header">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Відкрити меню"
              aria-expanded={open}
              ref={toggleRef}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <Link className="brand" to="/" aria-label="AktFlow — головна">
              <span className="brand__mark">
                <span />
              </span>
              <span>AktFlow</span>
            </Link>
          </header>
          {/* ER-7c: /pilot is the only structured capture surface and the email
              permits exactly one link, so it needs a reachable entry that is NOT
              a sidebar item. */}
          <aside className="pilot-cta">
            <NavLink to="/pilot" className="button button--signal" data-testid="pilot-cta">
              Розкажіть, як у вас
            </NavLink>
          </aside>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="work" element={<Work />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="rules" element={<Rules />} />
            <Route path="*" element={<Navigate to="/demo" replace />} />
          </Routes>
        </main>
        {open && <button type="button" className="sidebar-backdrop" onClick={closeMenu} aria-label="Закрити меню" />}
      </div>
      {/*
       * Task 15: a genuine contentinfo landmark for /app/*, which previously
       * had none — and no way back to "/" other than the browser's own back
       * button. Deliberately a sibling of .app-frame, not a child: .app-frame
       * is a fixed two-column grid (sidebar + main), and a third grid child
       * would auto-place into row 2 of the sidebar's own 238px column rather
       * than spanning full width. Nesting it inside <main> instead was also
       * rejected — the HTML/ARIA mapping strips a <footer>'s implicit
       * contentinfo role when it is a descendant of <main> (or
       * article/aside/nav/section), so it would render but carry no landmark
       * at all.
       */}
      <footer className="app-footer">
        <span>AktFlow — демонстраційний прототип.</span>
        <Link to="/legal/privacy">Конфіденційність</Link>
        <Link to="/legal/terms">Умови</Link>
      </footer>
    </>
  )
}
