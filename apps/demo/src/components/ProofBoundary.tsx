/**
 * Surface 2 of the honesty contract, occupying doc 05 §10's fourth
 * above-the-fold slot — the "conservative proof boundary" the layout grammar
 * already reserves. The landing therefore still OPENS with the outcome
 * statement rather than with an apology (decision D1).
 */
export default function ProofBoundary() {
  return (
    <section className="proof-boundary" aria-labelledby="proof-boundary-heading">
      <h2 id="proof-boundary-heading">Це демонстраційний прототип.</h2>
      <p>
        Дані повністю синтетичні. Це не робочий продукт: немає реєстрації,
        збереження даних та інтеграцій. Продукт не має клієнтів і не має
        підтвердженого попиту — саме це я зараз і досліджую.
      </p>
      <ul className="proof-boundary__not">
        <li>Не гарантує оплату або прийняття замовником.</li>
        <li>Не надає юридичної сили жодному типу доказу.</li>
        <li>Не замінює кошторисника, ПТО чи юриста.</li>
      </ul>
    </section>
  )
}
