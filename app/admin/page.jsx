'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { plans } from '../../src/config/plans.js'

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.1rem',
  boxShadow: 'var(--shadow-sm)'
}

const field = {
  padding: '0.55rem 0.7rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontSize: '0.95rem'
}

const fmtDate = ms => new Date(ms).toLocaleDateString('id-ID', { dateStyle: 'medium' })

function UserRow({ u, onSave }) {
  const [plan, setPlan] = useState(u.plan)
  const [days, setDays] = useState(plans[u.plan]?.days || 30)
  const [saving, setSaving] = useState(false)

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
        {u.email}{u.isAdmin ? ' (admin)' : ''}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0.75rem' }}>
        {u.planName}
        {u.plan !== 'free' && (u.planExpires ? ` sampai ${fmtDate(u.planExpires)}` : ' permanen')}
        {' • '}hari ini {u.usage.used}/{u.usage.limit}
        {' • '}daftar {fmtDate(u.createdAt)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={field} value={plan} onChange={e => { setPlan(e.target.value); setDays(plans[e.target.value].days || 0) }}>
          {Object.values(plans).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {plan !== 'free' && (
          <>
            <input style={{ ...field, width: '90px' }} type="number" min="0" value={days} onChange={e => setDays(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>hari (0 = permanen)</span>
          </>
        )}
        <button
          className="btn-secondary"
          style={{ cursor: 'pointer' }}
          disabled={saving}
          onClick={async () => { setSaving(true); await onSave(u.email, plan, Number(days)); setSaving(false) }}
        >
          Simpan
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.status === 401) return router.replace('/login')
    if (res.status === 403) return router.replace('/dashboard')
    const data = await res.json()
    if (data.status) setUsers(data.users)
    else setMsg(data.error || 'Gagal memuat data.')
  }, [router])

  useEffect(() => { load().catch(() => setMsg('Tidak bisa terhubung ke server.')) }, [load])

  const save = async (email, plan, days) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan, days })
    })
    const data = await res.json()
    if (data.status) {
      setUsers(list => list.map(u => (u.email === email ? data.user : u)))
      setMsg(`Plan ${email} diubah ke ${data.user.planName}.`)
    } else {
      setMsg(data.error || 'Gagal menyimpan.')
    }
  }

  const filtered = (users || []).filter(u => u.email.includes(q.trim().toLowerCase()))

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="container" style={{ marginTop: '2.5rem', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Admin</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {users ? `${users.length} user terdaftar` : 'Memuat...'}
        </p>

        <input
          style={{ ...field, width: '100%', boxSizing: 'border-box', marginBottom: '1rem' }}
          placeholder="Cari email..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        {msg && (
          <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filtered.map(u => <UserRow key={u.email + u.plan + u.planExpires} u={u} onSave={save} />)}
        </div>
      </main>
      <Footer />
    </div>
  )
}
