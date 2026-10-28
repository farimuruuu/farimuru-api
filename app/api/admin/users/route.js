import {
  getUsage,
  getUser,
  usageKeyFor,
  isAdminEmail,
  publicUser,
  requireUser,
  setPlan
} from '../../../../src/lib/auth.js'
import { pipeline, redisEnabled } from '../../../../src/lib/redis.js'
import { PLAN_IDS } from '../../../../src/config/plans.js'

export const dynamic = 'force-dynamic'

const json = (data, status = 200) => Response.json(data, { status })
const fail = (error, status = 400) => json({ status: false, error }, status)

async function requireAdmin(request) {
  const user = await requireUser(request)
  if (!user) return { error: fail('Belum login.', 401) }
  if (!isAdminEmail(user.email)) return { error: fail('Khusus admin.', 403) }
  return { user }
}

export async function GET(request) {
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const [emails] = await pipeline([['SMEMBERS', 'users']])
    const list = (emails || []).slice(0, 500)
    if (!list.length) return json({ status: true, users: [] })

    const rows = await pipeline(list.map(e => ['GET', `user:${e}`]))
    const parsed = rows.filter(Boolean).map(raw => JSON.parse(raw))
    const usageRows = await pipeline(parsed.map(u => ['GET', usageKeyFor(u.email)]))

    const users = parsed.map((u, i) => {
      const pub = publicUser(u, Number(usageRows[i] || 0))
      delete pub.apiKey
      return pub
    })
    users.sort((a, b) => b.createdAt - a.createdAt)

    return json({ status: true, users })
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}

export async function POST(request) {
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  const type = request.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    return fail('Content-Type harus application/json', 415)
  }

  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const plan = String(body.plan || '')
    const days = Number(body.days || 0)

    if (!PLAN_IDS.includes(plan)) return fail('Plan tidak valid.')
    if (!Number.isFinite(days) || days < 0 || days > 3650) return fail('Jumlah hari tidak valid.')

    const target = await getUser(email)
    if (!target) return fail('User tidak ditemukan.', 404)

    const updated = await setPlan(email, plan, days)
    const pub = publicUser(updated, await getUsage(email))
    delete pub.apiKey
    return json({ status: true, user: pub })
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}
