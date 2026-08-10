import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Menu, X } from 'lucide-react'
import EvidenceWindow from '../components/EvidenceWindow'
import ProofBoundary from '../components/ProofBoundary'
import { Button } from '../components/ui/button'

/**
 * Task 11 (highest-risk content task, spec A.4.20 / A.3.5 surface 2).
 *
 * This is NOT a line-for-line port of prototype/src/pages/Landing.jsx.
 * The prototype's landing was written for the full, imagined product and
 * carries claims this codebase cannot back: a priced tariff table, a native
 * mobile field app for the two usual phone platforms (named here only that
 * obliquely — tests/claims.test.ts's mobile-app pattern scans comments too, and
 * it should), an access-control guarantee, a data-export guarantee, and a hero
 * mockup with invented live-object numbers. Every sentence below was checked
 * against what src/domain/types.ts and src/data/project.ts actually model, not
 * against the prototype's copy.
 *
 * Cut entirely rather than reworded, because no reframing of them stays honest:
 * the pricing table; the mobile/offline field section (no such route, no such
 * capability); the security section's access-control / version-integrity /
 * export guarantees (nothing models permissions, audit trails or export); and
 * the four-step "import estimate" story (there is no import feature).
 *
 * doc 05 §10's above-the-fold order is fixed regardless: outcome statement (h1)
 * → explanation (p) → demo/pilot CTA → ProofBoundary. The disclosure strip above
 * every route already carries the immediate honesty signal, so this page still
 * opens with what the product is for, not with the disclaimer (decision D1).
 *
 * ── THE REWRITE ──────────────────────────────────────────────────────────────
 *
 * The hero used to be copy-only, because the only product visual available at
 * the time was the prototype's fabricated one. That left half the fold empty
 * AND left the page unable to show the single argument the product exists to
 * make. Both are now fixed by the same component: `EvidenceWindow` renders one
 * real row from the shipped dataset — its own dates, its own gaps, its own
 * amounts, nothing authored. See that file for why this is the only kind of
 * product visual this project may ship.
 *
 * The page also moved off the frozen `.landing`/`.hero`/`.final-cta` classes
 * onto the design system, so it is now one system with /app instead of two.
 * `.brand`/`.brand__mark` stay: those are the logo, not layout.
 */

const NAV_LINKS = [
  { href: '#how', label: 'Як це працює' },
  { href: '#proof-boundary-heading', label: 'Чесність' },
] as const

/**
 * The mechanism, in the order it happens on a site. Three steps because the
 * domain has three, not because three is a comfortable number for a row of
 * cards — and rendered as a numbered sequence because the order genuinely
 * carries meaning here: step two is only possible before step three.
 */
