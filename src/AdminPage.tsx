import { useEffect, useState, type ReactNode } from 'react'
import RexMark from './RexMark'
import { r2Upload, forceDownload, contentTypeFor, downscaleImage, makeVideoPoster } from './mediaUtils'

type Video = { id: string; title: string; url: string; type: string; poster?: string }
const TYPES = ['UGC', 'Static', 'Cinematic & Motion Design', 'Photoshoot', 'Campaign']

type WorkspaceView = 'hub' | 'videos' | 'orders' | 'deliveries' | 'testimonials' | 'promos'

// Follows the cursor position into --mx/--my so the .glow radial gradient
// tracks the pointer — same pattern used site-wide (see App.tsx's `tilt`).
const tilt = (e: React.MouseEvent<HTMLDivElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="14" height="13" rx="2" />
      <path d="M16.5 10.3 21.5 7v10l-5-3.3" />
    </svg>
  )
}
function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}
function DeliveriesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 21 7.5v9L12 21 3 16.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  )
}
function TestimonialsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 14.5 8l5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4L11.5 8Z" />
    </svg>
  )
}
function PromoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 13.3 13.3 20.5a2 2 0 0 1-2.8 0L3 13V3.5h9.5l8 8a2 2 0 0 1 0 1.8Z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </svg>
  )
}

