import { createRoute, z } from '@hono/zod-openapi'
import type { Context } from 'hono'

const DEFAULT_CSRF = 'e1NYV63RYGY6pQSGZnP1Zw'

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function retry<T>(fn: () => Promise<T | null>, times = 2, delay = 1000): Promise<T | null> {
    for (let i = 0; i < times; i++) {
        const result = await fn()
        if (result) return result
        if (i < times - 1) await sleep(delay)
    }
    return null
}

function getShortCode(url = ''): string | null {
    const match = String(url).match(
        /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i
    )
    return match?.[1] || null
}

const buildPayload = (shortCode: string): Record<string, string> => ({
    av: '0',
    __d: 'www',
    __user: '0',
    __a: '1',
    __req: 'n',
    __hs: '20471.HYP:instagram_web_pkg.2.1...0',
    dpr: '1',
    __ccg: 'GOOD',
    __rev: '1032146888',
    __s: 'm781fo:q1g6jc:wljqxm',
    __hsi: '7596719669701258968',
    __dyn:
        '7xeUjG1mxu1syUbFp41twpUnwgU7SbzEdF8aUco2qwJw5ux609vCwjE1EE2Cw8G11wBz81s8hwGxu786a3a1YwBgao6C0Mo2swlo8od8-U2zxe2GewGw9a361qw8Xxm16wUwtE1wEbUGdwtUd-2u2J0bS1LwTwKG1pg2fwxyo6O1FwlA3a3zhA6bwg8rAwCAxW1oxe6UaUaE4e1tyVrx60gm5o4q3a18wqU4O',
    __csr:
        'hs9hI5Y5jNkR8P48TP9h5cSWmhuJmpdmGimyJQFJanh4QZft8OOtqzdat7hHypQFpuWFGGJybleVKFEC4UHKh1ufVEmGA9yU9QVBGXgOLzqBBQ9AyGyoym8gwEgGh2EiU-_HGq6HQ8KExqydoCmWy8hQQ_ACGayXUWubzpoOQ6Uizry8rVpQ4p8K5oc88U01qc82owWwSGi0qObEU1qU0k-Axu64jlw9a2y2y1t807083bw3zEjwfi0F20WwbDg19V9Ngbo4G2K11oa2www8Vw5WwyyYU52080c3hwk4bL80cMK0BU7O4hxMK023C03f203Oe02om0s6E0Dm0li',
    __hsdp:
        'gv41M1iRdOO8Qn924YBtNi6NEReGkxeWKHophUOKJ3paAejwkShh0pwn8K1iwEwwgy2N3ECFKswb9U9mu2Sbx2iU5BAgO7oaUiwkjAgaUeUlwHgS1mxTwmpAcyF9e1VwnorBwJV-482mBwBy83ew12-2e0BU3Iw6Mw4CyE4i0yEyUG0oy0Po23w25U2Vxq3e0km1gx-13hUx4wlE',
    __hblp:
        '0du2a1HzVE4a4U2jyo5abw9O9xGaBxa4m8wSxWaxC6onxaUTgpwWxqqbCKeBxaawvEycwBxm5E-h2-1SDwwG2Spy-8AAQ1Uxu15xa8BwJVBx21cyU9EmBz8oy82fxW7U2GwgU0x23O0YE8U7ebxu2m3G0yU1I83TwKyEC2a5VU66228w6nwcS0wU0xiEgwpE465EcU30woU88mAwPgvCy8aEx7y4Qbxq488E3Uw',
    __sjsp:
        'gv41M1iRdOO8Qn924YyZNisj6zpWkxHGaophUOKEgAwrQ2a1syU5a2y223p0n9U9mu1fw2fotw8m',
    __comet_req: '7',
    lsd: 'AdGAKFtJcSM',
    jazoest: '2895',
    __spin_r: '1032146888',
    __spin_b: 'trunk',
    __spin_t: '1768749130',
    __crn: 'comet.igweb.PolarisLoggedOutDesktopPermalinkPostRoutePerfOptimized',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'PolarisPostRootQuery',
    server_timestamps: 'true',
    variables: JSON.stringify({ shortcode: shortCode }),
    doc_id: '33984154184516575'
})

