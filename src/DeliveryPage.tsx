import { useEffect, useState } from 'react'
import RexMark from './RexMark'
import { forceDownload } from './mediaUtils'
import { Analytics } from '@vercel/analytics/react'

type FileItem = { url: string; name: string; type: string; label?: string }
type Delivery = { client: string; note: string; files: FileItem[]; createdAt: number | null }

const isImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u)
const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)

function getDeliveryId() {
  return new URLSearchParams(window.location.search).get('id')
    || window.location.pathname.split('/').filter(Boolean).pop()
}

// Cursor-driven 3D tilt + a glow that tracks the pointer — real pointer
// devices only (see the matching @media (hover: hover) guard in delivery.css),
// so touch never gets stuck mid-tilt.
function tiltCard(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`)
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}
function resetTilt(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

function CheckSeal() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export default function Delivery() {
  // Resolve the id synchronously during render (lazy initializer) so the
  // "no id" case never needs a setState call inside the effect body.
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>(() => {
    const id = getDeliveryId()
    return (!id || id === 'delivery') ? 'notfound' : 'loading'
  })
  const [data, setData] = useState<Delivery | null>(null)
  const [lightbox, setLightbox] = useState<FileItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null)

  useEffect(() => {
    const id = getDeliveryId()
    if (!id || id === 'delivery') return // already resolved to 'notfound' above
    fetch(`/api/delivery?id=${encodeURIComponent(id)}`)
      .then((r) => {
        if (r.status === 404) { setState('notfound'); return null }
        if (!r.ok) { setState('error'); return null }
        return r.json()
      })
      .then((d) => { if (d) { setData(d); setReviewerName(d.client || ''); setState('ok') } })
      .catch(() => setState('error'))
  }, [])

  // No website can silently write a file into a phone's Photos/gallery app —
  // iOS and Android both require one explicit user step for that (otherwise
  // any site could flood your camera roll). The closest thing to a real
  // "save straight to my device" on every platform is the native share
  // sheet with the actual file attached: "Save to Photos"/"Save Video" is
  // normally the first option there. Falls back to the existing forced
  // download link wherever file-sharing isn't supported.
  const downloadFile = async (f: FileItem) => {
    setDownloadingUrl(f.url)
    // iOS only offers "Save Video"/"Save Image" in the share sheet when the
    // shared file's name carries a real extension — the friendly label alone
    // (e.g. "Cinematic & Motion Design") makes it fall back to "Save to Files".
    const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : ''
    const base = f.label || f.name || 'rexran-file'
    const filename = ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? `${base}${ext}` : base
    let handled = false
    try {
      const res = await fetch(f.url)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const file = new File([blob], filename, { type: f.type || blob.type })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          handled = true
        } catch (e) {
          // AbortError = the customer tapped Cancel on the share sheet —
          // respect that instead of forcing a download anyway.
          if (e instanceof Error && e.name === 'AbortError') handled = true
        }
      }
    } catch { /* fetch/blob failed — fall through to the forced download below */ }
    if (!handled) {
      try { await forceDownload(f.url, filename) }
      catch { const a = document.createElement('a'); a.href = f.url; a.click() }
    }
    setDownloadingUrl(null)
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  const shareRexran = async () => {
    const shareData = {
      title: 'Rexran — AI-Directed Ad Studio',
      text: 'Rexran turned my product into scroll-stopping ads in 48 hours.',
      url: 'https://rexran.com',
    }
    if (navigator.share) {
      try { await navigator.share(shareData); return } catch { /* cancelled or unsupported, fall through */ }
    }
    navigator.clipboard?.writeText(shareData.url).then(() => {
      setShared(true); setTimeout(() => setShared(false), 1800)
    }).catch(() => {})
  }

  const submitFeedback = async () => {
    const id = getDeliveryId()
    if (!id || (!rating && feedback.trim().length < 3)) return
    setSending(true); setSendErr('')
    try {
      const r = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: id, client: reviewerName.trim(), rating: rating || undefined, text: feedback }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Could not send')
      }
      setSent(true)
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Could not send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
    <Analytics />
    <div className="dl">
      <div className="stage">
        <div className="aurora a1" /><div className="aurora a2" /><div className="aurora a3" /><div className="mesh" />
      </div>
      <div className="grain" />

      <header className="dl-head">
        <a className="dl-brand" href="/"><RexMark className="dl-logo" />Rexran</a>
      </header>

      <main className="dl-main">
        {state === 'loading' && (
          <>
            <div className="dl-loading">
              <div className="dl-spinner" />
              <p className="dl-status">Preparing your delivery…</p>
            </div>
            <div className="dl-grid" style={{ marginTop: 24 }} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div className="dl-skel" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="dl-skel-preview" />
                  <div className="dl-card-foot">
                    <div className="dl-skel-line" style={{ width: '60%' }} />
                    <div className="dl-skel-line dl-skel-btn" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {state === 'notfound' && (
          <div className="dl-empty">
            <div className="dl-kicker">Delivery</div>
            <h1>This link isn't available.</h1>
            <p>The delivery link may be incorrect or has been removed. Please check the link, or reach us at <a href="mailto:hello@rexran.com">hello@rexran.com</a>.</p>
          </div>
        )}

        {state === 'error' && (
          <div className="dl-empty">
            <h1>Something went wrong.</h1>
            <p>Please try again, or contact <a href="mailto:hello@rexran.com">hello@rexran.com</a>.</p>
            <button className="cta ghost dl-retry" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}

        {state === 'ok' && data && (
          <>
            <div className="dl-welcome">
              <div className="dl-seal" aria-hidden="true"><CheckSeal /></div>
              <div className="dl-kicker-row">
                <div className="dl-kicker">Your creative is ready</div>
                <button className="dl-copy" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
              </div>
              <h1>{data.client ? `${data.client}, your ads have landed.` : 'Your ads have landed.'}</h1>
            </div>
            {data.note && <p className="dl-note">{data.note}</p>}
            <p className="dl-count">{data.files.length} file{data.files.length !== 1 ? 's' : ''} ready to run</p>

            <div className="dl-grid" style={{ marginTop: 40 }}>
              {data.files.map((f, i) => {
                const media = isImage(f.url) || isVideo(f.url)
                return (
                  <div className="dl-card" key={i} style={{ animationDelay: `${i * 0.07}s` }} onMouseMove={tiltCard} onMouseLeave={resetTilt}>
                    <div className="glow" />
                    <div className="dl-preview">
                      {isImage(f.url) ? (
                        <img src={f.url} alt={f.label || f.name} loading="lazy" />
                      ) : isVideo(f.url) ? (
                        <video src={`${f.url}#t=0.1`} controls preload="metadata" playsInline />
                      ) : (
                        <div className="dl-file-icon">FILE</div>
                      )}
                      {media && (
                        <button className="dl-expand" aria-label="Expand preview" onClick={() => setLightbox(f)}>
                          <ExpandIcon />
                        </button>
                      )}
                    </div>
                    <div className="dl-card-foot">
                      <span className="dl-name">{f.label || f.name}</span>
                      <button className="dl-dl" onClick={() => downloadFile(f)} disabled={downloadingUrl === f.url}>
                        {downloadingUrl === f.url ? 'Saving…' : 'Download'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="sec-divider dl-divider" aria-hidden="true">
              <span className="ln" /><span className="dot" /><span className="ln" />
            </div>

            <div className="dl-share">
              <div className="dl-share-glow" />
              {sent ? (
                <div className="dl-share-thanks">
                  <h3>Thank you.</h3>
                  <p>We read every word — really appreciate you taking the time.</p>
                </div>
              ) : (
                <>
                  <h3>Loved your ads?</h3>
                  <p>A quick word helps other stores find us — and if you know a brand that needs this too, send them our way.</p>

                  <div className="dl-stars" role="radiogroup" aria-label="Rate your experience">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`dl-star${n <= (hoverRating || rating) ? ' on' : ''}`}
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(n)}
                      >★</button>
                    ))}
                  </div>

                  <input
                    className="dl-feedback-input dl-feedback-name"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Your name or store (optional, but it's more credible with one!)"
                    maxLength={120}
                  />
                  <textarea
                    className="dl-feedback-input"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us what you think (optional, but it helps!)"
                    maxLength={600}
                    rows={3}
                  />
                  {sendErr && <p className="dl-share-err">{sendErr}</p>}

                  <div className="dl-share-actions">
                    <button
                      className="cta"
                      onClick={submitFeedback}
                      disabled={sending || (!rating && feedback.trim().length < 3)}
                    >{sending ? 'Sending…' : 'Send feedback'}</button>
                    <button className="cta ghost" onClick={shareRexran}>{shared ? 'Link copied ✓' : 'Share Rexran'}</button>
                  </div>
                </>
              )}
            </div>

            <p className="dl-help">Questions or need a tweak? Reply to our email or reach us at <a href="mailto:hello@rexran.com">hello@rexran.com</a>.</p>
          </>
        )}
      </main>

      <footer className="dl-foot">© {new Date().getFullYear()} Rexran — AI-Directed Ad Studio</footer>

      {lightbox && (
        <div className="modal-back dl-lightbox-back" onClick={() => setLightbox(null)}>
          <div className="dl-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setLightbox(null)} aria-label="Close">✕</button>
            {isImage(lightbox.url) ? (
              <img src={lightbox.url} alt={lightbox.label || lightbox.name} />
            ) : (
              <video src={lightbox.url} controls autoPlay playsInline />
            )}
            <div className="dl-lightbox-foot">
              <span>{lightbox.label || lightbox.name}</span>
              <button className="dl-dl" onClick={() => downloadFile(lightbox)} disabled={downloadingUrl === lightbox.url}>
                {downloadingUrl === lightbox.url ? 'Saving…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
