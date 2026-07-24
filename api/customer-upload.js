// POST /api/customer-upload — public + rate-limited. Returns a short-lived
// presigned R2 PUT url so a customer's browser can upload product reference
// photos directly to Cloudflare R2 during checkout (bypasses the serverless
// body-size limit). Images only. Unlike api/upload.js this is not password
// gated — a customer filling out the order form has no admin password.
import { presignPut, buildKey, r2Configured } from './_lib/r2.js'
import { limitRequest } from './_lib/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!r2Configured()) return res.status(500).json({ error: 'Media storage is not configured.' })

  if (!(await limitRequest(req, 'customer-upload', 30, 10 * 60))) {
    return res.status(429).json({ error: 'Too many uploads. Please try again shortly.' })
  }

  const { filename, contentType } = req.body || {}
  if (!/^image\//.test(String(contentType || ''))) {
    return res.status(400).json({ error: 'Only image files are allowed.' })
  }

  try {
    const { uploadUrl, publicUrl } = await presignPut(buildKey('customer/', filename))
    return res.status(200).json({ uploadUrl, publicUrl })
  } catch (e) {
    return res.status(500).json({ error: String(e instanceof Error ? e.message : e) })
  }
}