export default function Admin() {
  const [pw, setPw] = useState('')
  const [authed, setAuthed] = useState(false)
  const [view, setView] = useState<WorkspaceView>('hub')
  // Stable "now" for promo live/expired checks — computed once so render stays
  // pure (calling Date.now() during render trips the React Compiler purity rule).
  const [nowTs] = useState(() => Date.now())
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [url, setUrl] = useState('')
  const [type, setType] = useState('UGC')
  const [poster, setPoster] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)

  const uploadFile = async (file: File) => {
    setErr(''); setUploading(true); setUploadPct(0)
    try {
      const isVideo = /^video\//.test(contentTypeFor(file))
      // Showcase images are shrunk before upload so they load fast on mobile;
      // videos upload as-is but we grab a lightweight poster (below).
      const toSend = isVideo ? file : await downscaleImage(file)
      const publicUrl = await r2Upload(toSend, { endpoint: '/api/upload', password: pw, kind: 'portfolio', onProgress: setUploadPct })
      setUploadPct(100)
      setUrl(publicUrl)
      if (isVideo) {
        const poster = await makeVideoPoster(file).catch(() => null)
        if (poster) {
          const posterUrl = await r2Upload(poster, { endpoint: '/api/upload', password: pw, kind: 'portfolio' }).catch(() => '')
          if (posterUrl) setPoster(posterUrl)
        }
      }
    } catch (e) {
      setErr('Upload failed: ' + String(e instanceof Error ? e.message : e))
    } finally {
      setUploading(false)
    }
  }

  const loadVideos = async () => {
    try {
      const r = await fetch('/api/videos')
      const d = await r.json()
      setVideos(d.videos || [])
    } catch { /* ignore */ }
  }

  // Fetch-on-mount: an inline async IIFE with an "ignore" cancellation flag,
  // the pattern React's docs recommend for effects that fetch data, so the
  // setState call is a callback response to the fetch — never synchronous
  // within the effect body itself.
  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const r = await fetch('/api/videos')
        const d = await r.json()
        if (!ignore) setVideos(d.videos || [])
      } catch { /* ignore */ }
    })()
    return () => { ignore = true }
  }, [])

  const tryLogin = async () => {
    setErr(''); setLoading(true)
    try {
      // validate password by attempting a harmless add-less call: we use a delete with no id
      const r = await fetch('/api/admin-videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'delete', id: '__none__' }),
      })
      if (r.status === 401) { setErr('Wrong password.'); setLoading(false); return }
      setAuthed(true)
      await loadVideos()
      await loadDeliveries(pw)
      await loadOrders(pw)
      await loadTestimonials(pw)
      await loadPromos(pw)
      await loadCodes(pw)
    } catch {
      setErr('Could not connect. Try again.')
    } finally { setLoading(false) }
  }

  const addVideo = async () => {
    if (!url.trim()) { setErr('Add a video URL.'); return }
    setErr(''); setLoading(true)
    try {
      const r = await fetch('/api/admin-videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'add', video: { url, type, poster } }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setVideos(d.videos)
      setUrl(''); setPoster(''); setType('UGC')
    } catch (e) {
      setErr('Could not add. ' + String(e))
    } finally { setLoading(false) }
  }

  const removeVideo = async (id: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin-videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'delete', id }),
      })
      const d = await r.json()
      if (r.ok) setVideos(d.videos)
    } finally { setLoading(false) }
  }

  // ---- DELIVERIES ----
  type DFile = { url: string; name: string; type: string; label: string }
  type DeliveryT = { id: string; client: string; note: string; files: DFile[]; createdAt: number }
  const DELIVERY_LABELS = ['UGC Video Ad', 'Cinematic & Motion Design', 'Static Ad Image', 'Product Photoshoot', 'Campaign Asset']
  const [deliveries, setDeliveries] = useState<DeliveryT[]>([])
  const [dClient, setDClient] = useState('')
  const [dNote, setDNote] = useState('')
  const [dFiles, setDFiles] = useState<DFile[]>([])
  const [dLabel, setDLabel] = useState(DELIVERY_LABELS[0])
  const [dUploading, setDUploading] = useState(false)
  const [dPct, setDPct] = useState(0)
  const [dErr, setDErr] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const loadDeliveries = async (pwd: string) => {
    try {
      const r = await fetch('/api/deliveries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, action: 'list' }),
      })
      const d = await r.json()
      if (r.ok) setDeliveries(d.deliveries || [])
    } catch { /* ignore */ }
  }

  // ---- ORDERS (paid, recorded by the Stripe webhook) ----
  type OrderT = {
    id: string; package: string; amount: number | null; currency: string
    email: string; name: string; brand: string; offer: string; productUrl: string
    language: string; services: string; notes: string; photos?: string[]
    promoCode?: string; promoLabel?: string; createdAt: number
  }
  const [orders, setOrders] = useState<OrderT[]>([])
  const [openOrder, setOpenOrder] = useState<string | null>(null)
  const loadOrders = async (pwd: string) => {
    try {
      const r = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      const d = await r.json()
      if (r.ok) setOrders(d.orders || [])
    } catch { /* ignore */ }
  }

  // ---- TESTIMONIALS (client feedback submitted from the delivery page) ----
  type TestimonialT = {
    id: string; deliveryId: string; client: string; rating: number | null
    text: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number
  }
  const [testimonials, setTestimonials] = useState<TestimonialT[]>([])
  const loadTestimonials = async (pwd: string) => {
    try {
      const r = await fetch('/api/testimonials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, action: 'list' }),
      })
      const d = await r.json()
      if (r.ok) setTestimonials(d.testimonials || [])
    } catch { /* ignore */ }
  }
  const setTestimonialStatus = async (id: string, action: 'approve' | 'reject') => {
    setLoading(true)
    try {
      const r = await fetch('/api/testimonials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action, id }),
      })
      const d = await r.json()
      if (r.ok) setTestimonials(d.testimonials)
    } finally { setLoading(false) }
  }
  const removeTestimonial = async (id: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/testimonials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'delete', id }),
      })
      const d = await r.json()
      if (r.ok) setTestimonials(d.testimonials)
    } finally { setLoading(false) }
  }

  // ---- PROMOTIONS (a discount or gift that auto-shows on the homepage) ----
  type PromoT = {
    id: string; type: 'percent' | 'fixed' | 'gift'; value: number
    headline: string; detail: string; expiresAt: number | null; active: boolean; createdAt: number
  }
  const [promos, setPromos] = useState<PromoT[]>([])
  const [pType, setPType] = useState<'percent' | 'fixed' | 'gift'>('percent')
  const [pValue, setPValue] = useState('')
  const [pHeadline, setPHeadline] = useState('')
  const [pDetail, setPDetail] = useState('')
  const [pExpiry, setPExpiry] = useState('')
  const [pErr, setPErr] = useState('')

  const loadPromos = async (pwd: string) => {
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, action: 'list' }),
      })
      const d = await r.json()
      if (r.ok) setPromos(d.promos || [])
    } catch { /* ignore */ }
  }

  const createPromo = async () => {
    setPErr('')
    if (!pHeadline.trim()) { setPErr('Add a short headline.'); return }
    if (pType !== 'gift' && !(Number(pValue) > 0)) { setPErr('Enter a discount value greater than 0.'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pw, action: 'create',
          promo: {
            type: pType,
            value: pType === 'gift' ? 0 : Number(pValue),
            headline: pHeadline, detail: pDetail,
            expiresAt: pExpiry || null,
            active: true,
          },
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setPromos(d.promos)
      setPValue(''); setPHeadline(''); setPDetail(''); setPExpiry(''); setPType('percent')
    } catch (e) {
      setPErr('Could not save. ' + String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }

  const setPromoActive = async (id: string, action: 'activate' | 'deactivate') => {
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action, id }),
      })
      const d = await r.json()
      if (r.ok) setPromos(d.promos)
    } finally { setLoading(false) }
  }

  const removePromo = async (id: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'delete', id }),
      })
      const d = await r.json()
      if (r.ok) setPromos(d.promos)
    } finally { setLoading(false) }
  }

  // ---- PROMO CODES (customer types one at checkout; many can be active) ----
  type CodeT = {
    id: string; code: string; type: 'percent' | 'fixed'; value: number
    expiresAt: number | null; active: boolean; createdAt: number
  }
  const [codes, setCodes] = useState<CodeT[]>([])
  const [cCode, setCCode] = useState('')
  const [cType, setCType] = useState<'percent' | 'fixed'>('percent')
  const [cValue, setCValue] = useState('')
  const [cExpiry, setCExpiry] = useState('')
  const [cErr, setCErr] = useState('')

  const loadCodes = async (pwd: string) => {
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, action: 'code-list' }),
      })
      const d = await r.json()
      if (r.ok) setCodes(d.codes || [])
    } catch { /* ignore */ }
  }

  const createCode = async () => {
    setCErr('')
    if (cCode.trim().length < 3) { setCErr('Code must be at least 3 characters.'); return }
    if (!(Number(cValue) > 0)) { setCErr('Enter a discount value greater than 0.'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pw, action: 'code-create',
          code: { code: cCode, type: cType, value: Number(cValue), expiresAt: cExpiry || null, active: true },
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setCodes(d.codes)
      setCCode(''); setCValue(''); setCExpiry(''); setCType('percent')
    } catch (e) {
      setCErr('Could not save. ' + String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }

  const setCodeActive = async (id: string, action: 'code-activate' | 'code-deactivate') => {
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action, id }),
      })
      const d = await r.json()
      if (r.ok) setCodes(d.codes)
    } finally { setLoading(false) }
  }

  const removeCode = async (id: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'code-delete', id }),
      })
      const d = await r.json()
      if (r.ok) setCodes(d.codes)
    } finally { setLoading(false) }
  }

  const uploadDeliveryFile = async (file: File) => {
    setDErr(''); setDUploading(true); setDPct(0)
    try {
      const publicUrl = await r2Upload(file, { endpoint: '/api/upload', password: pw, kind: 'delivery', onProgress: setDPct })
      setDFiles((prev) => [...prev, { url: publicUrl, name: file.name, type: contentTypeFor(file), label: dLabel }])
    } catch (e) {
      setDErr('Upload failed: ' + String(e instanceof Error ? e.message : e))
    } finally {
      setDUploading(false); setDPct(0)
    }
  }

  const createDelivery = async () => {
    if (dFiles.length === 0) { setDErr('Upload at least one file.'); return }
    setDErr(''); setLoading(true)
    try {
      const r = await fetch('/api/deliveries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'create', delivery: { client: dClient, note: dNote, files: dFiles } }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setDeliveries(d.deliveries)
      setDClient(''); setDNote(''); setDFiles([])
    } catch (e) {
      setDErr('Could not create. ' + String(e))
    } finally { setLoading(false) }
  }

  const removeDelivery = async (id: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/deliveries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, action: 'delete', id }),
      })
      const d = await r.json()
      if (r.ok) setDeliveries(d.deliveries)
    } finally { setLoading(false) }
  }

  const copyLink = (id: string) => {
    // Always use the public domain so delivery links never point to the SSO-protected *.vercel.app host
    const origin = window.location.hostname.endsWith('rexran.com') ? window.location.origin : 'https://rexran.com'
    const link = `${origin}/delivery/${id}`
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(''), 1800)
    }).catch(() => {})
  }

  // ---- OVERVIEW STATS (derived from paid orders, no extra fetch) ----
  const paidOrders = orders.filter((o) => o.amount != null)
  const orderCount = paidOrders.length
  const totalSales = paidOrders.reduce((s, o) => s + (o.amount || 0), 0)
  const monthStart = new Date(new Date(nowTs).getFullYear(), new Date(nowTs).getMonth(), 1).getTime()
  const monthSales = paidOrders.filter((o) => o.createdAt >= monthStart).reduce((s, o) => s + (o.amount || 0), 0)
  const fmtMoney = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const codeCounts: Record<string, number> = {}
  for (const o of paidOrders) { if (o.promoCode) codeCounts[o.promoCode] = (codeCounts[o.promoCode] || 0) + 1 }
  const topCodes = Object.entries(codeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  if (!authed) {
    return (
      <div className="adm-gate">
        <div className="adm-card">
          <RexMark className="adm-logo" />
          <h1>Rexran Admin</h1>
          <p>Enter your password to manage portfolio videos.</p>
          <input type="password" value={pw} placeholder="Password"
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryLogin()} />
          {err && <div className="adm-err">{err}</div>}
          <button className="cta" onClick={tryLogin} disabled={loading}>{loading ? 'Checking…' : 'Enter'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="adm-wrap">
      <header className="adm-head">
        <div className="brand" style={{ color: 'var(--gold)' }}><RexMark className="brand-logo" />Rexran Admin</div>
        <a className="cta ghost" href="/">View site →</a>
      </header>

      {view === 'hub' && (
        <div className="adm-hub">
          <div className="adm-hub-head">
            <h1>What are we doing today?</h1>
            <p>Pick a workspace to continue.</p>
          </div>

          <div className="adm-overview">
            <div className="adm-ov-card">
              <span className="adm-ov-num">{orderCount}</span>
              <span className="adm-ov-lab">Paid order{orderCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="adm-ov-card">
              <span className="adm-ov-num">{fmtMoney(totalSales)}</span>
              <span className="adm-ov-lab">Total sales</span>
            </div>
            <div className="adm-ov-card">
              <span className="adm-ov-num">{fmtMoney(monthSales)}</span>
              <span className="adm-ov-lab">This month</span>
            </div>
            <div className="adm-ov-card adm-ov-codes">
              <span className="adm-ov-lab">Top promo codes</span>
              {topCodes.length === 0 ? (
                <span className="adm-ov-empty">No codes used yet</span>
              ) : (
                <ul>
                  {topCodes.map(([code, n]) => (
                    <li key={code}><span className="adm-ov-code">{code}</span><span className="adm-ov-count">{n}×</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="adm-hub-grid">
            <div className="adm-hub-card" onMouseMove={tilt} onClick={() => setView('videos')}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setView('videos')}>
              <div className="glow" />
              <div className="adm-hub-icon"><PortfolioIcon /></div>
              <h2>Portfolio</h2>
              <p className="adm-hub-desc">Publish and manage the videos and photos shown on the site.</p>
              <div className="adm-hub-stats"><span>{videos.length} live</span></div>
              <span className="adm-hub-go">Open workspace →</span>
            </div>
            <div className="adm-hub-card" onMouseMove={tilt} onClick={() => setView('orders')}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setView('orders')}>
              <div className="glow" />
              <div className="adm-hub-icon"><OrdersIcon /></div>
              <h2>Orders</h2>
              <p className="adm-hub-desc">Every payment confirmed by Stripe, recorded automatically.</p>
              <div className="adm-hub-stats"><span>{orders.length} order{orders.length !== 1 ? 's' : ''}</span></div>
              <span className="adm-hub-go">Open workspace →</span>
            </div>
            <div className="adm-hub-card" onMouseMove={tilt} onClick={() => setView('deliveries')}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setView('deliveries')}>
              <div className="glow" />
              <div className="adm-hub-icon"><DeliveriesIcon /></div>
              <h2>Deliveries</h2>
              <p className="adm-hub-desc">Hand finished files off to clients with a private link.</p>
              <div className="adm-hub-stats"><span>{deliveries.length} {deliveries.length === 1 ? 'delivery' : 'deliveries'}</span></div>
              <span className="adm-hub-go">Open workspace →</span>
            </div>
            <div className="adm-hub-card" onMouseMove={tilt} onClick={() => setView('testimonials')}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setView('testimonials')}>
              <div className="glow" />
              <div className="adm-hub-icon"><TestimonialsIcon /></div>
              <h2>Testimonials</h2>
              <p className="adm-hub-desc">Approve client feedback before it appears on the site.</p>
              <div className="adm-hub-stats">
                <span>{testimonials.length} total</span>
                {testimonials.some((t) => t.status === 'pending') && (
                  <span className="adm-hub-badge">{testimonials.filter((t) => t.status === 'pending').length} new</span>
                )}
              </div>
              <span className="adm-hub-go">Open workspace →</span>
            </div>
            <div className="adm-hub-card" onMouseMove={tilt} onClick={() => setView('promos')}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setView('promos')}>
              <div className="glow" />
              <div className="adm-hub-icon"><PromoIcon /></div>
              <h2>Promotions</h2>
              <p className="adm-hub-desc">Run a discount or a gift — it shows on the site automatically.</p>
              <div className="adm-hub-stats">
                <span>{promos.length} total</span>
                {promos.some((p) => p.active && (!p.expiresAt || p.expiresAt > nowTs)) && (
                  <span className="adm-hub-badge">live</span>
                )}
              </div>
              <span className="adm-hub-go">Open workspace →</span>
            </div>
          </div>
        </div>
      )}

      {view === 'videos' && (
      <>
      <button className="adm-back" onClick={() => setView('hub')}>← Back to hub</button>
      <section className="adm-section">
        <h2>Add a video</h2>
        <div className="adm-upload">
          <label className="adm-drop">
            <input type="file" accept="video/*,image/*" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} disabled={uploading} />
            {uploading ? (
              <div className="adm-prog"><div className="adm-prog-bar" style={{ width: `${uploadPct}%` }} /><span>Uploading… {uploadPct}%</span></div>
            ) : (
              <div className="adm-drop-in"><span className="adm-drop-plus">↑</span><strong>Upload a video or image from your device</strong><span className="adm-drop-hint">MP4, MOV, WebM or images · up to 500MB</span></div>
            )}
          </label>
          {url && !uploading && <div className="adm-uploaded">✓ Video ready — fill in the details below and click Add video.</div>}
        </div>
        <div className="adm-or">or paste a link</div>
        <div className="adm-form">
          <div className="field"><label>Media URL (video mp4 or image)</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/video.mp4" /></div>
          <div className="field"><label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field"><label>Poster image URL (optional)</label><input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://…/thumb.jpg" /></div>
        </div>
        {err && <div className="adm-err">{err}</div>}
        <button className="cta" onClick={addVideo} disabled={loading}>{loading ? 'Saving…' : 'Add video'}</button>
      </section>

      <section className="adm-section">
        <h2>Your videos ({videos.length})</h2>
        {videos.length === 0 && <p className="adm-empty">No videos yet. Add your first one above.</p>}
        <div className="adm-list">
          {videos.map((v) => (
            <div className="adm-item" key={v.id}>
              <div className="adm-thumb">
                {v.poster ? <img src={v.poster} alt="" /> : <span>{v.type}</span>}
              </div>
              <div className="adm-meta">
                <strong>{v.type}</strong>
                <a href={v.url} target="_blank" rel="noreferrer" className="adm-url">{v.url}</a>
              </div>
              <button className="adm-del" onClick={() => removeVideo(v.id)} disabled={loading}>Delete</button>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {view === 'orders' && (
      <>
      <button className="adm-back" onClick={() => setView('hub')}>← Back to hub</button>
      <section className="adm-section">
        <h2>Orders ({orders.length})</h2>
        <p className="adm-empty" style={{ marginTop: -6, marginBottom: 20 }}>Every payment confirmed by Stripe is recorded here, even if the Telegram/email alert fails to send.</p>
        {orders.length === 0 && <p className="adm-empty">No paid orders yet.</p>}
        <div className="adm-list">
          {orders.map((o) => {
            const open = openOrder === o.id
            const rows: [string, ReactNode][] = []
            if (o.name) rows.push(['Name', o.name])
            if (o.brand) rows.push(['Brand', o.brand])
            if (o.email) rows.push(['Email', <a href={`mailto:${o.email}`}>{o.email}</a>])
            if (o.productUrl) rows.push(['Product link', <a href={o.productUrl} target="_blank" rel="noreferrer">{o.productUrl}</a>])
            if (o.offer) rows.push(['Offer', o.offer])
            if (o.language) rows.push(['Language', o.language])
            if (o.services) rows.push(['Services', o.services])
            return (
              <div className={`adm-order${open ? ' open' : ''}`} key={o.id}>
                <button className="adm-order-head" onClick={() => setOpenOrder(open ? null : o.id)} aria-expanded={open}>
                  <span className="adm-order-sum">
                    <strong>{o.package || 'Order'} · {o.amount != null ? `$${o.amount.toFixed(2)}` : '—'} {o.currency}
                      {o.promoLabel && <span className="adm-tstatus adm-tstatus-approved" style={{ marginLeft: 8 }}>{o.promoLabel}</span>}
                    </strong>
                    <span className="adm-url">{o.brand || o.name || '—'} · {o.email || '—'} · {new Date(o.createdAt).toLocaleString()}</span>
                  </span>
                  <span className="adm-order-chev" aria-hidden="true">▾</span>
                </button>

                {open && (
                  <div className="adm-order-body">
                    <div className="adm-order-fields">
                      {rows.map(([lab, val]) => (
                        <div className="adm-of-row" key={lab}>
                          <span className="adm-of-lab">{lab}</span>
                          <span className="adm-of-val">{val}</span>
                        </div>
                      ))}
                    </div>

                    {o.notes && (
                      <div className="adm-order-notes">
                        <span className="adm-of-lab">Brief / what to highlight</span>
                        <p>{o.notes}</p>
                      </div>
                    )}

                    {o.photos && o.photos.length > 0 ? (
                      <div className="adm-order-photos-block">
                        <span className="adm-of-lab">Product photos ({o.photos.length})</span>
                        <div className="adm-order-photos">
                          {o.photos.map((url, i) => (
                            <div className="adm-order-photo" key={i}>
                              <a href={url} target="_blank" rel="noreferrer" title="Open full size"><img src={url} alt="" loading="lazy" /></a>
                              <button type="button" className="adm-photo-dl" onClick={() => forceDownload(url, url.split('/').pop() || 'photo')}>Download</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="adm-empty" style={{ margin: 0 }}>No photos were attached to this order.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
      </>
      )}

      {view === 'deliveries' && (
      <>
      <button className="adm-back" onClick={() => setView('hub')}>← Back to hub</button>
      <section className="adm-section">
        <h2>Client deliveries ({deliveries.length})</h2>
        <p className="adm-empty" style={{ marginTop: -6, marginBottom: 20 }}>Upload a client's finished files, create a delivery, then send them the private link.</p>

        <div className="adm-form" style={{ marginBottom: 14 }}>
          <div className="field"><label>Service type for the next file</label>
            <select value={dLabel} onChange={(e) => setDLabel(e.target.value)}>{DELIVERY_LABELS.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
        </div>

        <div className="adm-upload">
          <label className="adm-drop">
            <input type="file" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && uploadDeliveryFile(e.target.files[0])} disabled={dUploading} />
            {dUploading ? (
              <div className="adm-prog"><div className="adm-prog-bar" style={{ width: `${dPct}%` }} /><span>Uploading… {dPct}%</span></div>
            ) : (
              <div className="adm-drop-in"><span className="adm-drop-plus">↑</span><strong>Upload a finished file for the client</strong><span className="adm-drop-hint">Pick the service type above · one file at a time · up to 500MB each</span></div>
            )}
          </label>
        </div>

        {dFiles.length > 0 && (
          <div className="adm-dfiles">
            {dFiles.map((f, i) => (
              <div className="adm-dfile" key={i}>
                <span className="adm-dfile-name">✓ <strong style={{ color: 'var(--gold)' }}>{f.label}</strong> · {f.name}</span>
                <button className="adm-del" onClick={() => setDFiles((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="adm-form" style={{ marginTop: 18 }}>
          <div className="field"><label>Client / brand name (optional)</label><input value={dClient} onChange={(e) => setDClient(e.target.value)} placeholder="Acme Supply Co." /></div>
          <div className="field"><label>Short note to the client (optional)</label><input value={dNote} onChange={(e) => setDNote(e.target.value)} placeholder="Here are your 3 UGC ads, ready to run. Enjoy!" /></div>
        </div>
        {dErr && <div className="adm-err">{dErr}</div>}
        <button className="cta" onClick={createDelivery} disabled={loading || dFiles.length === 0}>{loading ? 'Creating…' : 'Create delivery link'}</button>

        <div className="adm-list" style={{ marginTop: 28 }}>
          {deliveries.map((d) => (
            <div className="adm-item" key={d.id}>
              <div className="adm-meta">
                <strong>{d.client || 'Delivery'} · {d.files.length} file{d.files.length !== 1 ? 's' : ''}</strong>
                <span className="adm-url">/delivery/{d.id}</span>
              </div>
              <button className="cta ghost adm-copylink" onClick={() => copyLink(d.id)}>{copiedId === d.id ? 'Copied ✓' : 'Copy link'}</button>
              <button className="adm-del" onClick={() => removeDelivery(d.id)} disabled={loading}>Delete</button>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {view === 'testimonials' && (
      <>
      <button className="adm-back" onClick={() => setView('hub')}>← Back to hub</button>
      <section className="adm-section">
        <h2>Client testimonials ({testimonials.length})</h2>
        <p className="adm-empty" style={{ marginTop: -6, marginBottom: 20 }}>Feedback clients submit from their delivery page. Approve the ones you want to feature on the site — nothing goes public until you do.</p>
        {testimonials.length === 0 && <p className="adm-empty">No feedback submitted yet.</p>}
        <div className="adm-list">
          {[...testimonials]
            .sort((a, b) => {
              const order = { pending: 0, approved: 1, rejected: 2 }
              if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
              return b.createdAt - a.createdAt
            })
            .map((t) => (
              <div className="adm-item adm-testimonial" key={t.id}>
                <div className="adm-meta">
                  <strong>
                    {t.client || 'Anonymous client'}
                    {t.rating ? ` · ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}` : ''}
                    {' · '}<span className={`adm-tstatus adm-tstatus-${t.status}`}>{t.status}</span>
                  </strong>
                  {t.text && <span className="adm-url adm-tstext">"{t.text}"</span>}
                  <span className="adm-url">{new Date(t.createdAt).toLocaleString()}</span>
                </div>
                <div className="adm-tactions">
                  {t.status !== 'approved' && <button className="cta ghost adm-copylink" onClick={() => setTestimonialStatus(t.id, 'approve')} disabled={loading}>Approve</button>}
                  {t.status !== 'rejected' && <button className="cta ghost adm-copylink" onClick={() => setTestimonialStatus(t.id, 'reject')} disabled={loading}>Reject</button>}
                  <button className="adm-del" onClick={() => removeTestimonial(t.id)} disabled={loading}>Delete</button>
                </div>
              </div>
            ))}
        </div>
      </section>
      </>
      )}

      {view === 'promos' && (
      <>
      <button className="adm-back" onClick={() => setView('hub')}>← Back to hub</button>
      <section className="adm-section">
        <h2>Run a promotion</h2>
        <p className="adm-empty" style={{ marginTop: -6, marginBottom: 20 }}>Start a discount or a gift. It appears on the homepage automatically — a discount is applied to the price at checkout for real; a gift is an announcement you fulfil with the order. Only one promotion is live at a time.</p>

        <div className="adm-form">
          <div className="field"><label>Type</label>
            <select value={pType} onChange={(e) => setPType(e.target.value as 'percent' | 'fixed' | 'gift')}>
              <option value="percent">Discount — percentage off</option>
              <option value="fixed">Discount — fixed amount off</option>
              <option value="gift">Gift / announcement (price unchanged)</option>
            </select>
          </div>
          {pType !== 'gift' && (
            <div className="field">
              <label>{pType === 'percent' ? 'Percentage off (1–90)' : 'Amount off in USD'}</label>
              <input type="number" min="1" max={pType === 'percent' ? '90' : undefined} value={pValue}
                onChange={(e) => setPValue(e.target.value)} placeholder={pType === 'percent' ? 'e.g. 20' : 'e.g. 15'} />
            </div>
          )}
          <div className="field"><label>Headline</label><input value={pHeadline} onChange={(e) => setPHeadline(e.target.value)} placeholder={pType === 'gift' ? 'Free bonus reel with every package' : 'Launch week'} maxLength={80} /></div>
          <div className="field"><label>Detail line (optional)</label><input value={pDetail} onChange={(e) => setPDetail(e.target.value)} placeholder={pType === 'gift' ? 'A free 6-second cutdown, on us.' : '20% off every package this week.'} maxLength={200} /></div>
          <div className="field"><label>Ends on (optional — auto-hides after)</label><input type="datetime-local" value={pExpiry} onChange={(e) => setPExpiry(e.target.value)} /></div>
        </div>
        {pErr && <div className="adm-err">{pErr}</div>}
        <button className="cta" onClick={createPromo} disabled={loading}>{loading ? 'Saving…' : 'Publish promotion'}</button>

        <div className="adm-list" style={{ marginTop: 28 }}>
          {promos.length === 0 && <p className="adm-empty">No promotions yet. Create your first one above.</p>}
          {promos.map((p) => {
            const live = p.active && (!p.expiresAt || p.expiresAt > nowTs)
            const expired = p.active && p.expiresAt != null && p.expiresAt <= nowTs
            const valueLabel = p.type === 'percent' ? `${p.value}% off` : p.type === 'fixed' ? `$${p.value} off` : 'Gift'
            return (
              <div className="adm-item" key={p.id}>
                <div className="adm-meta">
                  <strong>
                    {p.headline}
                    {' · '}<span className="adm-url" style={{ color: 'var(--gold)' }}>{valueLabel}</span>
                    {' · '}<span className={`adm-tstatus adm-tstatus-${live ? 'approved' : expired ? 'rejected' : 'pending'}`}>{live ? 'live' : expired ? 'expired' : 'off'}</span>
                  </strong>
                  {p.detail && <span className="adm-url adm-tstext">{p.detail}</span>}
                  <span className="adm-url">{p.expiresAt ? `Ends ${new Date(p.expiresAt).toLocaleString()} · ` : ''}Created {new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <div className="adm-tactions">
                  {!p.active
                    ? <button className="cta ghost adm-copylink" onClick={() => setPromoActive(p.id, 'activate')} disabled={loading}>Make live</button>
                    : <button className="cta ghost adm-copylink" onClick={() => setPromoActive(p.id, 'deactivate')} disabled={loading}>Turn off</button>}
                  <button className="adm-del" onClick={() => removePromo(p.id)} disabled={loading}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="adm-section">
        <h2>Promo codes</h2>
        <p className="adm-empty" style={{ marginTop: -6, marginBottom: 20 }}>A private code a customer types at checkout — no public banner. Share it by email, DM, or with an influencer. Several can be active at once. If a store-wide offer is also live, the customer automatically gets whichever discount is bigger.</p>

        <div className="adm-form">
          <div className="field"><label>Code</label><input value={cCode} onChange={(e) => setCCode(e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={40} style={{ textTransform: 'uppercase' }} /></div>
          <div className="field"><label>Type</label>
            <select value={cType} onChange={(e) => setCType(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </div>
          <div className="field">
            <label>{cType === 'percent' ? 'Percentage off (1–90)' : 'Amount off in USD'}</label>
            <input type="number" min="1" max={cType === 'percent' ? '90' : undefined} value={cValue}
              onChange={(e) => setCValue(e.target.value)} placeholder={cType === 'percent' ? 'e.g. 10' : 'e.g. 15'} />
          </div>
          <div className="field"><label>Ends on (optional — stops working after)</label><input type="datetime-local" value={cExpiry} onChange={(e) => setCExpiry(e.target.value)} /></div>
        </div>
        {cErr && <div className="adm-err">{cErr}</div>}
        <button className="cta" onClick={createCode} disabled={loading}>{loading ? 'Saving…' : 'Create code'}</button>

        <div className="adm-list" style={{ marginTop: 28 }}>
          {codes.length === 0 && <p className="adm-empty">No codes yet. Create your first one above.</p>}
          {codes.map((c) => {
            const live = c.active && (!c.expiresAt || c.expiresAt > nowTs)
            const expired = c.active && c.expiresAt != null && c.expiresAt <= nowTs
            const valueLabel = c.type === 'percent' ? `${c.value}% off` : `$${c.value} off`
            return (
              <div className="adm-item" key={c.id}>
                <div className="adm-meta">
                  <strong>
                    <span style={{ fontFamily: 'var(--mono)', letterSpacing: '.05em' }}>{c.code}</span>
                    {' · '}<span className="adm-url" style={{ color: 'var(--gold)' }}>{valueLabel}</span>
                    {' · '}<span className={`adm-tstatus adm-tstatus-${live ? 'approved' : expired ? 'rejected' : 'pending'}`}>{live ? 'live' : expired ? 'expired' : 'off'}</span>
                  </strong>
                  <span className="adm-url">{c.expiresAt ? `Ends ${new Date(c.expiresAt).toLocaleString()} · ` : ''}Created {new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="adm-tactions">
                  {!c.active
                    ? <button className="cta ghost adm-copylink" onClick={() => setCodeActive(c.id, 'code-activate')} disabled={loading}>Turn on</button>
                    : <button className="cta ghost adm-copylink" onClick={() => setCodeActive(c.id, 'code-deactivate')} disabled={loading}>Turn off</button>}
                  <button className="adm-del" onClick={() => removeCode(c.id)} disabled={loading}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      </>
      )}
    </div>
  )
}
