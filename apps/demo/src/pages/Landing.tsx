import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Info, Menu, X } from 'lucide-react'
import ProofBoundary from '../components/ProofBoundary'

/**
 * Task 11 (highest-risk content task, spec A.4.20 / A.3.5 surface 2).
 *
 * This is NOT a line-for-line port of prototype/src/pages/Landing.jsx.
 * The prototype's landing was written for the full, imagined product and
 * carries claims this codebase cannot back: a priced tariff table, a native
 * mobile field app for the two usual phone platforms (named here only that
 * obliquely — tests/claims.test.ts's mobile-app pattern scans comments
 * too, and it should), an access-control guarantee, a data-export
 * guarantee, and a hero mockup with invented live-object numbers
 * ("БЦ Horizon", "45 днів пілоту", "1 живий об’єкт"). Task 10's fix round
 * (see progress.md) found the same failure mode in /app/rules: mechanical
 * checks were clean, the defect was in prose meaning. So every remaining
 * sentence here was checked against what src/domain/types.ts and
 * src/data/project.ts actually model, not against the prototype's copy.
 *
 * Cut entirely rather than reworded, because no reframing of them stays
 * honest:
 *  - the pricing table (doc 30 V-007 gates public pricing as unvalidated);
 *  - the mobile/offline field app section — no /field route ships (see
 *    qa/routes.mjs), no offline capability exists anywhere in this build,
 *    and "Consumes: nothing" (task interface contract) keeps this page
 *    independent of any of that;
 *  - the security section's access-control / version-integrity / export
 *    guarantees — nothing under src/domain or src/data models permissions,
 *    audit trails or export;
 *  - the four-step "import estimate" story — there is no import feature;
 *    the closest real thing is the work register at /app/work.
 *  - the numeric hero mockup and its fixture object name — replaced with a
 *    copy-only hero (see .hero--copy-only in styles/demo.css) so nothing
 *    on this page states a number this build did not compute.
 *
 * doc 05 §10's above-the-fold order is fixed regardless: outcome statement
 * (h1) → explanation (p) → demo/pilot CTA → ProofBoundary. The disclosure
 * strip above every route (see components/DisclosureStrip.tsx) already
 * carries the immediate honesty signal, so this page still opens with what
 * the product is for, not with the disclaimer (decision D1, ruling 5).
 */

const NAV_LINKS = [
  { href: '#scope', label: 'Що входить' },
  { href: '#proof-boundary-heading', label: 'Чесність' },
] as const

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="landing">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="AktFlow — головна">
          <span className="brand__mark">
            <span />
          </span>
          <span>AktFlow</span>
        </Link>
        <nav className={menuOpen ? 'open' : ''}>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="site-header__actions">
          <Link className="link-button" to="/demo">
            Переглянути демо
          </Link>
          <Link className="button button--dark button--small" to="/pilot">
            Розкажіть, як у вас <ArrowRight size={16} />
          </Link>
        </div>
        <button
          type="button"
          className="site-menu"
          onClick={() => setMenuOpen(open => !open)}
          aria-label="Меню"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        {/* doc 05 §10 above-the-fold slot 1-3: outcome statement, explanation, CTA. */}
        <section className="hero hero--copy-only" id="product">
          <div className="hero__copy">
            <span className="eyebrow-chip">Для підрядників-електромонтажників в Україні</span>
            <h1>Виконані роботи мають ставати оплатою.</h1>
            <p>
              AktFlow пов’язує кожну позицію робіт із вимогами до доказів і станом готовності до подання — щоб було
              видно, що саме блокує подання акта виконаних робіт, ще до самого подання.
            </p>
            <div className="hero__actions">
              <Link className="button button--signal" to="/pilot">
                Розкажіть, як у вас <ArrowRight size={18} />
              </Link>
              <Link className="button button--outline" to="/demo">
                Переглянути демо
              </Link>
            </div>
            <div className="hero__proof">
              <span>
                <Check size={15} /> Без заміни обліку
              </span>
              <span>
                <Check size={15} /> Без інтеграцій
              </span>
              <span>
                <Check size={15} /> Дані демонстрації — синтетичні
              </span>
            </div>
          </div>
        </section>

        {/* doc 05 §10 above-the-fold slot 4: the conservative proof boundary. */}
        <ProofBoundary />

        <div className="landing-boundary" id="scope">
          <div className="domain-boundary">
            <Info size={19} aria-hidden="true" />
            <div>
              <b>Що показує ця демонстрація</b>
              <span>
                Один синтетичний об’єкт: реєстр робіт, вимоги до доказів і приклад готовності до подання пакета.
                Оплата, інтеграції, мобільний застосунок і рушій правил у цю демонстрацію не входять.
              </span>
            </div>
          </div>
        </div>

        <section className="final-cta">
          <div>
            <h2>Розкажіть, як влаштовано закриття періоду у вас.</h2>
            <p>
              Це не форма реєстрації в продукт — кілька запитань про ваш процес, щоб зрозуміти, чи підійде AktFlow
              вашим об’єктам, перш ніж щось будувати далі.
            </p>
          </div>
          <Link className="button button--signal" to="/pilot">
            Розкажіть, як у вас <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer>
        <Link className="brand brand--light" to="/" aria-label="AktFlow — головна">
          <span className="brand__mark">
            <span />
          </span>
          <span>AktFlow</span>
        </Link>
        <p>Демонстраційний прототип для спеціалізованих електромонтажних підрядників.</p>
        <div>
          <Link to="/legal/privacy">Конфіденційність</Link>
          <Link to="/legal/terms">Умови</Link>
        </div>
      </footer>
    </div>
  )
}
