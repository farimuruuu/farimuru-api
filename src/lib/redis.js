// Klien Upstash Redis via REST (tanpa dependency tambahan)
const getEnv = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
})

export const redisEnabled = () => {
  const { url, token } = getEnv()
  return Boolean(url && token)
}

// commands: [['GET','key'], ['SET','key','value'], ...]
export async function pipeline(commands) {
  const { url, token } = getEnv()
  if (!url || !token) throw new Error('Database belum dikonfigurasi')

  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands),
    cache: 'no-store'
  })

  if (!res.ok) throw new Error('Database error')

  const data = await res.json()
  return data.map(item => {
    if (item.error) throw new Error('Database error')
    return item.result
  })
}
