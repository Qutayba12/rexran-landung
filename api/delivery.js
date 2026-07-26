// GET /api/delivery?id=xxxx — public: returns ONE delivery for the customer page.
// The unguessable id acts as the access key. Returns only what the page needs.
import { Redis } from '@upstash/redis'
import { toCdnUrl } from './_lib/r2.js'

const redis = Redis.fromEnv()
const KEY = 'rexran:deliveries'

export default async function handler(req, res) {
  const id = (req.query.id || '').toString()
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const list = (await redis.get(KEY)) || []
    const d = list.find((x) => x.id === id)
    if (!d) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json({
      client: d.client || '',
      note: d.note || '',
      files: (d.files || []).map((f) => ({ ...f, url: toCdnUrl(f.url) })),
      createdAt: d.createdAt || null,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
