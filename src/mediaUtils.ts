// Direct-to-R2 media helpers. The browser asks our API for a short-lived
// presigned PUT url, then uploads the file straight to Cloudflare R2 (bypasses
// the serverless body-size limit). R2 egress is free, so serving the result
// never hits a bandwidth cap the way Vercel Blob did.

const EXT_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp', ogv: 'video/ogg',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
}

// Browsers (Windows especially) sometimes report an empty File.type; fall back
// to a type guessed from the extension so R2 stores the object with a real
// content type (needed for correct playback / display).
export function contentTypeFor(file: File): string {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().split('.').pop() || ''
  return EXT_CONTENT_TYPES[ext] || 'application/octet-stream'
}

const isVideoFile = (file: File) => /^video\//.test(contentTypeFor(file))
const isImageFile = (file: File) => /^image\//.test(contentTypeFor(file))

// Shrink an oversized showcase image before upload so it loads fast on mobile.
// Re-encodes to JPEG at up to `maxDim` on the long edge. Leaves small images,
// non-images, GIFs (animation), and anything that fails to decode untouched.
export async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!isImageFile(file) || /gif$/i.test(contentTypeFor(file))) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1 && file.size < 600 * 1024) { bitmap.close(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch { return file }
}

// Capture a video's first frame as a small JPEG so the card shows an instant
// still (poster) while the clip buffers — the biggest perceived-speed win on
// mobile. Returns null if the frame can't be captured.
export async function makeVideoPoster(file: File, maxDim = 720): Promise<File | null> {
  if (!isVideoFile(file)) return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    const finish = (result: File | null) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(result) }
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.onloadeddata = () => { try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2) } catch { finish(null) } }
    video.onseeked = () => {
      const w = video.videoWidth, h = video.videoHeight
      if (!w || !h) return finish(null)
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => finish(b ? new File([b], 'poster.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.8)
    }
    video.onerror = () => finish(null)
    setTimeout(() => finish(null), 8000)
    video.src = url
  })
}

function putWithProgress(url: string, file: File, contentType: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
}

// Upload a file to R2 via a presigned url minted by `endpoint`. Returns the
// object's permanent public url.
export async function r2Upload(
  file: File,
  opts: { endpoint: string; password?: string; kind?: string; onProgress?: (pct: number) => void },
): Promise<string> {
  const contentType = contentTypeFor(file)
  const res = await fetch(opts.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: opts.password, filename: file.name, contentType, kind: opts.kind }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.uploadUrl) throw new Error(data.error || 'Could not start the upload')
  await putWithProgress(data.uploadUrl, file, contentType, opts.onProgress)
  return data.publicUrl as string
}

// Force a real "save file" (not an inline view) by fetching the object and
// triggering a download with the given name. Needs the R2 bucket's CORS to
// allow GET from this origin.
export async function forceDownload(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('fetch failed')
  const blob = await res.blob()
  const obj = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = obj
  a.download = filename || 'rexran-file'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(obj), 4000)
}
