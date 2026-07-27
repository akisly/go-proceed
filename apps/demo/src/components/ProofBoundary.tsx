import { Info } from 'lucide-react'

/**
 * Surface 2 of the honesty contract, occupying doc 05 §10's fourth
 * above-the-fold slot — the "conservative proof boundary" the layout grammar
 * already reserves. The landing therefore still OPENS with the outcome
 * statement rather than with an apology (decision D1).
 *
 * The three "does not" lines are the load-bearing part and are set as a real
 * list on its own surface, not as body copy: they are commitments a reader
 * should be able to scan and hold the product to, not prose to skim past.
 *
 * The scope note («Що показує ця демонстрація») used to be its own band further
 * down the page, where it sat alone in a mostly empty section. It is the same
 * kind of statement as the three lines above it — what this is and is not — so
 * it belongs in this section, and folding it in removes a near-empty band.
 *
 * Copy is unchanged from the reviewed original in both cases. This is
 * presentation.
 */
export default function ProofBoundary() {
  return (
    <section aria-labelledby="proof-boundary-heading" className="mx-auto w-full max-w-[1240px] px-5 py-14 md:px-8">
      {/*
       * The page's editorial grammar, used by every mid-page section: a narrow
       * left column saying WHAT this section is, a wider right column carrying
       * the substance. It is what stops a 68ch measure — correct for reading —
       * from leaving 500px of dead canvas beside it on a wide screen.
       */}
      <div className="grid gap-x-12 gap-y-6 wide:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <h2 id="proof-boundary-heading" className="text-h1">
            Це демонстраційний прототип.
          </h2>
          <p className="mt-3 max-w-[46ch] text-body text-foreground-secondary">
            Дані повністю синтетичні. Це не робочий продукт: немає реєстрації, збереження даних та інтеграцій. Продукт
            не має клієнтів і не має підтвердженого попиту — саме це я зараз і досліджую.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <ul className="grid gap-px overflow-hidden rounded-panel border border-border bg-border">
            {[
              'Не гарантує оплату або прийняття замовником.',
              'Не надає юридичної сили жодному типу доказу.',
              'Не замінює кошторисника, ПТО чи юриста.',
            ].map(line => (
              <li key={line} className="flex items-start gap-3 bg-surface px-4 py-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-pill bg-warning" />
                <span className="text-foreground-secondary">{line}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-3 rounded-panel border border-border bg-info-surface p-4 text-info-foreground">
            <Info size={19} aria-hidden="true" className="mt-0.5" />
            <div>
              <b className="block font-semibold">Що показує ця демонстрація</b>
              <span className="mt-1 block">
                Один синтетичний об’єкт: реєстр робіт, вимоги до доказів і приклад готовності до подання пакета. Оплата,
                інтеграції, мобільний застосунок і рушій правил у цю демонстрацію не входять.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