async function fromGraphql(shortCode: string): Promise<any | null> {
    const proxy = process.env.IG_PROXY || ''
    const csrf = process.env.IG_CSRF || DEFAULT_CSRF
    const session = process.env.IG_SESSION
        ? String(process.env.IG_SESSION).replace(/:/g, '%3A')
        : ''

    const headers: Record<string, string> = {
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-origin',
        'x-csrftoken': csrf,
        'User-Agent': UA,
        Referer: `https://www.instagram.com/p/${shortCode}/`,
        Origin: 'https://www.instagram.com',
        Accept: '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    if (session) {
        headers.Cookie = `sessionid=${session}; csrftoken=${csrf}`
    }

    return retry(async () => {
        try {
            const res = await fetch(`${proxy}https://www.instagram.com/graphql/query`, {
                method: 'POST',
                headers,
                body: new URLSearchParams(buildPayload(shortCode))
            })
            if (!res.ok) return null
            const json: any = await res.json()
            return json?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] || null
        } catch {
            return null
        }
    })
}

async function igdl(shortCode: string) {
    const d = await fromGraphql(shortCode)
    if (!d) {
        throw new Error('Gagal mengambil data Instagram (post private, link salah, atau diblokir).')
    }

    const media: { type: 'video' | 'image'; url: string }[] = []

    const pushItem = (item: any) => {
        const video = item.video_versions?.[0]
        const image = item.image_versions2?.candidates?.[0]
        if (video?.url) media.push({ type: 'video', url: video.url })
        else if (image?.url) media.push({ type: 'image', url: image.url })
    }

    if (d.product_type === 'carousel_container') {
        d.carousel_media?.forEach(pushItem)
    } else {
        pushItem(d)
    }

    return {
        status: true,
        type: d.product_type || 'unknown',
        thumbnail: d.display_uri || '',
        user: {
            username: d.user?.username || '-',
            fullname: d.user?.full_name || '',
            url: `https://www.instagram.com/${d.user?.username || ''}`
        },
        post: {
            caption: d.caption?.text || '',
            likeCount: d.like_count ?? 0,
            commentCount: d.comment_count ?? 0
        },
        total: media.length,
        media
    }
}

export const instagramRoute = createRoute({
    method: 'get',
    path: '/api/downloader/instagram',
    summary: 'Instagram Downloader',
    description: 'Download foto, video, reels, atau carousel Instagram dari URL postingan publik.',
    tags: ['Downloader'],
    'x-status': 'ONLINE',
    request: {
        query: z.object({
            url: z.string().openapi({
                example: 'https://www.instagram.com/reel/xxxx/',
                description: 'Instagram post / reel URL'
            }),
            apikey: z.string().openapi({
                example: 'farimuru',
                description: 'Valid API Key'
            })
        })
    },
    responses: {
        200: {
            description: 'Metadata dan link media Instagram',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean().openapi({ example: true }),
                        type: z.string(),
                        thumbnail: z.string(),
                        user: z.object({
                            username: z.string(),
                            fullname: z.string(),
                            url: z.string()
                        }),
                        post: z.object({
                            caption: z.string(),
                            likeCount: z.number(),
                            commentCount: z.number()
                        }),
                        total: z.number(),
                        media: z.array(z.object({
                            type: z.string().openapi({ example: 'video' }),
                            url: z.string()
                        }))
                    })
                }
            }
        },
        400: { description: 'URL tidak valid' },
        500: { description: 'Gagal mengambil media' }
    }
})

export const instagramHandler = async (c: Context) => {
    const url = c.req.query('url')?.trim()
    if (!url) {
        return c.json({ status: false, error: 'Parameter url wajib diisi.' }, 400)
    }

    const shortCode = getShortCode(url)
    if (!shortCode) {
        return c.json({ status: false, error: 'Link Instagram tidak valid.' }, 400)
    }

    try {
        const data = await igdl(shortCode)
        if (!data.media.length) {
            return c.json({ status: false, error: 'Media Instagram tidak ditemukan.' }, 500)
        }
        return c.json(data, 200)
    } catch (err: any) {
        return c.json({ status: false, error: err.message || 'Internal Server Error' }, 500)
    }
}
