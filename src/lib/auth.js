import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { pipeline, redisEnabled } from './redis.js'
import { plans } from '../config/plans.js'
import settings from '../config/setting.js'

const scrypt = promisify(crypto.scrypt)

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const WIB = 7 * HOUR
const SESSION_TTL = 30 * DAY

export const COOKIE = 'fm_session'

// ---------- util ----------
export const normEmail = e => String(e || '').trim().toLowerCase()

export const isAdminEmail = email =>
  Boolean(process.env.ADMIN_EMAIL) && normEmail(process.env.ADMIN_EMAIL) === email

export const getIp = request =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'

export const usageKeyFor = email => `usage:${email}:${todayKey()}`
const todayKey = () => new Date(Date.now() + WIB).toISOString().slice(0, 10)
const resetAt = () => (Math.floor((Date.now() + WIB) / DAY) + 1) * DAY - WIB

// ---------- password ----------
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const buf = await scrypt(password, salt, 64)
  return `${salt}:${buf.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const buf = await scrypt(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === buf.length && crypto.timingSafeEqual(expected, buf)
}

// ---------- session (cookie bertanda tangan HMAC) ----------
const secret = () => {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET belum diatur (minimal 16 karakter)')
  return s
}

const sign = payload =>
  crypto.createHmac('sha256', secret()).update(payload).digest('base64url')

export function createSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Date.now() + SESSION_TTL })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readSession(token) {
  if (!token) return null
  const [payload, sig] = String(token).split('.')
  if (!payload || !sig) return null

  const a = Buffer.from(sig)
  const b = Buffer.from(sign(payload))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data.e || data.x < Date.now()) return null
    return data.e
  } catch {
    return null
  }
}

export const sessionCookie = token =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`

export const clearCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

// ---------- plan ----------
export function effectivePlanId(rec) {
  const id = rec?.plan in plans ? rec.plan : 'free'
  if (id !== 'free' && rec.planExpires && Date.now() > rec.planExpires) return 'free'
  return id
}

const keyRecord = user => ({
  email: user.email,
  plan: user.plan,
  planExpires: user.planExpires
})

const newApiKey = () => 'fm_' + crypto.randomBytes(18).toString('hex')

// ---------- user ----------
export async function getUser(email) {
  const [raw] = await pipeline([['GET', `user:${email}`]])
  return raw ? JSON.parse(raw) : null
}

export async function createUser({ email, password, name }) {
  const user = {
    email,
    name: name || '',
    passHash: await hashPassword(password),
    plan: 'free',
    planExpires: null,
    apiKey: newApiKey(),
    createdAt: Date.now()
  }

  const [ok] = await pipeline([['SET', `user:${email}`, JSON.stringify(user), 'NX']])
  if (!ok) return null

  await pipeline([
    ['SET', `apikey:${user.apiKey}`, JSON.stringify(keyRecord(user))],
    ['SADD', 'users', email]
  ])
  return user
}

export async function regenerateKey(user) {
  const oldKey = user.apiKey
  user.apiKey = newApiKey()
  await pipeline([
    ['DEL', `apikey:${oldKey}`],
    ['SET', `apikey:${user.apiKey}`, JSON.stringify(keyRecord(user))],
    ['SET', `user:${user.email}`, JSON.stringify(user)]
  ])
  return user
}

export async function setPlan(email, planId, days) {
  const user = await getUser(email)
  if (!user) return null

  user.plan = planId
  user.planExpires =
    planId === 'free' || !days || days <= 0 ? null : Date.now() + days * DAY

  await pipeline([
    ['SET', `user:${email}`, JSON.stringify(user)],
    ['SET', `apikey:${user.apiKey}`, JSON.stringify(keyRecord(user))]
  ])
  return user
}

export async function getUsage(email) {
  const [used] = await pipeline([['GET', `usage:${email}:${todayKey()}`]])
  return Number(used || 0)
}

export function publicUser(user, used = 0) {
  const planId = effectivePlanId(user)
  const limit = plans[planId].dailyLimit
  return {
    email: user.email,
    name: user.name,
    plan: planId,
    planName: plans[planId].name,
    planExpires: user.planExpires,
    apiKey: user.apiKey,
    isAdmin: isAdminEmail(user.email),
    createdAt: user.createdAt,
    usage: { used: Math.min(used, limit), limit, resetAt: resetAt() }
  }
}

export async function requireUser(request) {
  const email = readSession(getCookie(request, COOKIE))
  if (!email) return null
  return await getUser(email)
}

// ---------- throttle sederhana ----------
export async function hit(key, windowSec) {
  const [n] = await pipeline([
    ['INCR', key],
    ['EXPIRE', key, windowSec]
  ])
  return Number(n)
}

// ---------- cek API key (dipakai middleware) ----------
const cache = new Map()
const CACHE_MS = 20 * 1000

export async function checkApiKey(key) {
  // Key lama dari settings tetap valid (tanpa limit)
  if (Array.isArray(settings.validApiKeys) && settings.validApiKeys.includes(key)) {
    return { ok: true, legacy: true }
  }

  if (!redisEnabled()) return { ok: false, status: 403 }

  let rec
  const cached = cache.get(key)
  if (cached && cached.exp > Date.now()) {
    rec = cached.rec
  } else {
    const [raw] = await pipeline([['GET', `apikey:${key}`]])
    if (!raw) return { ok: false, status: 403 }
    rec = JSON.parse(raw)
    if (cache.size > 500) cache.clear()
    cache.set(key, { rec, exp: Date.now() + CACHE_MS })
  }

  const plan = plans[effectivePlanId(rec)]
  const usageKey = `usage:${rec.email}:${todayKey()}`
  const [used] = await pipeline([
    ['INCR', usageKey],
    ['EXPIRE', usageKey, 2 * 24 * 3600]
  ])
  const count = Number(used)

  return {
    ok: count <= plan.dailyLimit,
    status: 429,
    plan: plan.id,
    planName: plan.name,
    limit: plan.dailyLimit,
    used: Math.min(count, plan.dailyLimit),
    remaining: Math.max(0, plan.dailyLimit - count),
    resetAt: resetAt()
  }
}
