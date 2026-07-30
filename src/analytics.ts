// Analytics.
// - Vercel Web Analytics is first-party (served from /_vercel/insights on our
//   own domain), so it is NOT blocked by ad blockers, Safari ITP, or Edge
//   tracking prevention — it always counts real visits. It needs no ID and is
//   enabled in the Vercel dashboard.
// - Google Analytics + Meta Pixel stay OFF unless VITE_GA_MEASUREMENT_ID /
//   VITE_META_PIXEL_ID are set in the environment.
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

export function initAnalytics() {
  // First-party — always on, ad-blocker/ITP-proof.
  injectVercelAnalytics()
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
  const pixelId = import.meta.env.VITE_META_PIXEL_ID
  if (gaId) loadGoogleAnalytics(gaId)
  if (pixelId) loadMetaPixel(pixelId)
}

// Fires once, right after a customer returns from a successful Stripe
// Checkout — safe to call even when no provider is configured (each tracker
// is a no-op until initAnalytics() has loaded it).
export function trackPurchase(sessionId: string | null) {
  window.gtag?.('event', 'purchase', sessionId ? { transaction_id: sessionId } : {})
  window.fbq?.('track', 'Purchase', sessionId ? { transaction_id: sessionId } : {})
}
