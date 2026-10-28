import type { Context, Next } from 'hono'
import { checkApiKey } from '../lib/auth.js'

export const apiKeyAuth = async (c: Context, next: Next) => {
    // Lewati cek apikey untuk endpoint OpenAPI spec atau dokumentasi
    const path = c.req.path
    if (path === '/openapi.json' || path.startsWith('/docs')) {
        return await next()
    }

    const apiKey = c.req.query('apikey') || c.req.header('x-api-key')

    if (!apiKey) {
        return c.json({
            status: false,
            error: 'Unauthorized',
            message: 'API Key is missing. Please provide apikey query parameter. Daftar dan ambil key kamu di /login.'
        }, 401)
    }

    let result: any
    try {
        result = await checkApiKey(apiKey)
    } catch (err) {
        return c.json({
            status: false,
            error: 'Service Unavailable',
            message: 'Layanan autentikasi sedang bermasalah. Coba lagi nanti.'
        }, 503)
    }

    if (!result.ok) {
        if (result.status === 429) {
            return c.json({
                status: false,
                error: 'Too Many Requests',
                message: `Limit harian plan ${result.planName} (${result.limit} request/hari) sudah habis. Reset pukul 00:00 WIB atau upgrade plan.`,
                plan: result.plan,
                limit: result.limit,
                used: result.used,
                resetAt: result.resetAt
            }, 429)
        }
        return c.json({
            status: false,
            error: 'Forbidden',
            message: 'Invalid API Key provided.'
        }, 403)
    }

    if (!result.legacy) {
        c.header('X-Plan', result.plan)
        c.header('X-RateLimit-Limit', String(result.limit))
        c.header('X-RateLimit-Remaining', String(result.remaining))
    }

    await next()
}
