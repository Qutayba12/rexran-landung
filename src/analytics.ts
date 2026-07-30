// Analytics.
// - Vercel Web Analytics is first-party (served from /_vercel/insights on our
//   own domain), so it is NOT blocked by ad blockers, Safari ITP, or Edge
//   tracking prevention — it always counts real visits. It needs no ID and is
//   enabled in the Vercel dashboard.
// - Google Analytics, Meta Pixel, and TikTok Pixel stay OFF unless their env
//   IDs are set: VITE_GA_MEASUREMENT_ID / VITE_META_PIXEL_ID / VITE_TIKTOK_PIXEL_ID.
import { inject as injectVercelAnalytics } from '@vercel/analytics'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] }
  }
}

function loadGoogleAnalytics(measurementId: string) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: unknown[]) { window.dataLayer!.push(args) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', measurementId)
}

// Standard Meta Pixel base code, adapted to avoid eval/inline-script patterns.
function loadMetaPixel(pixelId: string) {
  type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[] }
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }) as Fbq
  fbq.queue = []
  window.fbq = fbq

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)

  window.fbq('init', pixelId)
  window.fbq('track', 'PageView')
}

// Standard TikTok Pixel base code, adapted to load as a bundled module (no
// inline script) so it works under our strict CSP.
function loadTikTokPixel(pixelId: string) {
  // The TikTok SDK builds its queue object dynamically, so this stays untyped.
  const w = window as unknown as { TiktokAnalyticsObject?: string; ttq?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  w.TiktokAnalyticsObject = 'ttq'
  const ttq = (w.ttq = w.ttq || [])
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ttq.setAndDefer = function (t: any, e: string) {
    t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) }
  }
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m)
  ttq.load = function (id: string) {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js'
    ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url
    ttq._t = ttq._t || {}; ttq._t[id] = +new Date()
    ttq._o = ttq._o || {}; ttq._o[id] = {}
    const script = document.createElement('script')
    script.async = true
    script.src = `${url}?sdkid=${id}&lib=ttq`
    document.head.appendChild(script)
  }
  ttq.load(pixelId)
  ttq.page()
}

// TikTok's queue is attached to window at runtime; read it loosely.
function ttq() {
  return (window as unknown as { ttq?: { track?: (e: string, p?: Record<string, unknown>) => void } }).ttq
}

export function initAnalytics() {
  // First-party — always on, ad-blocker/ITP-proof.
  injectVercelAnalytics()
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
  const pixelId = import.meta.env.VITE_META_PIXEL_ID
  const tiktokId = import.meta.env.VITE_TIKTOK_PIXEL_ID
  if (gaId) loadGoogleAnalytics(gaId)
  if (pixelId) loadMetaPixel(pixelId)
  if (tiktokId) loadTikTokPixel(tiktokId)
}

// Fires when a customer opens the checkout — the key mid-funnel signal ad
// platforms optimize toward. No-op until a tracker is loaded.
export function trackInitiateCheckout() {
  window.gtag?.('event', 'begin_checkout')
  window.fbq?.('track', 'InitiateCheckout')
  ttq()?.track?.('InitiateCheckout')
}

// Fires once, right after a customer returns from a successful Stripe
// Checkout — safe to call even when no provider is configured (each tracker
// is a no-op until initAnalytics() has loaded it).
export function trackPurchase(sessionId: string | null) {
  window.gtag?.('event', 'purchase', sessionId ? { transaction_id: sessionId } : {})
  window.fbq?.('track', 'Purchase', sessionId ? { transaction_id: sessionId } : {})
  ttq()?.track?.('CompletePayment', sessionId ? { content_id: sessionId } : {})
}
