import { useEffect, useRef, useState } from 'react'
import './App.css'
import RexMark from './RexMark'
import { trackPurchase } from './analytics'
import { r2Upload } from './mediaUtils'

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}
function useScrolled() {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > 40)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return s
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

const VIDEO_RATIOS = ['9:16', '16:9', '1:1', '21:9', '4:3', '3:4']
const IMAGE_RATIOS = ['1:1', '16:9', '9:16', '3:2', '2:3']

type Duration = { secs: number; price: number }
type Service = { key: string; label: string; price: number; ratios: string[]; durations?: Duration[] }
const SERVICES: Service[] = [
  { key: 'ugc', label: 'UGC Video Ad', price: 59, ratios: VIDEO_RATIOS, durations: [{ secs: 15, price: 59 }, { secs: 30, price: 79 }] },
  { key: 'cine', label: 'Cinematic & Motion Design', price: 79, ratios: VIDEO_RATIOS, durations: [{ secs: 15, price: 79 }, { secs: 30, price: 109 }] },
  { key: 'static', label: 'Static Ad Image', price: 12, ratios: IMAGE_RATIOS },
  { key: 'shoot', label: 'Product Photoshoot', price: 18, ratios: IMAGE_RATIOS },
]
const MIN_ORDER = 25

const PLANS = [
  { name: 'Spark', price: '$39', per: '/ project', desc: 'A quick test spot to see how AI creative performs for your product.',
    items: ['1 UGC video · 15s', '1 Cinematic & Motion Design · 15s', '2 hook variations', '1 static ad creative', '2 aspect ratios', '48-hour delivery'], feat: false },
  { name: 'Growth', price: '$99', per: '/ project', desc: 'The package most stores run with — a full video set plus statics, ready to test and scale.',
    items: ['2 UGC videos · 30s', '1 Cinematic & Motion Design · 15s', 'AI actor + voiceover', '2 hook variations', '4 static ad creatives', 'All aspect ratios', '1 revision round', '48-hour delivery'], feat: true },
  { name: 'Scale', price: '$199', per: '/ project', desc: 'A launch-ready kit when you want to go live on every channel at once.',
    items: ['3 UGC videos · 30s each', '1 Cinematic & Motion Design · 30s', '6 static creatives', 'Product photoshoot · 3 images', 'All aspect ratios', '2 revision rounds', 'Priority delivery'], feat: false },
  { name: 'Brand Partner', price: '$549', per: '/ month', desc: 'Fresh creative on tap for stores that feed paid social every week.',
    items: ['6 UGC videos · 30s each / month', '2 Cinematic & Motion Design · 30s / month', '12 statics / month', 'Monthly trend & hook refresh', 'Rolling revisions', 'Priority queue + direct line on Instagram'], feat: false },
]

type PlanContent = { key: string; label: string; ratios: string[]; qty: number; duration?: number }
const PLAN_CONTENTS: Record<string, PlanContent[]> = {
  Spark: [{ key: 'ugc', label: 'UGC video', ratios: VIDEO_RATIOS, qty: 1, duration: 15 }, { key: 'cine', label: 'Cinematic & Motion Design', ratios: VIDEO_RATIOS, qty: 1, duration: 15 }, { key: 'static', label: 'Static ad image', ratios: IMAGE_RATIOS, qty: 1 }],
  Growth: [{ key: 'ugc', label: 'UGC videos', ratios: VIDEO_RATIOS, qty: 2, duration: 30 }, { key: 'cine', label: 'Cinematic & Motion Design', ratios: VIDEO_RATIOS, qty: 1, duration: 15 }, { key: 'static', label: 'Static ad images', ratios: IMAGE_RATIOS, qty: 4 }],
  Scale: [{ key: 'ugc', label: 'UGC videos', ratios: VIDEO_RATIOS, qty: 3, duration: 30 }, { key: 'cine', label: 'Cinematic & Motion Design', ratios: VIDEO_RATIOS, qty: 1, duration: 30 }, { key: 'static', label: 'Static ad images', ratios: IMAGE_RATIOS, qty: 6 }, { key: 'shoot', label: 'Product photoshoot images', ratios: IMAGE_RATIOS, qty: 3 }],
  'Brand Partner': [{ key: 'ugc', label: 'UGC videos', ratios: VIDEO_RATIOS, qty: 6, duration: 30 }, { key: 'cine', label: 'Cinematic & Motion Design', ratios: VIDEO_RATIOS, qty: 2, duration: 30 }, { key: 'static', label: 'Static ad images', ratios: IMAGE_RATIOS, qty: 12 }],
}

// One size per unit. A length-1 selection means "this size for all N units"
// (so changing the quantity never breaks it); a length-N selection is one
// size per unit. Complete = the single size is set, or every unit has one.
function sizesComplete(chosen: string[], qty: number): boolean {
  if (qty <= 0) return true
  if (chosen.length === 1) return !!chosen[0]
  for (let i = 0; i < qty; i++) if (!chosen[i]) return false
  return true
}

const TILES = [
  { c: 't1', n: 'FORMAT 01', t: 'UGC Video Ads', p: 'Hyper-real AI creators talking through your product — natural voice, perfect lip-sync.', ph: 'VIDEO' },
  { c: 't2', n: 'FORMAT 02', t: 'Scroll-Stop Statics', p: 'One hook, zero clutter, sized for every placement.', ph: 'STATIC' },
  { c: 't3', n: 'FORMAT 03', t: 'Studio Photoshoots', p: 'Phone snaps turned into clean 4K catalog imagery.', ph: '4K' },
  { c: 't4', n: 'FORMAT 04', t: 'Cinematic & Motion Design', p: 'Brand-grade product stories and motion graphics, without a crew.', ph: 'MOTION' },
  { c: 't5', n: 'FORMAT 05', t: 'Full Campaign Sets', p: 'A matched pack of video and stills built to run together.', ph: 'SUITE' },
]

const STEPS = [
  { n: '01', t: 'You send the product', p: 'Pick a package, drop your product link and photos, choose your services and sizes. That is the whole brief.' },
  { n: '02', t: 'Rexran directs the creative', p: 'Every asset is produced by hand — scripting, casting the AI actor, shooting, grading — so it fits your brand, not a template.' },
  { n: '03', t: 'You run it in 48 hours', p: 'Final files arrive on a private download page as clean, full-quality files — ready to upload straight to your ad account.' },
]

const WHY = [
  { t: 'No studio, no crew', p: 'You skip the photographer, the actors, the editor, and the week of back-and-forth. One link in, finished ads out.' },
  { t: 'Built to convert', p: 'Every asset leads with a hook and is sized natively for the feed — made to stop the scroll, not just look pretty.' },
  { t: '48-hour turnaround', p: 'Most agencies take two weeks. You get launch-ready creative in two days, delivered as full-quality downloads.' },
  { t: 'Done entirely for you', p: 'No tool to learn, no prompts to write. You approve the brief, Rexran handles the rest end to end.' },
]

const PROOF = [
  { k: 'Native by format', t: 'Made to convert, not decorate', p: 'Every asset leads with a hook in the first second and is sized natively for the placement it runs in — built for the feed, not a portfolio.' },
  { k: 'Human-directed', t: 'Directed, never auto-generated', p: 'AI is the camera and crew; the direction is human. Scripting, pacing, casting and grading are done by hand so it reads like a brand, not a prompt.' },
  { k: 'Speed + economics', t: 'Two-day turnaround, no agency retainer', p: 'The output quality of a studio at the speed of a freelancer — launch-ready creative in days, priced for stores still scaling their spend.' },
]

