'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  boxShadow: 'var(--shadow-sm)'
}

const field = {
  width: '100%',
  padding: '0.75rem 0.9rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  boxSizing: 'border-box'
}

const STATE = {
  pairing: 'Menunggu kode dimasukkan',
  connecting: 'Menyambung...',
  open: 'Terhubung',
  expired: 'Kode kedaluwarsa, buat ulang',
  logged_out: 'Terputus dari WhatsApp',
  offline: 'Server bot tidak terjangkau',
  none: 'Tidak aktif'
}

export default function JadibotPage() {
  const router = useRouter()
  const [info, setInfo] = useState(null)
  const [number, setNumber] = useState('')
  const [consent, setConsent] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jadibot/status')
      if (res.status === 401) return router.replace('/login')
      const data = await res.json()
      if (data.status) setInfo(data)
      else setMsg(data.error || 'Gagal memuat data.')
    } catch {
      setMsg('Tidak bisa terhubung ke server.')
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // Perbarui status otomatis selama ada nomor yang belum selesai tersambung
  useEffect(() => {
    const waiting = info?.numbers?.some(n => n.state === 'pairing' || n.state === 'connecting')
    if (!waiting) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [info, load])

  const call = async (action, payload) => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch(`/api/jadibot/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) setMsg(data.error || 'Terjadi kesalahan.')
      return data
    } catch {
      setMsg('Tidak bisa terhubung ke server.')
      return {}
    } finally {
      setBusy(false)
    }
  }

  const pair = async e => {
    e.preventDefault()
    const data = await call('pair', { number, consent })
    if (data.status) {
      setNumber('')
      if (data.state === 'open') setMsg('Nomor ini sudah terhubung.')
      load()
    }
  }

  const stop = async n => {
    if (!confirm(`Hapus jadibot ${n}? Perangkat tertaut di WhatsApp akan diputus.`)) return
    const data = await call('stop', { number: n })
    if (data.status) load()
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="container" style={{ marginTop: '2.5rem', marginBottom: '4rem' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Jadibot</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Jadikan nomor WhatsApp kamu sebagai bot.{' '}
            <Link href="/dashboard" style={{ color: 'var(--primary)', fontWeight: 700 }}>Kembali ke dashboard</Link>
          </p>

          {msg && (
            <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {msg}
            </div>
          )}

          <form onSubmit={pair} style={card}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Nomor WhatsApp
            </label>
            <input style={field} inputMode="numeric" placeholder="628123456789" value={number} onChange={e => setNumber(e.target.value)} required />
            <small style={{ color: 'var(--text-muted)' }}>
              Slot terpakai: {info ? `${info.numbers.length} / ${info.slots}` : '-'}
            </small>

            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', margin: '1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: '0.2rem' }} />
              <span>
                Saya paham nomor ini akan tertaut sebagai perangkat ke server bot, server dapat membaca pesan yang masuk ke nomor ini selama terhubung, dan memakai bot tidak resmi berisiko membuat nomor diblokir WhatsApp. Saya bisa menghapus jadibot kapan saja.
              </span>
            </label>

            <button type="submit" disabled={busy || !consent} className="btn-primary" style={{ width: '100%', cursor: 'pointer', justifyContent: 'center', opacity: consent ? 1 : 0.6 }}>
              {busy ? 'Memproses...' : 'Dapatkan Kode Pairing'}
            </button>
          </form>

          {info?.numbers?.map(n => (
            <section key={n.number} style={{ ...card, marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>+{n.number}</div>
                  <div style={{ fontSize: '0.85rem', color: n.state === 'open' ? '#16a34a' : 'var(--text-secondary)' }}>
                    {STATE[n.state] || n.state}
                  </div>
                </div>
                <button onClick={() => stop(n.number)} disabled={busy} className="btn-secondary" style={{ cursor: 'pointer' }}>Hapus</button>
              </div>

              {n.state === 'pairing' && n.code && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--primary)' }}>{n.code}</div>
                  <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.9rem', paddingLeft: '1.2rem', marginTop: '0.75rem' }}>
                    <li>Buka WhatsApp di nomor ini.</li>
                    <li>Menu titik tiga → Perangkat tertaut → Tautkan perangkat.</li>
                    <li>Pilih "Tautkan dengan nomor telepon saja".</li>
                    <li>Masukkan kode di atas dengan cepat sebelum kedaluwarsa.</li>
                  </ol>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
