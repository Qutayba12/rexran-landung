// GET /api/videos — public: returns the list of portfolio videos
import { Redis } from '@upstash/redis'
import { toCdnUrl } from './_lib/r2.js'

const redis = Redis.fromEnv()
const KEY = 'rexran:videos'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const stored = (await redis.get(KEY)) || []
    const videos = stored.map((v) => ({ ...v, url: toCdnUrl(v.url), poster: toCdnUrl(v.poster) }))
    return res.status(200).json({ videos })
  } catch (e) {
    return res.status(500).json({ error: 'Could not load videos', detail: String(e) })
  }
}