// Every answer here mirrors the actual Terms of Service — nothing promised
// that isn't already true in /terms.
const FAQ = [
  { q: 'How fast is delivery, really?', a: 'Most orders land in 48 hours from the moment we have your brief. Turnaround is an estimate in business days and can shift slightly with scope or revisions — but speed is the whole point of Rexran.' },
  { q: 'What do I need to send to get started?', a: "Just your product link, a few photos, and a short brief on what to highlight. Pick your package and sizes at checkout — that's the whole intake." },
  { q: 'Is this actually AI-generated, or does a human make it?', a: 'AI is the camera and crew; the direction is human. Every script, cast, shot, and grade is directed by hand so the result reads like a brand, not a prompt.' },
  { q: 'Can I choose the aspect ratio and format?', a: "Yes — pick the sizes you need per asset (9:16, 1:1, 16:9, and more) right in the order builder, so every file arrives ready for the exact placement you're running." },
  { q: 'What if I need changes after delivery?', a: 'Reasonable revisions within your original brief are included. A new concept, extra assets, or a different product is treated as a new order.' },
  { q: 'Is payment secure? Do you store my card?', a: "Checkout runs entirely on Stripe's secure page — your card details never touch our servers." },
  { q: "What's your refund policy?", a: "Because every asset is custom-produced for you, orders are generally non-refundable once production begins. If something's gone wrong, email us and we'll work in good faith to make it right." },
  { q: 'Who owns the final files?', a: 'You do. Once your order is paid in full, the rights to use the delivered creative for your own advertising are yours.' },
]

type Discount = { type: 'percent' | 'fixed' | 'gift'; value: number }
type Promo = Discount & { id: string; headline: string; detail: string; expiresAt: number | null }
type PromoCode = { code: string; type: 'percent' | 'fixed'; value: number }

