// POST /api/upload — admin only. Returns a short-lived presigned R2 PUT url so
// the admin's browser uploads portfolio media / delivery files straight to
// Cloudflare R2 (free egress, no bandwidth cap), then the client stores the
// returned public url. Replaces the old Vercel Blob client-upload flow.
import { presignPut, buildKey, r2Configured } from './_lib/r2.js'
import { checkPassword } from './_lib/auth.js'
import { isBlockedByFailedAttempts, recordFailedAttempt } from './_lib/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!r2Configured()) return res.status(500).json({ error: 'Media storage is not configured. Add the R2_* env vars and redeploy.' })

  const { password, filename, contentType, kind } = req.body || {}

  if (await isBlockedByFailedAttempts(req, 'admin', 10)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
  }
  if (!checkPassword(password, process.env.ADMIN_PASSWORD)) {
    await recordFailedAttempt(req, 'admin', 15 * 60)
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!/^(image|video)\//.test(String(contentType || ''))) {
    return res.status(400).json({ error: 'Only image or video files are allowed.' })
  }

  // Keep the two admin flows in separate folders so the R2 dashboard makes it
  // obvious what's a showcase asset vs. a client deliverable.
  const prefix = kind === 'delivery' ? 'deliveries/' : 'portfolio/'

  try {
    const { uploadUrl, publicUrl } = await presignPut(buildKey(prefix, filename))
    return res.status(200).json({ uploadUrl, publicUrl })
  } catch (e) {
    return res.status(500).json({ error: String(e instanceof Error ? e.message : e) })
  }
}
