import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import StatusChip from '../components/StatusChip'

/**
 * A register reads in code order, not insertion order — the dataset in
 * src/data/project.ts is authored by discovery date, not by code, so it
 * sorts here rather than being pre-sorted at the source.
 */
const SORTED_ITEMS = [...PROJECT.workItems].sort((a, b) => a.code.localeCompare(b.code, 'uk'))

const TOTAL_VALUE = PROJECT.workItems.reduce((sum, item) => sum + item.valueUah, 0)

/**
 * Ruling 2 (Task 10): the full register, one row per PROJECT.workItems
 * entry, using the existing `.work-table` design-system class rather than
 * inventing a new table style. Quantity "against plan" is rendered as two
 * columns — planned and captured, both unit-suffixed — since that is the
 * only lossless way to show a shortfall (a single "12/18 шт" string would
 * still need two numbers; two columns keep both scannable at table width).
 */
export default function Work() {
  return (
    <>
      <h1>Реєстр робіт</h1>
      <div className="page-intro">
        <div>
          <h2>
            {PROJECT.workItems.length} позицій · {formatUah(TOTAL_VALUE)}
          </h2>
          <p>{PROJECT.name}</p>
        </div>
      </div>

      <section className="panel full-work-table" aria-label="Реєстр робіт">
        <div className="work-table">
          <div className="work-table__head">
            <span>Робота</span>
            <span>Локація</span>
            <span>Заплановано</span>
            <span>Зафіксовано</span>
            <span>Вартість</span>
            <span>Статус</span>
          </div>
          {SORTED_ITEMS.map(item => (
            <div className="work-row" key={item.id}>
              <span>
                <small>{item.code}</small>
                <b>{item.title}</b>
              </span>
              <span>{item.locationId}</span>
              <span>
                {item.plannedQuantity} {item.unit}
              </span>
              <span>
                {item.capturedQuantity} {item.unit}
              </span>
              <span>{formatUah(item.valueUah)}</span>
              <span>
                <StatusChip state={item.readiness} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
