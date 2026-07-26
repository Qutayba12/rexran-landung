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
