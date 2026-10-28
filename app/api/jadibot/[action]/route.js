import { effectivePlanId, hit, requireUser } from '../../../../src/lib/auth.js'
import { pipeline, redisEnabled } from '../../../../src/lib/redis.js'
import { plans } from '../../../../src/config/plans.js'

export const dynamic = 'force-dynamic'

const json = (data, status = 200) => Response.json(data, { status })
const fail = (error, status = 400) => json({ status: false, error }, status)

// Nomor: hanya angka, awalan 0 atau 8 diubah ke 62
function normalizeNumber(input) {
  let n = String(input || '').replace(/\D/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  return /^\d{8,15}$/.test(n) ? n : null
}

async function bot(path, method = 'GET', body) {
  const base = (process.env.JADIBOT_URL || '').replace(/\/$/, '')
  const token = process.env.JADIBOT_TOKEN
  if (!base || !token) throw new Error('Server jadibot belum dikonfigurasi.')

  let res
  try {
    res = await fetch(base + path, {
      method,
      headers: { 'x-internal-token': token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
      cache: 'no-store'
    })
  } catch {
    throw new Error('Server jadibot tidak terjangkau.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status === false) throw new Error(data.error || 'Server jadibot error.')
  return data
}

async function getList(email) {
  const [raw] = await pipeline([['GET', `jadibot:${email}`]])
  return raw ? JSON.parse(raw) : []
}

const saveList = (email, list) => pipeline([['SET', `jadibot:${email}`, JSON.stringify(list)]])

const slotsOf = user => plans[effectivePlanId(user)].jadibotSlots || 0

export async function GET(request, { params }) {
  const { action } = await params
  if (action !== 'status') return fail('Not found', 404)
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  try {
    const user = await requireUser(request)
    if (!user) return fail('Belum login.', 401)

    const list = await getList(user.email)
    const numbers = await Promise.all(
      list.map(async number => {
        try {
          const s = await bot(`/status/${number}`)
          return { number, state: s.state, code: s.code }
        } catch {
          return { number, state: 'offline', code: null }
        }
      })
    )

    return json({ status: true, slots: slotsOf(user), numbers })
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}

export async function POST(request, { params }) {
  const { action } = await params
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  const type = request.headers.get('content-type') || ''
  if (!type.includes('application/json')) return fail('Content-Type harus application/json', 415)

  try {
    const user = await requireUser(request)
    if (!user) return fail('Belum login.', 401)

    const body = await request.json().catch(() => ({}))
    const number = normalizeNumber(body.number)
    if (!number) return fail('Nomor tidak valid. Contoh: 628123456789')

    const list = await getList(user.email)

    if (action === 'pair') {
      if (body.consent !== true) return fail('Kamu harus menyetujui syarat jadibot.')
      if ((await hit(`jb:${user.email}`, 3600)) > 5) {
        return fail('Terlalu banyak percobaan. Coba lagi dalam 1 jam.', 429)
      }

      const isNew = !list.includes(number)
      if (isNew && list.length >= slotsOf(user)) {
        return fail(`Slot jadibot plan kamu penuh (${slotsOf(user)}). Hapus nomor lain atau upgrade plan.`, 403)
      }

      // Satu nomor hanya boleh dimiliki satu akun
      let claimed = false
      if (isNew) {
        const [ok] = await pipeline([['SET', `jadibot:owner:${number}`, user.email, 'NX']])
        if (!ok) return fail('Nomor ini sudah dipakai akun lain.', 409)
        claimed = true
      }

      try {
        const data = await bot('/pair', 'POST', { number })
        if (isNew) await saveList(user.email, [...list, number])
        return json({ status: true, number, state: data.state, code: data.code })
      } catch (err) {
        if (claimed) await pipeline([['DEL', `jadibot:owner:${number}`]])
        return fail(err.message, 502)
      }
    }

    if (action === 'stop') {
      if (!list.includes(number)) return fail('Nomor tidak ditemukan di akunmu.', 404)
      await bot(`/stop/${number}`, 'POST')
      await saveList(user.email, list.filter(n => n !== number))
      await pipeline([['DEL', `jadibot:owner:${number}`]])
      return json({ status: true })
    }

    return fail('Not found', 404)
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}
