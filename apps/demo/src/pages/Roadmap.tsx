import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ConceptSketch, { type ConceptKind } from '../components/ConceptSketch'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { pluralUk } from '../domain/format'

/**
 * The three entries mirror qa/routes.mjs's REDIRECTED_ROUTES: variations,
 * external-review, and receivables+payments — every non-shipped surface this
 * demo redirects away from is named exactly once, here, rather than left
 * unexplained.
 *
 * NOT a feature grid: no icon-in-circle cards, no 3-column symmetry (AI-slop
 * blacklist #2 and #3). A single annotated sequence, one job for the page.
 *
 * ── WHY EACH ENTRY NOW CARRIES A SKETCH AND A REASON ─────────────────────────
 *
 * The page used to be three titles and the words «Концептуально · не
 * реалізовано» three times. That is honest but useless: it names gaps without
 * saying what would fill them or why anyone should care, which makes it read as
 * a disclaimer rather than a direction.
 *
 * `why` answers the only question worth answering here — what breaks today, in
 * the reader's own working life. It is written from the subcontractor's side of
 * the screen and describes a PROBLEM, which is a fact about the industry, not a
 * claim about this software.
 *
 * `shape` describes the intended form in the CONDITIONAL, always. Never «система
 * показує», always «показувала б». The grammatical mood is doing real work:
 * present tense here would be a capability claim about a thing that does not
 * exist.
 *
 * See ConceptSketch for the three rules that keep the wireframes from reading
 * as screenshots — chiefly that they contain no numbers at all.
 */
const CONCEPTUAL: readonly {
  kind: ConceptKind
  title: string
  why: string
  shape: string
}[] = [
  {
    kind: 'changes',
    title: 'Зміни та додаткові роботи',
    why:
      'Роботи, яких не було в кошторисі, все одно виконують — а домовляються про них у месенджері. ' +
      'До моменту закриття періоду ніхто вже не пам’ятає, хто що погодив, і ці обсяги часто просто не потрапляють в акт.',
    shape:
      'Зміна була б окремим рядком, прив’язаним до кошторисного, зі своїми вимогами до доказів і власним станом ' +
      'погодження — щоб її було видно в тому самому реєстрі, а не в листуванні.',
  },
  {
    kind: 'review',
    title: 'Зовнішній перегляд пакета',
    why:
      'Пакет дивиться інженер генпідрядника, і зауваження повертаються поштою. Версії розходяться, ' +
      'причину повернення доводиться шукати в переписці, а виправляти — навпомацки.',
    shape:
      'Перегляд відбувався б за посиланням, без облікового запису, а рішення фіксувалося б для кожного рядка окремо. ' +
      'Повернення несло б причину, прикріплену до конкретного рядка.',
  },
  {
    kind: 'receivables',
    title: 'Дебіторська заборгованість і платежі',
    why:
      'Підписаний акт — ще не гроші. Розрив між поданням і оплатою і є те місце, де в підрядника закінчується оборотка, ' +
      'і зазвичай його ніде не видно цілком.',
    shape:
      'Вік заборгованості показувався б поряд із поданими рядками, з якими він пов’язаний, — щоб було видно не лише ' +
      'скільки чекає оплати, а й за що саме.',
  },
]

/**
 * A top-level route (see src/App.tsx), not nested under AppShell — unlike the
 * four /app/* pages there is no rail here, so this page renders its own header
 * and <main>.
 */
export default function Roadmap() {
  return (
    <div className="goproceed-app min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1240px] items-center gap-4 px-5 py-3 md:px-8">
          <Link className="brand" to="/" aria-label="AktFlow — головна">
            <span className="brand__mark">
              <span />
            </span>
            <span>AktFlow</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link to="/app">
              <ArrowLeft /> До робочої області
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-5 py-10 md:px-8">
        <PageHeader
          title="Що далі"
          meta="Напрям, а не наявні функції"
          stat={`${CONCEPTUAL.length} ${pluralUk(CONCEPTUAL.length, 'напрям', 'напрями', 'напрямів')} · жоден не реалізовано`}
        />

        {/*
         * The disclaimer stays FIRST and stays blunt. Everything below it is
         * conditional-mood description of things that do not exist, and a reader
         * who skims must hit this before any of it.
         */}
        <p className="mb-9 max-w-[62ch] rounded-panel border-l-[3px] border-warning bg-warning-surface px-4 py-3 text-body text-warning-foreground">
          Нічого з наведеного нижче зараз не працює. Ескізи — умовні: вони показують задуману форму, а не інтерфейс, і
          свідомо не містять жодних цифр, бо будь-яка цифра тут була б вигаданою.
        </p>

        <ol className="flex flex-col gap-10">
          {CONCEPTUAL.map((entry, index) => (
            <li key={entry.kind}>
              <article className="grid gap-x-12 gap-y-5 wide:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] wide:items-start">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className="text-h2 font-extrabold leading-none tabular-nums text-foreground-subtle"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="text-h2">{entry.title}</h2>
                  </div>
                  <span className="mt-2 inline-flex items-center rounded-pill bg-surface-sunken px-2 py-1 text-meta font-semibold text-foreground-muted">
                    Концептуально · не реалізовано
                  </span>

                  <h3 className="mt-5 text-meta font-semibold uppercase tracking-[0.06em] text-foreground-muted">
                    Що не працює сьогодні
                  </h3>
                  <p className="mt-1.5 max-w-[62ch] text-foreground-secondary">{entry.why}</p>

                  <h3 className="mt-4 text-meta font-semibold uppercase tracking-[0.06em] text-foreground-muted">
                    Якої форми це набуло б
                  </h3>
                  <p className="mt-1.5 max-w-[62ch] text-foreground-secondary">{entry.shape}</p>
                </div>

                <ConceptSketch kind={entry.kind} />
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
