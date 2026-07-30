// Canonical order pricing, mirroring src/App.tsx (SERVICES / PLANS).
// The server is the source of truth for checkout amounts — client-sent
// totals are never trusted directly (see api/checkout.js).

export const SERVICES = {
  ugc: { durations: { 15: 59, 30: 79 } },
  cine: { durations: { 15: 59, 30: 79 } },
  static: { price: 8 },
  shoot: { price: 12 },
}

export const PLANS = {
  Spark: 39,
  Growth: 99,
  Scale: 199,
  'Brand Partner': 549,
}

export const MIN_ORDER = 25

function priceForService(key, duration) {
  const sv = SERVICES[key]
  if (!sv) return null
  if (sv.durations) {
    return sv.durations[duration] != null ? sv.durations[duration] : null
  }
  return sv.price
}

// Recomputes the order total server-side from the package name and, for
// Custom orders, the requested service keys/quantities/durations.
// Returns null if the order shape is invalid or references unknown pricing.
export function computeTotal(o) {
  if (o.package === 'Custom') {
    if (!Array.isArray(o.items) || o.items.length === 0) return null
    let total = 0
    for (const it of o.items) {
      const key = it && it.key
      const qty = Number(it && it.qty)
      if (!key || !SERVICES[key] || !Number.isInteger(qty) || qty <= 0) return null
      const duration = it.duration ? parseInt(it.duration, 10) : undefined
      const price = priceForService(key, duration)
      if (price == null) return null
      total += qty * price
    }
    return total
  }
  return Object.prototype.hasOwnProperty.call(PLANS, o.package) ? PLANS[o.package] : null
}
