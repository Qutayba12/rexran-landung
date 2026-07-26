// POST /api/orders — protected: list confirmed (paid) orders for the admin panel.
// Orders are written by api/stripe-webhook.js once a payment is confirmed.
import { Redis } from '@upstash/redis'
import { checkPassword } from './_lib/auth.js'
import { isBlockedByFailedAttempts, recordFailedAttempt } from './_lib/rateLimit.js'
import { toCdnUrl } from './_lib/r2.js'

const redis = Redis.fromEnv()
const KEY = 'rexran:orders'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body || {}
  if (await isBlockedByFailedAttempts(req, 'admin', 10)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
  }
  if (!checkPassword(password, process.env.ADMIN_PASSWORD)) {
    await recordFailedAttempt(req, 'admin', 15 * 60)
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const stored = (await redis.get(KEY)) || []
    const orders = stored.map((o) => ({ ...o, photos: Array.isArray(o.photos) ? o.photos.map(toCdnUrl) : o.photos }))
    return res.status(200).json({ ok: true, orders })
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