const MECHANISM = [
  {
    title: 'Кожен рядок робіт має власний перелік вимог до доказів',
    body: 'Фото, обсяг, протокол — те, що саме для цієї позиції треба зафіксувати. Видно, чого бракує, ще до подання.',
  },
  {
    title: 'Частину доказів можна отримати тільки до закриття конструкції',
    body: 'Кабель у лотку, штроба, контур заземлення. Після того як їх закрили, доказ не відновити без розкриття — і система показує це як окремий факт, а не як звичайний прострочений пункт.',
  },
  {
    title: 'Стан готовності до подання видно по всьому періоду',
    body: 'Скільки рядків готові, скільки чекають перевірки, скільки тримають гроші через відсутній доказ — однією сумою і одним переліком.',
  },
] as const

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="goproceed-app">
      <header
        data-site-header
        className="sticky top-strip z-30 border-b border-border bg-surface/90 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-[1240px] items-center gap-4 px-5 py-3 md:px-8">
          <Link className="brand" to="/" aria-label="GoProceed — головна">
            <span className="brand__mark">
              <span />
            </span>
            <span>GoProceed</span>
          </Link>

          <nav
            aria-label="Розділи сторінки"
            className={`${menuOpen ? 'flex' : 'hidden'} absolute inset-x-5 top-full flex-col gap-1 rounded-panel border border-border bg-surface p-2 shadow-raised md:static md:ml-6 md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          >
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 font-medium text-foreground-secondary transition-colors duration-150 ease-out-strong hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link to="/demo">Переглянути демо</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link to="/pilot">
                Розкажіть, як у вас <ArrowRight />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(open => !open)}
              aria-label="Меню"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* doc 05 §10 above-the-fold slots 1-3: outcome statement, explanation, CTA. */}
        <section id="product" className="mx-auto w-full max-w-[1240px] px-5 pb-14 pt-12 md:px-8 md:pt-16">
          <div className="grid items-start gap-10 wide:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] wide:gap-14">
            <div>
              <span className="inline-flex items-center rounded-pill bg-accent px-3 py-1 text-meta font-semibold text-accent-foreground">
                Для електромонтажних підрядників в Україні
              </span>
              <h1 className="mt-5 text-[clamp(2.25rem,6vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                Виконані роботи мають ставати оплатою.
              </h1>
              <p className="mt-5 max-w-[54ch] text-body text-foreground-secondary md:text-h3">
                GoProceed пов’язує кожну позицію робіт із вимогами до доказів і станом готовності до подання — щоб було
                видно, що саме блокує подання акта виконаних робіт, ще до самого подання.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild variant="signal">
                  <Link to="/pilot">
                    Розкажіть, як у вас <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/demo">Переглянути демо</Link>
                </Button>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-foreground-muted">
                {['Без заміни обліку', 'Без інтеграцій', 'Дані демонстрації — синтетичні'].map(fact => (
                  <li key={fact} className="flex items-center gap-2">
                    <Check size={15} aria-hidden="true" className="text-accent-ink" />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            <EvidenceWindow />
          </div>
        </section>

        {/* doc 05 §10 above-the-fold slot 4: the conservative proof boundary. */}
        <ProofBoundary />

        <section id="how" aria-labelledby="how-heading" className="border-y border-border bg-surface-muted">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-14 md:px-8">
            {/* Same editorial grammar as ProofBoundary: what this is on the
                left, the substance on the right. */}
            <div className="grid gap-x-12 gap-y-6 wide:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div>
                <h2 id="how-heading" className="text-h1">
                  Як це працює
                </h2>
                <p className="mt-3 max-w-[46ch] text-body text-foreground-secondary">
                  Це опис задуму на прикладі одного синтетичного об’єкта, а не перелік готових функцій.
                </p>
              </div>

              {/*
               * Numbered because the order is load-bearing, not for decoration:
               * step 2 is only possible *before* step 3, and that is the entire
               * argument. A plain bulleted list would throw that away.
               */}
              <ol className="grid gap-px overflow-hidden rounded-panel border border-border bg-border">
                {MECHANISM.map((step, index) => (
                  <li key={step.title} className="grid gap-x-5 gap-y-2 bg-surface p-5 md:grid-cols-[2.5rem_1fr]">
                    <span
                      aria-hidden="true"
                      className="text-h2 font-extrabold leading-none tabular-nums text-foreground-subtle"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-h3">{step.title}</h3>
                      <p className="mt-2 text-foreground-secondary">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="final-cta-heading" className="bg-carbon text-rail-foreground">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-5 py-16 md:px-8 wide:flex-row wide:items-center wide:justify-between">
            <div>
              <h2 id="final-cta-heading" className="max-w-[20ch] text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-surface">
                Розкажіть, як влаштовано закриття періоду у вас.
              </h2>
              <p className="mt-4 max-w-[58ch] text-body text-rail-muted">
                Це не форма реєстрації в продукт — кілька запитань про ваш процес, щоб зрозуміти, чи підійде GoProceed
                вашим об’єктам, перш ніж щось будувати далі.
              </p>
            </div>
            <Button asChild variant="signal" className="shrink-0">
              <Link to="/pilot">
                Розкажіть, як у вас <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-8 md:px-8">
          <Link className="brand" to="/" aria-label="GoProceed — головна">
            <span className="brand__mark">
              <span />
            </span>
            <span>GoProceed</span>
          </Link>
          <p className="text-foreground-muted">
            Демонстраційний прототип для спеціалізованих електромонтажних підрядників.
          </p>
          <div className="ml-auto flex items-center gap-4">
            <Link
              to="/legal/privacy"
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-foreground"
            >
              Конфіденційність
            </Link>
            <Link
              to="/legal/terms"
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-foreground"
            >
              Умови
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
