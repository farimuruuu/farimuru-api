'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

const box = {
  background: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.75rem',
  boxShadow: 'var(--shadow-md)'
}

const input = {
  width: '100%',
  padding: '0.75rem 0.9rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  boxSizing: 'border-box'
}

const label = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.35rem'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) router.replace('/dashboard')
      })
      .catch(() => {})
  }, [router])

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan.')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Tidak bisa terhubung ke server.')
    }
    setLoading(false)
  }

  const isLogin = mode === 'login'

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="container" style={{ marginTop: '2.5rem', marginBottom: '4rem' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, textAlign: 'center', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {isLogin ? 'Masuk' : 'Daftar'}
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {isLogin ? 'Masuk untuk melihat API key dan limit kamu.' : 'Buat akun gratis dan dapatkan API key pribadi.'}
          </p>

          <form onSubmit={submit} style={box}>
            {!isLogin && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>Nama (opsional)</label>
                <input style={input} value={name} onChange={e => setName(e.target.value)} maxLength={50} autoComplete="name" />
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={label}>Email</label>
              <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={label}>Password</label>
              <input
                style={input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              {!isLogin && (
                <small style={{ color: 'var(--text-muted)' }}>Minimal 8 karakter.</small>
              )}
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: '#fef2f2', color: '#b91c1c', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', cursor: 'pointer', justifyContent: 'center' }}>
              {loading ? 'Memproses...' : isLogin ? 'Masuk' : 'Buat Akun'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
            >
              {isLogin ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
