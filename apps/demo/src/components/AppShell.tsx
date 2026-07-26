import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from '../pages/App'
import Work from '../pages/Work'
import Evidence from '../pages/Evidence'
import Rules from '../pages/Rules'

/**
 * Exactly three live entries plus one roadmap entry, zero disabled items
 * (spec A.4.9). doc 05 §10's three nav groups are honestly collapsed to what
 * exists; everything else is named once, on /roadmap.
 */
// eslint-disable-next-line react-refresh/only-export-components -- tests/nav.test.ts imports this constant directly from the shell component (see task interface contract).
export const SIDEBAR_ITEMS = [
  { to: '/app/work', label: 'Роботи' },
  { to: '/app/evidence', label: 'Докази' },
  { to: '/app/rules', label: 'Правила' },
  { to: '/roadmap', label: 'Що далі' },
] as const

export default function AppShell() {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">До основного вмісту</a>
      <aside className="sidebar">
        <nav className="sidebar__nav" aria-label="Основна навігація">
          {SIDEBAR_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-main" id="main-content" tabIndex={-1}>
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
    </div>
  )
}