// Display-side mirror of api/_lib/promo.js — the server recomputes and is the
// source of truth for the actual charge; this only formats the shown price.
function applyPromo(total: number, d: Discount | null): number {
  if (!d || d.type === 'gift') return total
  if (d.type === 'percent') return Math.max(1, Math.round(total * (100 - d.value)) / 100)
  if (d.type === 'fixed') return Math.max(1, Math.round((total - d.value) * 100) / 100)
  return total
}
const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`)
const isDiscount = (promo: Promo | null) => !!promo && promo.type !== 'gift'
const discountLabel = (d: { type: 'percent' | 'fixed' | 'gift'; value: number }) =>
  d.type === 'percent' ? `${d.value}% off` : `${money(d.value)} off`

// A live countdown to the admin-set expiry — a real deadline, never a fake
// resetting timer. Ticks each second; when it hits zero it calls onExpire so
// the whole offer disappears (matching the server, which also stops honouring
// an expired promo). The ticking `now` lives here so only this small badge
// re-renders each second, never the whole homepage.
function PromoCountdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = expiresAt - now
  useEffect(() => { if (remaining <= 0) onExpire() }, [remaining, onExpire])
  if (remaining <= 0) return null

  const totalSecs = Math.floor(remaining / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <span className="promo-bar-timer" aria-label="Time left on this offer">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />
      </svg>
      <span className="promo-bar-clock">{days > 0 ? `${days}d ` : ''}{pad(hours)}:{pad(mins)}:{pad(secs)}</span>
    </span>
  )
}

type Line = { qty: number; ratios: string[]; duration: number | null }
const emptyLines = (): Record<string, Line> => Object.fromEntries(SERVICES.map((s) => [s.key, { qty: 0, ratios: [], duration: null }]))

type VideoItem = { id: string; title: string; url: string; type: string; poster?: string }
function isImageUrl(u: string) {
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u)
}

// Real 3D tilt (rotateX/rotateY tracking the cursor) plus a glow that
// follows the pointer — real pointer devices only (see the matching
// @media (hover: hover) guards in App.css), so touch never gets stuck mid-tilt.
function tilt3D(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`)
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}
function resetTilt3D(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

function SecDivider() {
  return (
    <div className="sec-divider" aria-hidden="true">
      <span className="ln" /><span className="dot" /><span className="ln" />
    </div>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
}

// Poster-first, tap-to-play. The card shows only a lightweight poster image on
// load, so the whole gallery paints instantly and NO video bytes are fetched
// until a visitor taps play — this is what keeps it fast on mobile without a
// streaming platform. The clip then loads and plays with sound (the tap is the
// required user gesture).
function VideoCard({ v, onOpen }: { v: VideoItem; onOpen: (v: VideoItem) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => { if (playing) ref.current?.play().catch(() => {}) }, [playing])

  return (
    <figure className="vid3d-card" onMouseMove={tilt3D} onMouseLeave={resetTilt3D}>
      <div className="glow" />
      <div className="vid-frame">
        {playing ? (
          <video ref={ref} src={v.url} poster={v.poster || undefined} controls autoPlay loop playsInline preload="auto" />
        ) : (
          <button className="vid-play" onClick={() => setPlaying(true)} aria-label={`Play ${v.type} video`}>
            {v.poster ? (
              <img src={v.poster} alt={`${v.type} ad preview`} loading="lazy" />
            ) : (
              // Fallback when no poster was captured on upload (e.g. iPhone HEVC
              // clips the uploader's browser couldn't decode to a still): show
              // the video's own first frame via a metadata-only load — a few KB,
              // not the whole clip — so the card never shows an empty dark box.
              <video className="vid-poster-fallback" src={`${v.url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true" />
            )}
            <span className="vid-play-btn"><PlayIcon /></span>
          </button>
        )}
        <button className="vid-expand" aria-label="Expand video" onClick={(e) => { e.stopPropagation(); onOpen(v) }}>
          <ExpandIcon />
        </button>
      </div>
      <figcaption><span className="vid-type">{v.type}</span></figcaption>
    </figure>
  )
}

// Auto-advances horizontally (never vertically) to the next card, fully
// under the customer's control: hover/touch/drag pause it, arrow buttons and
// native swipe/drag step it manually, and it resumes a few seconds after the
// customer stops interacting. Respects prefers-reduced-motion (no autoplay).
// Shared by the Videos and Photos rows — pass a renderCard for each; `kind`
// only labels the arrows for screen readers.
function MediaCarousel({ items, onOpen, renderCard, kind, autoAdvance = true }: {
  items: VideoItem[]
  onOpen: (v: VideoItem) => void
  renderCard: (v: VideoItem, onOpen: (v: VideoItem) => void) => React.ReactNode
  kind: string
  autoAdvance?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const dragStartX = useRef(0)
  const dragStartScroll = useRef(0)

  const pauseNow = () => {
    setPaused(true)
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }
  const scheduleResume = (delay: number) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPaused(false), delay)
  }
  const advance = (dir: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const step = track.clientWidth * 0.86
    if (dir === 1) {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: 'smooth' })
    } else {
      const atStart = track.scrollLeft <= 4
      track.scrollTo({ left: atStart ? track.scrollWidth : track.scrollLeft - step, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (!autoAdvance || items.length <= 1) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => { if (!paused) advance(1) }, 4200)
    return () => clearInterval(id)
  }, [paused, items.length, autoAdvance])

  const step = (dir: 1 | -1) => { pauseNow(); advance(dir); scheduleResume(4500) }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !trackRef.current) { pauseNow(); return }
    dragging.current = true
    didDrag.current = false
    dragStartX.current = e.clientX
    dragStartScroll.current = trackRef.current.scrollLeft
    pauseNow()
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !trackRef.current) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 6) didDrag.current = true
    trackRef.current.scrollLeft = dragStartScroll.current - dx
  }
  const endInteraction = () => { dragging.current = false; scheduleResume(3500) }

  return (
    <div className="vids-wrap" onMouseEnter={pauseNow} onMouseLeave={() => scheduleResume(1200)}
      onTouchStart={pauseNow} onTouchEnd={() => scheduleResume(3500)}>
      <div className="vids-track" ref={trackRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endInteraction} onPointerLeave={endInteraction}
        onClickCapture={(e) => { if (didDrag.current) { e.preventDefault(); e.stopPropagation(); didDrag.current = false } }}>
        {items.map((v) => renderCard(v, onOpen))}
      </div>
      {items.length > 1 && (
        <>
          <button className="vids-arrow prev" aria-label={`Previous ${kind}`} onClick={() => step(-1)}>‹</button>
          <button className="vids-arrow next" aria-label={`Next ${kind}`} onClick={() => step(1)}>›</button>
        </>
      )}
    </div>
  )
}

type Testimonial = { id: string; client: string; rating: number | null; text: string; createdAt: number }

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="tst-card" onMouseMove={tilt3D} onMouseLeave={resetTilt3D}>
      <div className="glow" />
      {t.rating ? (
        <div className="tst-stars" aria-hidden="true">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
      ) : null}
      {t.text && <p className="tst-text">&ldquo;{t.text}&rdquo;</p>}
      <div className="tst-client">{t.client || 'Verified client'}</div>
    </div>
  )
}

// One endless row of small cards, drifting continuously in one direction —
// ambient background motion, not something the customer needs to steer
// (unlike the Videos carousel above). The array is doubled exactly once —
// the minimum needed so the loop point is invisible — never padded with
// extra repeats, so a single real testimonial never reads as several.
function ReviewMarquee({ items, direction }: { items: Testimonial[]; direction: 'left' | 'right' }) {
  const track = [...items, ...items]
  const duration = Math.max(18, track.length * 5)

  return (
    <div className={`tst-row tst-row-${direction}`}>
      <div className="tst-track" style={{ animationDuration: `${duration}s` }}>
        {track.map((t, i) => <TestimonialCard key={`${t.id}-${i}`} t={t} />)}
      </div>
    </div>
  )
}

// Endless carousel of small cards drifting continuously in one direction,
// with whichever card is nearest the center scaling up ("zoomed in") while
// the rest sit smaller — used for the Formats and Process sections. Reuses
// the doubled-array loop trick from ReviewMarquee. Center detection runs on
// a plain interval (not requestAnimationFrame) since a ~150ms cadence is
// plenty smooth for a scale swap and costs far less CPU continuously.
function ZoomMarquee({ items, direction }: { items: React.ReactNode[]; direction: 'left' | 'right' }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const doubled = [...items, ...items]
  const duration = Math.max(20, doubled.length * 3.6)

  useEffect(() => {
    const wrap = wrapRef.current
    const track = trackRef.current
    if (!wrap || !track) return
    const id = setInterval(() => {
      const wrapRect = wrap.getBoundingClientRect()
      const centerX = wrapRect.left + wrapRect.width / 2
      let closest: Element | null = null
      let closestDist = Infinity
      track.querySelectorAll('.zc-item').forEach((el) => {
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.left + r.width / 2 - centerX)
        if (dist < closestDist) { closestDist = dist; closest = el }
      })
      track.querySelectorAll('.zc-item.zc-center').forEach((el) => { if (el !== closest) el.classList.remove('zc-center') })
      if (closest) (closest as Element).classList.add('zc-center')
    }, 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`zc-wrap zc-${direction}`} ref={wrapRef}>
      <div className="zc-track" ref={trackRef} style={{ animationDuration: `${duration}s` }}>
        {doubled.map((child, i) => <div className="zc-item" key={i}>{child}</div>)}
      </div>
    </div>
  )
}

function PhotoCard({ v, onOpen }: { v: VideoItem; onOpen: (v: VideoItem) => void }) {
  return (
    <figure className="vid3d-card photo-card" onMouseMove={tilt3D} onMouseLeave={resetTilt3D}
      onClick={() => onOpen(v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(v)}>
      <div className="glow" />
      <div className="photo-frame">
        <img src={v.url} alt={`${v.type} ad creative produced by Rexran`} loading="lazy" />
        <span className="photo-expand" aria-hidden="true"><ExpandIcon /></span>
      </div>
      <figcaption><span className="vid-type">{v.type}</span></figcaption>
    </figure>
  )
}

// One aspect ratio per deliverable — no free multi-select. For a single unit
// it's a simple single-select. For 2+ units it defaults to one pick that
// applies to every unit ("same size for all"), with a toggle to set a
// different size per item. The parent stores a length-1 array for "all" and a
// length-N array for per-unit (see sizesComplete).
function SizePicker({ qty, options, selected, onChange, bad, label }: {
  qty: number; options: string[]; selected: string[]; onChange: (v: string[]) => void; bad?: boolean; label?: string
}) {
  const [perUnit, setPerUnit] = useState(() => selected.length > 1)
  const base = selected[0] || ''

  const chips = (value: string, pick: (r: string) => void) => (
    <div className="chips">
      {options.map((r) => (
        <button type="button" key={r} className={`chip sm${value === r ? ' on' : ''}`} onClick={() => pick(r)}>{r}</button>
      ))}
    </div>
  )

  if (qty <= 1) {
    return (
      <div className={`bratios${bad ? ' bad' : ''}`}>
        <span className="svc-qty-lab">{label || 'Size'}</span>
        {chips(base, (r) => onChange([r]))}
      </div>
    )
  }

  const goPerUnit = () => { setPerUnit(true); onChange(Array.from({ length: qty }, () => base)) }
  const goSame = () => { setPerUnit(false); onChange([base]) }
  const pickUnit = (i: number, r: string) => {
    const next = Array.from({ length: qty }, (_, u) => selected[u] || '')
    next[i] = r
    onChange(next)
  }

  return (
    <div className={`bratios${bad ? ' bad' : ''}`}>
      <div className="unit-size-head">
        <span className="svc-qty-lab">{perUnit ? `A size for each of the ${qty}` : `Size for all ${qty}`}</span>
        <button type="button" className="unit-size-toggle" onClick={perUnit ? goSame : goPerUnit}>
          {perUnit ? 'Use one size for all' : 'Different size per item'}
        </button>
      </div>
      {!perUnit ? (
        chips(base, (r) => onChange([r]))
      ) : (
        Array.from({ length: qty }).map((_, i) => (
          <div className="unit-size-row" key={i}>
            <span className="unit-size-num">#{i + 1}</span>
            {chips(selected[i] || '', (r) => pickUnit(i, r))}
          </div>
        ))
      )}
    </div>
  )
}

// Fully self-contained: every field, the qty steppers, and the photo
// uploader live here, isolated from the homepage's App() component. This is
// what makes typing/clicking here fast — state changes only re-render this
// modal, never the marketing sections underneath it.
function CheckoutModal({ plan, initialStep, onClose, promo }: { plan: string; initialStep: number; onClose: () => void; promo: Promo | null }) {
  const isCustom = plan === 'Custom'
  const planObj = PLANS.find((p) => p.name === plan)

  const [step, setStep] = useState(initialStep) // 0 sizes, 1 info, 2 pay, 3 done

  // ready-plan size choices (per content key → one size per unit; see SizePicker)
  const [planRatios, setPlanRatios] = useState<Record<string, string[]>>({})

  // custom builder lines
  const [build, setBuild] = useState<Record<string, Line>>(() => ({ ...emptyLines() }))
  const setQty = (state: Record<string, Line>, set: (v: Record<string, Line>) => void, key: string, d: number) => {
    const q = Math.max(0, state[key].qty + d); set({ ...state, [key]: { qty: q, ratios: q === 0 ? [] : state[key].ratios, duration: q === 0 ? null : state[key].duration } })
  }
  const setRatios = (key: string, ratios: string[]) => {
    setBuild((state) => ({ ...state, [key]: { ...state[key], ratios } }))
  }
  const setDuration = (key: string, secs: number) => {
    setBuild((state) => ({ ...state, [key]: { ...state[key], duration: secs } }))
  }
  // unit price for a service: if it has durations, use the picked one (fallback to its base price)
  const unitPrice = (sv: Service, line: Line) => {
    if (sv.durations && sv.durations.length) {
      const d = sv.durations.find((x) => x.secs === line.duration)
      return d ? d.price : sv.durations[0].price
    }
    return sv.price
  }
  // A promo code the customer types here — validated against /api/promo?code=.
  const [codeInput, setCodeInput] = useState('')
  const [appliedCode, setAppliedCode] = useState<PromoCode | null>(null)
  const [codeErr, setCodeErr] = useState('')
  const [checkingCode, setCheckingCode] = useState(false)

  const buildTotal = SERVICES.reduce((s, sv) => s + build[sv.key].qty * unitPrice(sv, build[sv.key]), 0)
  const belowMin = isCustom && buildTotal < MIN_ORDER
  const planTotal = isCustom ? buildTotal : (planObj ? parseInt(planObj.price.replace('$', '')) : 0)
  // What the customer actually pays. The server recomputes this independently
  // (see api/checkout.js) — the customer gets the better of the store-wide
  // promo and any typed code, never both stacked. Gift/no promo => planTotal.
  const promoCharge = applyPromo(planTotal, promo)
  const codeCharge = appliedCode ? applyPromo(planTotal, appliedCode) : planTotal
  const chargeTotal = Math.min(promoCharge, codeCharge)
  const discounted = chargeTotal < planTotal
  const codeWins = appliedCode != null && codeCharge <= promoCharge && codeCharge < planTotal
  const appliedDiscountLabel = codeWins
    ? `Code ${appliedCode!.code} (${discountLabel(appliedCode!)})`
    : (isDiscount(promo) ? `${promo!.headline} (${discountLabel(promo!)})` : '')

  const applyCode = async () => {
    const c = codeInput.trim()
    if (!c) return
    setCheckingCode(true); setCodeErr('')
    try {
      const r = await fetch(`/api/promo?code=${encodeURIComponent(c)}`)
      const d = await r.json()
      if (d.code) { setAppliedCode(d.code); setCodeErr('') }
      else { setAppliedCode(null); setCodeErr("That code isn't valid.") }
    } catch {
      setAppliedCode(null); setCodeErr('Could not check the code. Please try again.')
    } finally { setCheckingCode(false) }
  }
  const clearCode = () => { setAppliedCode(null); setCodeInput(''); setCodeErr('') }

  // client details
  const [info, setInfo] = useState({ brand: '', productUrl: '', offer: '', email: '', language: 'English', notes: '' })
  const setField = (k: string, v: string) => { setInfo((s) => ({ ...s, [k]: v })); setBadFields((b) => (b[k] ? { ...b, [k]: false } : b)) }
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [infoErr, setInfoErr] = useState('')
  const [badFields, setBadFields] = useState<Record<string, boolean>>({})
  const [sizeErr, setSizeErr] = useState('')
  const [badSizes, setBadSizes] = useState<Record<string, boolean>>({})
  const [badDur, setBadDur] = useState<Record<string, boolean>>({})

  // product reference photos — uploaded straight from the browser to Vercel
  // Blob (same pattern as the admin panel's uploads), capped at 6.
  const MAX_PHOTOS = 6
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoErr, setPhotoErr] = useState('')

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setPhotoErr('')
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) { setPhotoErr(`Up to ${MAX_PHOTOS} photos.`); return }
    const toUpload = Array.from(files).slice(0, room)
    setUploadingPhotos(true)
    try {
      const uploaded = await Promise.all(toUpload.map((file) =>
        r2Upload(file, { endpoint: '/api/customer-upload' })
      ))
      setPhotos((p) => [...p, ...uploaded])
    } catch (e) {
      setPhotoErr('Could not upload one or more photos: ' + String(e instanceof Error ? e.message : e))
    } finally {
      setUploadingPhotos(false)
    }
  }
  const removePhoto = (url: string) => setPhotos((p) => p.filter((u) => u !== url))

  // Validate size selection on step 0 before continuing to details
  const goToDetails = () => {
    const bad: Record<string, boolean> = {}
    const badD: Record<string, boolean> = {}
    if (isCustom) {
      SERVICES.forEach((sv) => {
        // every unit of a selected service must have a size (if it offers sizes)
        if (build[sv.key].qty > 0 && sv.ratios.length > 0 && !sizesComplete(build[sv.key].ratios, build[sv.key].qty)) bad[sv.key] = true
        // selected video service must have a duration chosen
        if (build[sv.key].qty > 0 && sv.durations && sv.durations.length && build[sv.key].duration == null) badD[sv.key] = true
      })
      if (belowMin) { setSizeErr(`Minimum order is $${MIN_ORDER}. Add a little more to continue.`); return }
    } else {
      ;(PLAN_CONTENTS[plan] || []).forEach((c) => {
        if (!sizesComplete(planRatios[c.key] || [], c.qty)) bad[c.key] = true
      })
    }
    setBadSizes(bad)
    setBadDur(badD)
    if (Object.keys(bad).length || Object.keys(badD).length) {
      setSizeErr('Please complete the highlighted item(s) — pick a size' + (Object.keys(badD).length ? ' and a duration' : '') + '.')
      return
    }
    setSizeErr('')
    setStep(1)
  }

  // Validate required details before allowing payment; mark every bad field red
  const goToPayment = () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())
    const bad: Record<string, boolean> = {
      brand: !info.brand.trim(),
      email: !emailOk,
      productUrl: !info.productUrl.trim(),
      notes: !info.notes.trim(),
    }
    setBadFields(bad)
    if (Object.values(bad).some(Boolean)) {
      setInfoErr('Please complete the highlighted fields before continuing.')
      return
    }
    setInfoErr('')
    setStep(2)
  }

  // assemble services & sizes for the order
  // A length-1 ratios array means "this size for all N" — the checkout summary
  // reads it naturally (e.g. "3× UGC video (9:16)"); per-unit stays as-is.
  const sizesForOrder = (chosen: string[], qty: number) => (chosen.length <= 1 ? chosen : chosen.slice(0, qty))
  const orderItems = () => {
    if (isCustom) {
      return SERVICES.filter((sv) => build[sv.key].qty > 0).map((sv) => ({
        key: sv.key, label: sv.label, qty: build[sv.key].qty, ratios: sizesForOrder(build[sv.key].ratios, build[sv.key].qty),
        duration: build[sv.key].duration ? `${build[sv.key].duration}s` : undefined,
      }))
    }
    return (PLAN_CONTENTS[plan] || []).map((c) => ({
      label: c.label, qty: c.qty, ratios: sizesForOrder(planRatios[c.key] || [], c.qty),
      duration: c.duration ? `${c.duration}s` : undefined,
    }))
  }

  const submitOrder = async () => {
    setSubmitting(true); setSubmitErr('')
    const payload = {
      package: isCustom ? 'Custom' : plan,
      total: planTotal,
      brand: info.brand, productUrl: info.productUrl, offer: info.offer,
      email: info.email, language: info.language, notes: info.notes,
      items: orderItems(), photos,
      promoCode: appliedCode?.code,
    }
    try {
      // Create a Stripe Checkout session and redirect to the secure payment page.
      // Notification is sent by the Stripe webhook only AFTER payment succeeds.
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok || !data.url) throw new Error(data.error || 'checkout failed')
      // Navigate to Stripe via a local anchor rather than assigning
      // window.location.href — functionally identical, but keeps the React
      // Compiler from flagging a mutation of the global object.
      const a = document.createElement('a')
      a.href = data.url
      a.click()
    } catch (e) {
      setSubmitErr('Could not start secure checkout: ' + String(e instanceof Error ? e.message : e) + ' — please try again, or email hello@rexran.com.')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>

        {/* progress */}
        <div className="steps-bar">
          {['Sizes', 'Details', 'Payment'].map((lab, i) => (
            <div className={`stepdot${step === i ? ' on' : ''}${step > i ? ' done' : ''}`} key={lab}>
              <span className="d">{step > i ? '✓' : i + 1}</span>{lab}
            </div>
          ))}
        </div>

        {/* header */}
        <h3>{isCustom ? <>Build <em>your own.</em></> : <>{plan} <em>package.</em></>}</h3>

        <div className="step-anim" key={step}>
        {/* STEP 0 — SIZES */}
        {step === 0 && (
          <>
            {isCustom ? (
              <>
                <p className="modal-lede">Pick each service, set the quantity, choose its duration and sizes. Price updates live.</p>
                {SERVICES.map((sv) => {
                  const line = build[sv.key]; const on = line.qty > 0
                  const priceLabel = sv.durations && sv.durations.length
                    ? `from $${Math.min(...sv.durations.map((d) => d.price))} each`
                    : `$${sv.price} each`
                  return (
                    <div className={`bsvc${on ? ' on' : ''}`} key={sv.key}>
                      <div className="bitem">
                        <div className="bitem-info"><h4>{sv.label}</h4><p>{priceLabel}</p></div>
                        <div className="stepper">
                          <button onClick={() => setQty(build, setBuild, sv.key, -1)} disabled={line.qty === 0} aria-label="Decrease">−</button>
                          <span className="qty">{line.qty}</span>
                          <button onClick={() => setQty(build, setBuild, sv.key, 1)} aria-label="Increase">+</button>
                        </div>
                      </div>
                      {on && sv.durations && sv.durations.length > 0 && (
                        <div className={`bratios${badDur[sv.key] ? ' bad' : ''}`}>
                          <span className="svc-qty-lab">Video duration</span>
                          <div className="chips">
                            {sv.durations.map((d) => (
                              <button type="button" key={d.secs} className={`chip sm${line.duration === d.secs ? ' on' : ''}`}
                                onClick={() => { setDuration(sv.key, d.secs); setBadDur((b) => (b[sv.key] ? { ...b, [sv.key]: false } : b)) }}>{d.secs}s · ${d.price}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {on && sv.ratios.length > 0 && (
                        <SizePicker
                          qty={line.qty} options={sv.ratios} selected={line.ratios} bad={badSizes[sv.key]}
                          label="Size for this service"
                          onChange={(v) => { setRatios(sv.key, v); setBadSizes((b) => (b[sv.key] ? { ...b, [sv.key]: false } : b)) }}
                        />
                      )}
                    </div>
                  )
                })}
              </>
            ) : (
              <>
                <p className="modal-lede">Choose the size for each part of your {plan} package — one size per item.</p>
                {(PLAN_CONTENTS[plan] || []).map((c) => (
                  <div className="bsvc on" key={c.key}>
                    <div className="bitem"><div className="bitem-info"><h4>{c.label}{c.qty > 1 ? ` · ×${c.qty}` : ''}</h4></div></div>
                    <SizePicker
                      qty={c.qty} options={c.ratios} selected={planRatios[c.key] || []} bad={badSizes[c.key]}
                      label="Pick the size"
                      onChange={(v) => { setPlanRatios((p) => ({ ...p, [c.key]: v })); setBadSizes((b) => (b[c.key] ? { ...b, [c.key]: false } : b)) }}
                    />
                  </div>
                ))}
              </>
            )}
            <div className="btotal">
              <div className="sum"><span className="lab">{isCustom ? 'Your total' : 'Package price'}</span>
                {discounted ? <><span className="sum-was">{money(planTotal)}</span> {money(chargeTotal)}</> : <>{money(planTotal)}</>}
              </div>
              <button className="cta" disabled={belowMin} onClick={goToDetails}>Continue</button>
            </div>
            {belowMin && buildTotal > 0 && <p className="bmin">Minimum order is ${MIN_ORDER}. Add a little more to continue.</p>}
            {sizeErr && <p className="bmin" style={{ color: '#e6896b' }}>{sizeErr}</p>}
          </>
        )}

        {/* STEP 1 — DETAILS */}
        {step === 1 && (
          <>
            <p className="modal-lede">Tell us about the product so Rexran can produce the right creative.</p>
            <div className="fgrid two">
              <div className={`field${badFields.brand ? ' bad' : ''}`}><label>Brand / store name</label><input value={info.brand} onChange={(e) => setField('brand', e.target.value)} placeholder="Acme Supply Co." /></div>
              <div className={`field${badFields.productUrl ? ' bad' : ''}`}><label>Product link</label><input type="url" value={info.productUrl} onChange={(e) => setField('productUrl', e.target.value)} placeholder="https://…/your-product" /></div>
            </div>
            <div style={{ height: 22 }} />
            <div className="fgrid two">
              <div className={`field${badFields.email ? ' bad' : ''}`}><label>Email</label><input type="email" value={info.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@store.com" /></div>
              <div className="field"><label>Primary language</label>
                <select value={info.language} onChange={(e) => setField('language', e.target.value)}>
                  <option>English</option>
                  <option>Arabic</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Portuguese</option>
                  <option>Italian</option>
                  <option>Dutch</option>
                  <option>Turkish</option>
                  <option>Russian</option>
                  <option>Hindi</option>
                  <option>Japanese</option>
                  <option>Korean</option>
                  <option>Chinese (Mandarin)</option>
                  <option>Bilingual</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ height: 22 }} />
            <div className="field"><label>Offer to feature <span className="opt">optional</span></label><input value={info.offer} onChange={(e) => setField('offer', e.target.value)} placeholder="e.g. Buy 1 Get 1 Free · 20% off · Free gift · Free shipping" /></div>
            <div style={{ height: 22 }} />
            <div className={`field${badFields.notes ? ' bad' : ''}`}><label>Product details & what to highlight</label><textarea value={info.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="What it is, who it's for, the angle to push, any text or logo that must appear…" /></div>
            <div style={{ height: 22 }} />
            <div className="field">
              <label>Product photos <span className="opt">optional, up to {MAX_PHOTOS}</span></label>
              <div className="photo-picker">
                {photos.map((url) => (
                  <div className="photo-thumb" key={url}>
                    <img src={url} alt="" />
                    <button type="button" className="photo-thumb-x" aria-label="Remove photo" onClick={() => removePhoto(url)}>✕</button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="photo-add">
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }}
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} disabled={uploadingPhotos} />
                    {uploadingPhotos ? <span className="photo-add-spin" /> : <PlusIcon />}
                    <span>{uploadingPhotos ? 'Uploading…' : 'Add photos'}</span>
                  </label>
                )}
              </div>
              {photoErr && <p className="bmin" style={{ textAlign: 'left', color: '#e6896b', marginTop: 8 }}>{photoErr}</p>}
            </div>
            {infoErr && <p className="bmin" style={{ textAlign: 'left', color: '#e6896b', marginTop: 14 }}>{infoErr}</p>}
            <div className="modal-nav">
              <button className="cta ghost" onClick={() => setStep(0)}>Back</button>
              <button className="cta" onClick={goToPayment}>Continue to payment</button>
            </div>
          </>
        )}

        {/* STEP 2 — PAYMENT */}
        {step === 2 && (
          <>
            <p className="modal-lede">Secure checkout, powered by Stripe. Your finished files arrive on a private download page, ready to run.</p>
            <div className="pay-sum">
              <div className="pay-row"><span>{isCustom ? 'Custom package' : `${plan} package`}</span><strong>{money(planTotal)}</strong></div>
              {discounted && (
                <div className="pay-row pay-discount"><span>{appliedDiscountLabel}</span><span>−{money(planTotal - chargeTotal)}</span></div>
              )}
              {discounted && (
                <div className="pay-row pay-total"><span>You pay</span><strong>{money(chargeTotal)}</strong></div>
              )}
              <div className="pay-row muted"><span>Delivery</span><span>Fast turnaround · private download link</span></div>
            </div>

            {/* Promo code */}
            <div className="promo-code-row">
              {appliedCode && codeWins ? (
                <div className="promo-code-applied">
                  <span>✓ Code <strong>{appliedCode.code}</strong> applied — {discountLabel(appliedCode)}</span>
                  <button type="button" className="promo-code-remove" onClick={clearCode}>Remove</button>
                </div>
              ) : (
                <>
                  <div className="promo-code-field">
                    <input
                      value={codeInput}
                      onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); if (codeErr) setCodeErr('') }}
                      onKeyDown={(e) => e.key === 'Enter' && applyCode()}
                      placeholder="Promo code"
                      style={{ textTransform: 'uppercase' }}
                      maxLength={40}
                    />
                    <button type="button" className="cta ghost promo-code-apply" onClick={applyCode} disabled={checkingCode || !codeInput.trim()}>
                      {checkingCode ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  {appliedCode && !codeWins && <p className="promo-code-note">Your current offer already beats code <strong>{appliedCode.code}</strong> — you're getting the bigger discount.</p>}
                  {codeErr && <p className="promo-code-err">{codeErr}</p>}
                </>
              )}
            </div>
            <p className="bmin" style={{ textAlign: 'left', marginTop: 18 }}>🔒 You'll be taken to Stripe's secure page to enter your card. Rexran never sees your card details. By paying you agree to our <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-hi)' }}>Terms</a>.</p>
            {submitErr && <p className="bmin" style={{ textAlign: 'left', color: '#e6896b' }}>{submitErr}</p>}
            <div className="modal-nav">
              <button className="cta ghost" onClick={() => setStep(1)} disabled={submitting}>Back</button>
              <button className="cta" onClick={submitOrder} disabled={submitting}>{submitting ? 'Starting checkout…' : `Pay ${money(chargeTotal)} →`}</button>
            </div>
          </>
        )}

        {/* STEP 3 — DONE */}
        {step === 3 && (
          <div className="done" style={{ marginTop: 10 }}>
            <span className="dot" />
            <p>Payment received — thank you. Your order is confirmed. Rexran will be in touch by email shortly with your timeline, and your finished ads will arrive on a private download page, ready to run.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  useReveal()
  const scrolled = useScrolled()
  const reducedMotion = usePrefersReducedMotion()

  const isPaidReturn = () => new URLSearchParams(window.location.search).get('paid') === '1'

  // checkout modal: which plan ('Spark'..) or 'Custom'. If the customer just
  // returned from Stripe, resolve straight into the confirmation step —
  // computed in the lazy initializer so no effect-time setState is needed.
  const [checkout, setCheckout] = useState<string | null>(() => (isPaidReturn() ? 'Growth' : null))

  // Clean the URL so a refresh doesn't re-trigger the confirmation step, and
  // fire a purchase-conversion event (no-op until an analytics provider is
  // actually configured — see src/analytics.ts).
  useEffect(() => {
    if (isPaidReturn()) {
      const sessionId = new URLSearchParams(window.location.search).get('session_id')
      trackPurchase(sessionId)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const tilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  // portfolio videos from admin — split into a video carousel and a photo grid
  const [videos, setVideos] = useState<VideoItem[]>([])
  useEffect(() => {
    fetch('/api/videos').then((r) => r.json()).then((d) => setVideos(d.videos || [])).catch(() => {})
  }, [])
  const videoItems = videos.filter((v) => !isImageUrl(v.url))
  const photoItems = videos.filter((v) => isImageUrl(v.url))
  const [mediaLightbox, setMediaLightbox] = useState<VideoItem | null>(null)

  // Real client testimonials — only ones a studio admin has approved ever
  // reach this list (see /api/testimonials); nothing here is invented.
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  useEffect(() => {
    fetch('/api/testimonials').then((r) => r.json()).then((d) => setTestimonials(d.testimonials || [])).catch(() => {})
  }, [])

  // Active store-wide promotion (a discount or a gift), set by the admin.
  // Nothing shows until one is live; the discount is applied for real at
  // checkout by the server (see api/checkout.js).
  const [promo, setPromo] = useState<Promo | null>(null)
  useEffect(() => {
    fetch('/api/promo').then((r) => r.json()).then((d) => setPromo(d.promo || null)).catch(() => {})
  }, [])
  // Let the fixed nav + hero make room for the promo bar. The bar's height
  // varies (it can wrap to two lines on a phone), so measure it and expose it
  // as --promo-h instead of hard-coding a magic number — that way the content
  // below never hides behind it no matter how long the offer text is.
  const promoRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    document.body.classList.toggle('has-promo', !!promo)
    const el = promoRef.current
    if (!promo || !el) { document.body.style.removeProperty('--promo-h'); return }
    const measure = () => document.body.style.setProperty('--promo-h', `${el.offsetHeight}px`)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => { ro.disconnect(); document.body.classList.remove('has-promo'); document.body.style.removeProperty('--promo-h') }
  }, [promo])

  // FAQ accordion — single item open at a time
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // contact modal
  const [contactOpen, setContactOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contact, setContact] = useState({ name: '', email: '', message: '' })
  const setContactField = (k: string, v: string) => setContact((s) => ({ ...s, [k]: v }))
  const [contactState, setContactState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const openContact = () => { setContactOpen(true); setContactState('idle') }
  const closeContact = () => { setContactOpen(false); setContactState('idle') }

  const sendContact = async () => {
    if (!contact.email.trim() || !contact.message.trim()) { setContactState('error'); return }
    setContactState('sending')
    try {
      const r = await fetch('/api/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: 'Contact message',
          brand: contact.name, email: contact.email, notes: contact.message,
        }),
      })
      if (!r.ok) throw new Error('failed')
      setContactState('done')
      setContact({ name: '', email: '', message: '' })
    } catch {
      setContactState('error')
    }
  }

  const open = (plan: string) => setCheckout(plan)
  const close = () => setCheckout(null)

  return (
    <>
      <div className="stage">
        <div className="aurora a1" /><div className="aurora a2" /><div className="aurora a3" /><div className="mesh" />
      </div>
      <div className="grain" />

      {promo && (
        <a className="promo-bar" href="#pricing" ref={promoRef}>
          <span className="promo-bar-tag">{promo.type === 'gift' ? 'Gift' : 'Offer'}</span>
          <span className="promo-bar-text">
            <strong>{promo.headline}</strong>
            {isDiscount(promo) && (
              <span className="promo-bar-value">{promo.type === 'percent' ? `${promo.value}% OFF` : `${money(promo.value)} OFF`}</span>
            )}
            {promo.detail && <span className="promo-bar-detail">{promo.detail}</span>}
          </span>
          {promo.expiresAt && <PromoCountdown expiresAt={promo.expiresAt} onExpire={() => setPromo(null)} />}
          <span className="promo-bar-go">{isDiscount(promo) ? 'Claim it' : 'Start a project'} →</span>
        </a>
      )}

      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <a className="brand" href="#top" onClick={() => setMenuOpen(false)}><RexMark className="brand-logo" />Rexran</a>
        <div className="nav-links">
          <a href="#work">Work</a>
          <a href="/studio">Studio</a>
          <a href="#pricing">Pricing</a>
          <a href="/guides">Guides</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className="nav-cta" href="#pricing">Start a project</a>
        <button className={`nav-burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
      </nav>
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="mobile-menu-inner" onClick={(e) => e.stopPropagation()}>
          <a href="#work" onClick={() => setMenuOpen(false)}>Work</a>
          <a href="/studio" onClick={() => setMenuOpen(false)}>Studio</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="/guides" onClick={() => setMenuOpen(false)}>Guides</a>
          <button onClick={() => { setMenuOpen(false); openContact() }}>Contact</button>
          <a href="https://instagram.com/rexran.media" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Instagram</a>
          <a className="cta" href="#pricing" onClick={() => setMenuOpen(false)}>Start a project</a>
        </div>
      </div>

      <header className="hero" id="top">
        <RexMark className="hero-logo" />
        <div className="hero-kicker">AI-Directed Ad Studio</div>
        <h1 className="hero-h">
          <span className="ln"><span>Make them</span></span>
          <span className="ln"><span><em>stop scrolling.</em></span></span>
        </h1>
        <p className="hero-sub">
          Rexran turns one product link into cinematic UGC video, scroll-stopping statics, and 4K product
          photography — produced by hand, delivered as full-quality downloads in 48 hours. No actors. No crew. No software to learn.
        </p>
        <div className="hero-actions">
          <a className="cta" href="#pricing">Start a project</a>
          <a className="cta ghost" href="#work">See the work</a>
        </div>
        <p className="hero-promise">Agency-grade creative · Freelancer speed · Made for DTC</p>
        <div className="scroll-hint">Scroll<div className="bar" /></div>
      </header>

      <div className="strip">
        <div className="strip-track" aria-hidden="true">
          <span>UGC Video <b>✦</b> Static Ads <b>✦</b> Cinematic &amp; Motion Design <b>✦</b> 4K Photoshoots <b>✦</b> Campaign Sets <b>✦</b> </span>
          <span>UGC Video <b>✦</b> Static Ads <b>✦</b> Cinematic &amp; Motion Design <b>✦</b> 4K Photoshoots <b>✦</b> Campaign Sets <b>✦</b> </span>
        </div>
      </div>

      <section className="sec" id="work">
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">The Work</div>
            <h2 className="sec-h">Every format your <em>ad account</em> is hungry for.</h2>
            <p className="sec-lede">Pick one, mix them, or get a recommended set built to convert for your product.</p>
          </div>
          {/* Not wrapped in .reveal: that IntersectionObserver only scans for
              .reveal elements once on mount, but these sections mount later
              (after the async /api/videos fetch resolves) — they'd never be
              observed and would stay stuck at opacity: 0 forever. */}
          {videoItems.length > 0 && (
            <div>
              <div className="sec-tag med-tag">Videos</div>
              <MediaCarousel items={videoItems} onOpen={setMediaLightbox} kind="video" autoAdvance={false}
                renderCard={(v, open) => <VideoCard key={v.id} v={v} onOpen={open} />} />
            </div>
          )}
          {photoItems.length > 0 && (
            <div>
              <div className="sec-tag med-tag">Photos</div>
              <MediaCarousel items={photoItems} onOpen={setMediaLightbox} kind="photo"
                renderCard={(v, open) => <PhotoCard key={v.id} v={v} onOpen={open} />} />
            </div>
          )}
          {reducedMotion ? (
            <div className="reel reveal">
              {TILES.map((t) => (
                <div className={`tile ${t.c}`} key={t.n} onMouseMove={tilt}>
                  <div className="glow" /><span className="ph">{t.ph}</span>
                  <h3>{t.t}</h3><p>{t.p}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="reveal">
              <ZoomMarquee direction="left" items={TILES.map((t) => (
                <div className={`tile zc-tile ${t.c}`} key={t.n} onMouseMove={tilt}>
                  <div className="glow" /><span className="ph">{t.ph}</span>
                  <h3>{t.t}</h3><p>{t.p}</p>
                </div>
              ))} />
            </div>
          )}
        </div>
      </section>

      <section className="sec" id="process">
        <SecDivider />
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">The Process</div>
            <h2 className="sec-h">Three steps. <em>Zero overhead</em> on your side.</h2>
          </div>
          {reducedMotion ? (
            <div className="steps reveal">
              {STEPS.map((s) => (
                <div className="step" key={s.n} onMouseMove={tilt}>
                  <div className="glow" />
                  <span className="step-num" aria-hidden="true">{s.n}</span>
                  <h3>{s.t}</h3><p>{s.p}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="reveal">
              <ZoomMarquee direction="left" items={STEPS.map((s) => (
                <div className="step zc-step" key={s.n} onMouseMove={tilt}>
                  <div className="glow" />
                  <span className="step-num" aria-hidden="true">{s.n}</span>
                  <h3>{s.t}</h3><p>{s.p}</p>
                </div>
              ))} />
            </div>
          )}
        </div>
      </section>

      <section className="sec" id="pricing">
        <SecDivider />
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">Pricing</div>
            <h2 className="sec-h">Built around <em>video.</em> Pick one and send the product.</h2>
            <p className="sec-lede">Every package leads with video — the format that converts — with statics to round out the set. Fully done-for-you, no contracts.</p>
          </div>
          <div className="prices reveal">
            {PLANS.map((p) => {
              const planNum = parseInt(p.price.replace('$', ''))
              const planCharge = applyPromo(planNum, promo)
              const planCut = isDiscount(promo) && planCharge < planNum
              return (
              <div className={`pcard${p.feat ? ' feat' : ''}`} key={p.name} onMouseMove={tilt}>
                <div className="glow" />
                {p.feat && <span className="pflag">Most picked</span>}
                <div className="pname">{p.name}</div>
                <div className="pprice">
                  {planCut ? <><span className="pprice-was">{p.price}</span>{money(planCharge)}</> : <>{p.price}</>}
                  <span className="per">{p.per}</span>
                </div>
                <p className="pdesc">{p.desc}</p>
                <ul className="pitems">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
                <button className={`cta${p.feat ? '' : ' ghost'}`} onClick={() => open(p.name)}>Choose {p.name}</button>
              </div>
              )
            })}
          </div>
          <div className="builder-row reveal">
            <button className="builder-trigger" onClick={() => open('Custom')}>
              <span className="plus">+</span> Build your own package
            </button>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="sec" id="why">
        <SecDivider />
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">Why Rexran</div>
            <h2 className="sec-h">Agency-grade creative, <em>without the agency.</em></h2>
          </div>
          <div className="why-grid reveal">
            {WHY.map((w) => (
              <div className="why-card" key={w.t} onMouseMove={tilt}>
                <div className="glow" />
                <h3>{w.t}</h3><p>{w.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROOF + FOUNDING OFFER */}
      <section className="sec" id="proof">
        <SecDivider />
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">Why It Works</div>
            <h2 className="sec-h">Creative built to <em>earn the click.</em></h2>
          </div>
          <div className="founding reveal">
            <div className="founding-badge">Now onboarding</div>
            <div className="founding-body">
              <h3>Founding client spots are open</h3>
              <p>Rexran is taking on its first founding brands. Come in early, lock in founding pricing, and get creative treated like the whole business depends on it — because right now, it does.</p>
            </div>
            <a className="cta" href="#pricing">Claim a spot</a>
          </div>
          <div className="proof-grid reveal">
            {PROOF.map((p) => (
              <div className="proof-card" key={p.t} onMouseMove={tilt}>
                <div className="glow" />
                <div className="proof-k">{p.k}</div>
                <h3>{p.t}</h3>
                <p>{p.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS — real, admin-approved client feedback only. Not wrapped in
          .reveal: the whole section mounts after the async /api/testimonials
          fetch resolves, same reasoning as the Videos/Photos sections above. */}
      {testimonials.length > 0 && (
        <section className="sec" id="reviews">
          <SecDivider />
          <div className="wrap">
            <div className="sec-tag">What Clients Say</div>
            <h2 className="sec-h">Real notes, from real deliveries.</h2>
          </div>
          {testimonials.length >= 6 ? (
            // Enough distinct reviews that a two-row endless marquee reads as
            // variety, not repetition — each row still shows every one of
            // its cards exactly once per loop, just doubled for the seam.
            <div className="tst-rows">
              <ReviewMarquee items={testimonials.filter((_, i) => i % 2 === 0)} direction="right" />
              <ReviewMarquee items={testimonials.filter((_, i) => i % 2 === 1)} direction="left" />
            </div>
          ) : (
            // Too few reviews for a marquee to feel varied — show each one
            // exactly once in a static grid instead of looping the same
            // handful of cards past the customer on repeat.
            <div className="wrap">
              <div className="tst-static-grid">
                {testimonials.map((t) => <TestimonialCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {/* FAQ */}
      <section className="sec" id="faq">
        <SecDivider />
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">Questions</div>
            <h2 className="sec-h">Everything you need to <em>know first.</em></h2>
          </div>
          <div className="faq-list reveal">
            {FAQ.map((f, i) => (
              <div className={`faq-item${openFaq === i ? ' open' : ''}`} key={f.q}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{f.q}</span>
                  <span className="faq-icon"><PlusIcon /></span>
                </button>
                <div className="faq-a-wrap"><div className="faq-a-inner"><p className="faq-a">{f.a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in">
          <a className="brand" href="#top" style={{ fontSize: 20 }}><RexMark className="brand-logo" />Rexran</a>
          <div className="foot-links"><a href="#work">Work</a><a href="/studio">Studio</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><a href="/guides">Guides</a><button className="foot-linkbtn" onClick={openContact}>Contact</button><a href="https://instagram.com/rexran.media" target="_blank" rel="noreferrer">Instagram</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
          <div className="foot-fine">© 2026 Rexran — AI-Directed Ad Studio</div>
        </div>
      </footer>

      {/* CHECKOUT MODAL (multi-step) — its own component so typing/clicking
          inside it (qty steppers, fields, photo uploads) never re-renders
          this entire homepage tree (videos, testimonials, FAQ, etc.). */}
      {checkout && (
        <CheckoutModal plan={checkout} initialStep={isPaidReturn() ? 3 : 0} onClose={close} promo={promo} key={checkout} />
      )}

      {/* CONTACT MODAL */}
      {contactOpen && (
        <div className="modal-back" onClick={closeContact}>
          <div className="modal contact-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={closeContact} aria-label="Close">✕</button>
            {contactState === 'done' ? (
              <div className="done" style={{ marginTop: 10 }}>
                <span className="dot" />
                <p>Message sent — thank you. Rexran will get back to you shortly at the email you provided.</p>
              </div>
            ) : (
              <>
                <h3>Let's <em>talk.</em></h3>
                <p className="modal-lede">Questions, a custom brief, or just saying hello — send a note and Rexran will reply by email.</p>
                <div className="fgrid two">
                  <div className="field"><label>Your name</label><input value={contact.name} onChange={(e) => setContactField('name', e.target.value)} placeholder="Your name" /></div>
                  <div className="field"><label>Email</label><input type="email" value={contact.email} onChange={(e) => setContactField('email', e.target.value)} placeholder="you@brand.com" /></div>
                </div>
                <div style={{ height: 22 }} />
                <div className="field"><label>Message</label><textarea value={contact.message} onChange={(e) => setContactField('message', e.target.value)} placeholder="Tell us what you're looking for…" /></div>
                {contactState === 'error' && <p className="bmin" style={{ textAlign: 'left', color: '#e6896b', marginTop: 14 }}>Please add your email and a message, then try again — or reach us @rexran.media on Instagram.</p>}
                <div className="modal-nav" style={{ justifyContent: 'flex-end' }}>
                  <button className="cta" onClick={sendContact} disabled={contactState === 'sending'}>{contactState === 'sending' ? 'Sending…' : 'Send message'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MEDIA LIGHTBOX — shared by the Videos carousel and the Photos grid */}
      {mediaLightbox && (
        <div className="modal-back photo-lightbox-back" onClick={() => setMediaLightbox(null)}>
          <div className="photo-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setMediaLightbox(null)} aria-label="Close">✕</button>
            {isImageUrl(mediaLightbox.url) ? (
              <img src={mediaLightbox.url} alt="" />
            ) : (
              <video src={mediaLightbox.url} controls autoPlay playsInline />
            )}
          </div>
        </div>
      )}
    </>
  )
}
