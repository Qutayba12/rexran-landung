import { useEffect, useState } from 'react'
import RexMark from './RexMark'
import { initAnalytics, trackPurchase } from './analytics'
import { Analytics } from '@vercel/analytics/react'

const REDIRECT_SECS = 9

function CheckSeal() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// Go home via a local anchor rather than assigning window.location — the same
// pattern used at checkout, to keep the React Compiler from flagging a global
// mutation. Kept out of render (called from effects only).
function goHome() {
  const a = document.createElement('a')
  a.href = '/'
  a.click()
}

export default function ThankYou() {
  const [secs, setSecs] = useState(REDIRECT_SECS)

  // Fire the purchase conversion once, only for a genuine return from Stripe
  // (?paid=1). No-op until analytics IDs are configured (see src/analytics.ts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      initAnalytics()
      trackPurchase(params.get('session_id'))
    }
    // Clean the URL so a refresh doesn't re-fire the conversion.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Gentle auto-return to the homepage.
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { if (secs <= 0) goHome() }, [secs])

  return (
    <>
    <Analytics />
    <div className="ty">
      <div className="stage">
        <div className="aurora a1" /><div className="aurora a2" /><div className="aurora a3" /><div className="mesh" />
      </div>
      <div className="grain" />

      <main className="ty-main">
        <div className="ty-seal" aria-hidden="true"><CheckSeal /></div>
        <div className="ty-kicker">Payment received</div>
        <h1>Thank you.</h1>
        <p className="ty-lede">Your order is confirmed. Rexran will email you shortly with your timeline, and your finished ads will arrive on a private download page — ready to run.</p>
        <a className="cta" href="/">Back to home</a>
        <p className="ty-redirect">{secs > 0 ? `Returning to the homepage in ${secs}s…` : 'Taking you home…'}</p>
        <a className="ty-brand" href="/"><RexMark className="ty-logo" />Rexran</a>
      </main>
    </div>
    </>
  )
}
