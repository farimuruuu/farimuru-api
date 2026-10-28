import {
  COOKIE,
  clearCookie,
  createSession,
  createUser,
  getCookie,
  getIp,
  getUsage,
  getUser,
  hit,
  normEmail,
  publicUser,
  readSession,
  regenerateKey,
  sessionCookie,
  verifyPassword
} from '../../../../src/lib/auth.js'
import { pipeline, redisEnabled } from '../../../../src/lib/redis.js'

export const dynamic = 'force-dynamic'

const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers })

const fail = (error, status = 400) => json({ status: false, error }, status)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function currentUser(request) {
  const email = readSession(getCookie(request, COOKIE))
  if (!email) return null
  return await getUser(email)
}

export async function GET(request, { params }) {
  const { action } = await params
  if (action !== 'me') return fail('Not found', 404)
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  try {
    const user = await currentUser(request)
    if (!user) return fail('Belum login.', 401)
    const used = await getUsage(user.email)
    return json({ status: true, user: publicUser(user, used) })
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}

export async function POST(request, { params }) {
  const { action } = await params
  if (!redisEnabled()) return fail('Database belum dikonfigurasi.', 503)

  const type = request.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    return fail('Content-Type harus application/json', 415)
  }

  try {
    const body = await request.json().catch(() => ({}))

    if (action === 'register') {
      if ((await hit(`reg:${getIp(request)}`, 86400)) > 5) {
        return fail('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi besok.', 429)
      }

      const email = normEmail(body.email)
      const password = String(body.password || '')
      const name = String(body.name || '').trim().slice(0, 50)

      if (!EMAIL_RE.test(email) || email.length > 254) return fail('Email tidak valid.')
      if (password.length < 8 || password.length > 128) {
        return fail('Password harus 8 sampai 128 karakter.')
      }

      const user = await createUser({ email, password, name })
      if (!user) return fail('Email sudah terdaftar.', 409)

      return json(
        { status: true, user: publicUser(user, 0) },
        201,
        { 'Set-Cookie': sessionCookie(createSession(email)) }
      )
    }

    if (action === 'login') {
      const email = normEmail(body.email)
      const password = String(body.password || '')
      const failKey = `lf:${email}`

      const [fails] = await pipeline([['GET', failKey]])
      if (Number(fails || 0) >= 10) {
        return fail('Terlalu banyak percobaan login. Coba lagi dalam 15 menit.', 429)
      }

      const user = EMAIL_RE.test(email) ? await getUser(email) : null
      const valid = user && (await verifyPassword(password, user.passHash))

      if (!valid) {
        await hit(failKey, 900)
        return fail('Email atau password salah.', 401)
      }

      await pipeline([['DEL', failKey]])
      const used = await getUsage(email)
      return json(
        { status: true, user: publicUser(user, used) },
        200,
        { 'Set-Cookie': sessionCookie(createSession(email)) }
      )
    }

    if (action === 'logout') {
      return json({ status: true }, 200, { 'Set-Cookie': clearCookie() })
    }

    if (action === 'regenerate-key') {
      const user = await currentUser(request)
      if (!user) return fail('Belum login.', 401)
      const updated = await regenerateKey(user)
      const used = await getUsage(updated.email)
      return json({ status: true, user: publicUser(updated, used) })
    }

    return fail('Not found', 404)
  } catch (err) {
    return fail(err.message || 'Server error', 500)
  }
}
