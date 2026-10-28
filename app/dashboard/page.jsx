'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { plans } from '../../src/config/plans.js'

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  boxShadow: 'var(--shadow-sm)'
}

const h2 = { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.9rem' }

const fmtDate = ms => new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.status === 401) return router.replace('/login')
      const data = await res.json()
      if (data.status) setUser(data.user)
      else setMsg(data.error || 'Gagal memuat data.')
    } catch {
      setMsg('Tidak bisa terhubung ke server.')
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const post = async path => {
    setBusy(true)
    try {
      const res = await fetch(`/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
      return await res.json()
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await post('logout')
    router.replace('/login')
  }

  const regenerate = async () => {
    if (!confirm('Buat API key baru? Key lama langsung tidak berlaku.')) return
    const data = await post('regenerate-key')
    if (data.status) {
      setUser(data.user)
      setMsg('API key baru berhasil dibuat.')
    } else {
      setMsg(data.error || 'Gagal membuat key baru.')
    }
  }

  const copy = async text => {
    try {
      await navigator.clipboard.writeText(text)
      setMsg('Tersalin.')
    } catch {
      setMsg('Gagal menyalin, salin manual.')
    }
  }

  if (!user) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="container" style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {msg || 'Memuat...'}
        </main>
      </div>
    )
  }

  const { used, limit, resetAt } = user.usage
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const example = `${origin}/api/stats?apikey=${user.apiKey}`
  const maskedKey = user.apiKey.slice(0, 7) + '•'.repeat(20)

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="container" style={{ marginTop: '2.5rem', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Halo{user.name ? `, ${user.name}` : ''} 👋
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', wordBreak: 'break-all' }}>{user.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/jadibot" className="btn-secondary">Jadibot</Link>
            {user.isAdmin && <Link href="/admin" className="btn-secondary">Admin</Link>}
            <button onClick={logout} className="btn-secondary" style={{ cursor: 'pointer' }}>Keluar</button>
          </div>
        </div>

        {msg && (
          <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <section style={card}>
            <h2 style={h2}>Plan aktif</h2>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{user.planName}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {user.plan === 'free'
                ? 'Tanpa masa berlaku'
                : user.planExpires
                  ? `Berlaku sampai ${fmtDate(user.planExpires)}`
                  : 'Permanen'}
            </div>
          </section>

          <section style={card}>
            <h2 style={h2}>Pemakaian hari ini</h2>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {used.toLocaleString('id-ID')} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {limit.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--surface-hover)', margin: '0.6rem 0', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? '#dc2626' : 'var(--primary)' }} />
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Reset {fmtDate(resetAt)} (00:00 WIB)</div>
          </section>
        </div>

        <section style={{ ...card, marginTop: '1rem' }}>
          <h2 style={h2}>API key</h2>
          <code style={{ display: 'block', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border-color)', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
            {show ? user.apiKey : maskedKey}
          </code>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button onClick={() => setShow(v => !v)} className="btn-secondary" style={{ cursor: 'pointer' }}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
            <button onClick={() => copy(user.apiKey)} className="btn-secondary" style={{ cursor: 'pointer' }}>Salin</button>
            <button onClick={regenerate} disabled={busy} className="btn-secondary" style={{ cursor: 'pointer' }}>Buat ulang</button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '1rem 0 0.4rem' }}>Contoh pemakaian:</p>
          <code style={{ display: 'block', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border-color)', wordBreak: 'break-all', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            {show ? example : `${origin}/api/stats?apikey=${maskedKey}`}
          </code>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>Jangan bagikan key ini ke siapa pun. Siapa pun yang memilikinya memakai limit kamu.</p>
        </section>

        <section style={{ ...card, marginTop: '1rem' }}>
          <h2 style={h2}>Daftar plan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {Object.values(plans).map(p => (
              <div key={p.id} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: `2px solid ${p.id === user.plan ? 'var(--primary)' : 'var(--border-color)'}` }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0' }}>{p.dailyLimit.toLocaleString('id-ID')} request/hari</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0' }}>{p.jadibotSlots} slot jadibot</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {p.price === 0 ? 'Gratis' : `Rp ${p.price.toLocaleString('id-ID')} / ${p.days} hari`}
                </div>
                {p.id === user.plan && <div style={{ marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>Plan kamu</div>}
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.9rem' }}>
            Upgrade otomatis lewat pembayaran segera hadir. Untuk saat ini hubungi admin untuk mengaktifkan Premium atau VIP.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
