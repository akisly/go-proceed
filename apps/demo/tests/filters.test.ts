import { describe, expect, it } from 'vitest'
import { filterWorkItems } from '../src/pages/Work'
import { itemsForGapFilter } from '../src/pages/Evidence'
import { PROJECT } from '../src/data/project'
import type { WorkItem } from '../src/domain/types'

/**
 * Task 14 controller RULING 2: the readiness filter (/app/work) and the
 * blocking/non-blocking filter (/app/evidence) are real, exported, pure
 * functions rather than logic buried inside a component — this workspace's
 * vitest config runs under Node with no DOM (see vitest.config.ts;
 * component-level behaviour is the puppeteer QA harness's job), so this is
 * the only way to verify the filtering logic directly.
 */

function item(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'code' | 'readiness'>): WorkItem {
  return {
    title: 'Тестова робота',
    locationId: 'Секція А',
    plannedQuantity: 1,
    capturedQuantity: 1,
    unit: 'шт',
    valueUah: 10_000,
    concealmentHoldPoint: false,
    concealedAt: null,
    recoveryCostUah: null,
    requirements: [],
    ...overrides,
  }
}

describe('filterWorkItems (/app/work)', () => {
  it('returns every item when the filter is "all" and the query is empty', () => {
    expect(filterWorkItems(PROJECT.workItems, 'all', '')).toHaveLength(PROJECT.workItems.length)
  })

  it('narrows to a single readiness state', () => {
    const result = filterWorkItems(PROJECT.workItems, 'submitted', '')
    expect(result.length).toBeGreaterThan(0)
    for (const workItem of result) {
      expect(workItem.readiness).toBe('submitted')
    }
  })

  it('matches the search query against code, title and location, case-insensitively', () => {
    const items = [
      item({ id: 'a', code: 'ЕМ-01.01', title: 'Прокладання кабелю', locationId: 'Секція А', readiness: 'not_started' }),
      item({ id: 'b', code: 'ЕМ-02.02', title: 'Монтаж щита', locationId: 'Секція Б', readiness: 'not_started' }),
    ]
    expect(filterWorkItems(items, 'all', 'кабелю')).toEqual([items[0]])
    expect(filterWorkItems(items, 'all', 'ЕМ-02')).toEqual([items[1]])
    expect(filterWorkItems(items, 'all', 'секція б')).toEqual([items[1]])
  })

  it('combines the readiness filter and the search query — the genuinely reachable empty case', () => {
    const items = [
      item({ id: 'a', code: 'ЕМ-01.01', title: 'Прокладання кабелю', readiness: 'evidence_missing' }),
      item({ id: 'b', code: 'ЕМ-02.02', title: 'Монтаж щита', readiness: 'ready_internal' }),
    ]
    // A real query a visitor could type that matches nothing at all.
    expect(filterWorkItems(items, 'all', 'zzz-no-such-code')).toEqual([])
    // A valid readiness state crossed with a query that only matches the
    // OTHER item — zero rows, without any invented bucket.
    expect(filterWorkItems(items, 'evidence_missing', 'щита')).toEqual([])
  })

  it('trims whitespace from the query rather than treating it as a literal match failure', () => {
    const items = [item({ id: 'a', code: 'ЕМ-01.01', title: 'Прокладання кабелю', readiness: 'not_started' })]
    expect(filterWorkItems(items, 'all', '  кабелю  ')).toEqual(items)
  })
})

describe('itemsForGapFilter (/app/evidence)', () => {
  const blockingOnly = item({
    id: 'blocking',
    code: 'ЕМ-01.01',
    readiness: 'evidence_missing',
    requirements: [{ id: 'r1', kind: 'photo', label: 'Фото', status: 'pending', capturedAt: null, blocksSubmission: true }],
  })
  const nonBlockingOnly = item({
    id: 'non-blocking',
    code: 'ЕМ-02.02',
    readiness: 'evidence_missing',
    requirements: [{ id: 'r2', kind: 'file', label: 'Сертифікат', status: 'pending', capturedAt: null, blocksSubmission: false }],
  })
  const fullyClosed = item({
    id: 'closed',
    code: 'ЕМ-03.03',
    readiness: 'ready_internal',
    requirements: [{ id: 'r3', kind: 'photo', label: 'Фото', status: 'satisfied', capturedAt: '2026-07-01', blocksSubmission: true }],
  })
  const mixedSet = [blockingOnly, nonBlockingOnly, fullyClosed]

  it('"all" returns every item with at least one open (pending) requirement, excluding fully-closed items', () => {
    expect(itemsForGapFilter(mixedSet, 'all')).toEqual([blockingOnly, nonBlockingOnly])
  })

  it('"blocking" returns only items with an open requirement that blocks submission', () => {
    expect(itemsForGapFilter(mixedSet, 'blocking')).toEqual([blockingOnly])
  })

  it('"non-blocking" returns only items whose open requirements never block submission', () => {
    expect(itemsForGapFilter(mixedSet, 'non-blocking')).toEqual([nonBlockingOnly])
  })

  /**
   * The live dataset (src/data/project.ts) never empties either bucket —
   * tasks 4/5 deliberately covered both gap types, so BLOCKING_ITEMS (5) and
   * NON_BLOCKING_ITEMS (2) are both always non-empty (see task-14-report.md).
   * This proves the "Усі вимоги закрито" empty branch in Evidence.tsx is
   * correct, real filtering code — not simulated, not dead — using a
   * fixture set where the bucket is actually, honestly empty.
   */
  it('"blocking" returns zero rows once every requirement is either satisfied or non-blocking', () => {
    expect(itemsForGapFilter([nonBlockingOnly, fullyClosed], 'blocking')).toEqual([])
  })

  it('"non-blocking" returns zero rows once every requirement is either satisfied or blocking', () => {
    expect(itemsForGapFilter([blockingOnly, fullyClosed], 'non-blocking')).toEqual([])
  })

  it('the real PROJECT dataset never empties either bucket today (documents why the empty branch is not click-reachable live)', () => {
    expect(itemsForGapFilter(PROJECT.workItems, 'blocking').length).toBeGreaterThan(0)
    expect(itemsForGapFilter(PROJECT.workItems, 'non-blocking').length).toBeGreaterThan(0)
  })
})
