import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEMS } from '../src/components/AppShell'

describe('curated sidebar', () => {
  it('has exactly three live entries plus one roadmap entry', () => {
    expect(SIDEBAR_ITEMS).toHaveLength(4)
    expect(SIDEBAR_ITEMS.filter(i => i.to === '/roadmap')).toHaveLength(1)
  })

  it('does not list /pilot as a sidebar item', () => {
    // A.4.9 constrains the sidebar only; the /pilot CTA lives in the content area.
    expect(SIDEBAR_ITEMS.map(i => i.to)).not.toContain('/pilot')
  })

  it('uses the exact Ukrainian labels', () => {
    expect(SIDEBAR_ITEMS.map(i => i.label)).toEqual(['Роботи', 'Докази', 'Правила', 'Що далі'])
  })
})
