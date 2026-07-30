import { describe, it, expect } from 'vitest'
import { computeTotal, MIN_ORDER, PLANS, SERVICES } from './pricing.js'

describe('computeTotal', () => {
  it('prices fixed plans from the canonical table, ignoring anything else on the order', () => {
    for (const [name, price] of Object.entries(PLANS)) {
      expect(computeTotal({ package: name, total: 1 })).toBe(price)
    }
  })

  it('rejects an unknown package name', () => {
    expect(computeTotal({ package: 'Not A Real Plan' })).toBeNull()
  })

  it('prices a single custom line item by its chosen duration', () => {
    expect(computeTotal({ package: 'Custom', items: [{ key: 'ugc', qty: 1, duration: '15s' }] })).toBe(59)
    expect(computeTotal({ package: 'Custom', items: [{ key: 'ugc', qty: 1, duration: '30s' }] })).toBe(79)
  })

  it('sums multiple custom line items, including services with no duration', () => {
    const total = computeTotal({
      package: 'Custom',
      items: [
        { key: 'ugc', qty: 2, duration: '30s' },
        { key: 'static', qty: 3 },
      ],
    })
    expect(total).toBe(2 * 79 + 3 * 8)
  })

  it('never trusts a client-supplied total for custom orders', () => {
    const tampered = computeTotal({
      package: 'Custom',
      total: 1,
      items: [{ key: 'ugc', qty: 1, duration: '30s' }],
    })
    expect(tampered).toBe(79)
    expect(tampered).not.toBe(1)
  })

  it.each([
    ['missing items array', { package: 'Custom' }],
    ['empty items array', { package: 'Custom', items: [] }],
    ['missing duration on a service that requires one', { package: 'Custom', items: [{ key: 'ugc', qty: 1 }] }],
    ['a duration not offered by the service', { package: 'Custom', items: [{ key: 'ugc', qty: 1, duration: '20s' }] }],
    ['an unknown service key', { package: 'Custom', items: [{ key: 'not-a-service', qty: 1 }] }],
    ['a zero quantity', { package: 'Custom', items: [{ key: 'static', qty: 0 }] }],
    ['a non-integer quantity', { package: 'Custom', items: [{ key: 'static', qty: 1.5 }] }],
  ])('rejects an order with %s', (_label, order) => {
    expect(computeTotal(order)).toBeNull()
  })

  it('has a positive MIN_ORDER and at least one priced service', () => {
    expect(MIN_ORDER).toBeGreaterThan(0)
    expect(Object.keys(SERVICES).length).toBeGreaterThan(0)
  })
})
