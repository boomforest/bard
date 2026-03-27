import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'

const ADMIN_EMAIL = 'jproney@gmail.com'

function LoginGate({ onLogin }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    setSending(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: { emailRedirectTo: window.location.href },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setSending(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5dc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2.5rem',
        maxWidth: '360px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        <div style={{ color: '#d2691e', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
          Nonlinear Admin
        </div>
        <div style={{ color: '#8b4513', fontSize: '0.9rem', marginBottom: '2rem' }}>
          April 11, 2026
        </div>
        {sent ? (
          <div style={{ color: '#4caf50', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Magic link sent to<br />
            <strong>{ADMIN_EMAIL}</strong><br /><br />
            Check your email and click the link to log in.
          </div>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Send a magic link to <strong>{ADMIN_EMAIL}</strong>
            </p>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: sending ? '#ccc' : 'linear-gradient(45deg, #d2691e, #cd853f)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                fontSize: '1rem',
              }}
            >
              {sending ? 'Sending...' : 'Send Magic Link'}
            </button>
            {error && (
              <div style={{ color: '#cc2200', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [tickets, setTickets] = useState([])
  const [followers, setFollowers] = useState([])
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) fetchData()
  }, [session])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: ticketData }, { data: followerData }, { data: eventData }] = await Promise.all([
      supabase.from('tickets').select('*').order('ticket_number', { ascending: true }),
      supabase.from('followers').select('*').eq('artist_id', 'nonlinear').order('created_at', { ascending: true }),
      supabase.from('events').select('*').eq('artist_name', 'Nonlinear').single(),
    ])
    setTickets(ticketData || [])
    setFollowers(followerData || [])
    setEvent(eventData || null)
    setLoading(false)
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg(`${label} copied!`)
      setTimeout(() => setCopyMsg(''), 2500)
    } catch {
      setCopyMsg('Copy failed — check browser permissions')
      setTimeout(() => setCopyMsg(''), 2500)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Loading auth state
  if (session === undefined) return null

  // Not logged in or wrong account
  if (!session || session.user?.email !== ADMIN_EMAIL) {
    return <LoginGate />
  }

  const allPurchaserEmails = [...new Set(tickets.map(t => t.email))].join(', ')
  const followerEmails = [...new Set(
    tickets.filter(t => t.follow_nonlinear).map(t => t.email)
  )].join(', ')

  const ticketsSold = event?.tickets_sold || tickets.length
  const capacity = event?.capacity || 250

  const EARLY_BIRD_ENDS_UTC = new Date('2026-04-07T06:00:00Z')
  const totalRevenueMXN = tickets.reduce((sum, t) => {
    const price = new Date(t.created_at) < EARLY_BIRD_ENDS_UTC ? 400 : 500
    return sum + price * t.quantity
  }, 0)

  const s = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem 1rem',
    },
    card: {
      background: 'rgba(255,255,255,0.95)',
      borderRadius: '20px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    },
    h1: { color: '#d2691e', fontSize: '2rem', fontWeight: '800', margin: '0 0 0.25rem 0' },
    h2: { color: '#8b4513', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 1rem 0' },
    btn: {
      padding: '0.6rem 1.2rem',
      background: 'linear-gradient(45deg, #d2691e, #cd853f)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
      boxShadow: '0 2px 8px rgba(210,105,30,0.3)',
      marginRight: '0.5rem',
      marginBottom: '0.5rem',
    },
    stat: {
      display: 'inline-block',
      background: 'rgba(210,105,30,0.1)',
      border: '1px solid rgba(210,105,30,0.25)',
      borderRadius: '10px',
      padding: '0.75rem 1.25rem',
      marginRight: '0.75rem',
      marginBottom: '0.75rem',
      textAlign: 'center',
    },
    statNum: { fontSize: '1.8rem', fontWeight: '800', color: '#d2691e', display: 'block', lineHeight: 1 },
    statLabel: { fontSize: '0.75rem', color: '#8b4513', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.25rem', display: 'block' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
    th: { textAlign: 'left', padding: '0.6rem 0.75rem', color: '#8b4513', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e8d5b0' },
    td: { padding: '0.6rem 0.75rem', borderBottom: '1px solid #f0e8d8', color: '#4a2800', verticalAlign: 'middle' },
  }

  return (
    <div style={s.page}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ ...s.card, paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={s.h1}>Nonlinear — Admin</h1>
            <p style={{ color: '#8b4513', margin: '0', fontSize: '0.9rem' }}>
              April 11, 2026 — 10PM–Sunrise — Mexico City
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{ ...s.btn, background: '#888', marginBottom: 0 }}
          >
            Log Out
          </button>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Overview</h2>
          {loading ? (
            <p style={{ color: '#8b4513' }}>Loading...</p>
          ) : (
            <div>
              <span style={s.stat}>
                <span style={s.statNum}>{ticketsSold} / {capacity}</span>
                <span style={s.statLabel}>Tickets Sold</span>
              </span>
              <span style={s.stat}>
                <span style={s.statNum}>${totalRevenueMXN.toLocaleString()}</span>
                <span style={s.statLabel}>Revenue (MXN)</span>
              </span>
              <span style={s.stat}>
                <span style={s.statNum}>{tickets.filter(t => t.follow_nonlinear).length}</span>
                <span style={s.statLabel}>Followers</span>
              </span>
              <span style={s.stat}>
                <span style={s.statNum}>{tickets.filter(t => t.torn).length}</span>
                <span style={s.statLabel}>Torn Tickets</span>
              </span>
            </div>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Email Lists</h2>
          <button style={s.btn} onClick={() => copyToClipboard(allPurchaserEmails, 'All purchaser emails')}>
            Copy All Purchaser Emails ({[...new Set(tickets.map(t => t.email))].length})
          </button>
          <button style={s.btn} onClick={() => copyToClipboard(followerEmails, 'Follower emails')}>
            Copy Nonlinear Follower Emails ({[...new Set(tickets.filter(t => t.follow_nonlinear).map(t => t.email))].length})
          </button>
          <button style={{ ...s.btn, background: '#888' }} onClick={fetchData}>
            Refresh
          </button>
          {copyMsg && (
            <div style={{
              display: 'inline-block',
              marginLeft: '0.5rem',
              padding: '0.4rem 0.9rem',
              background: '#d4edda',
              color: '#155724',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '500',
            }}>
              {copyMsg}
            </div>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Tickets ({tickets.length})</h2>
          {loading ? (
            <p style={{ color: '#8b4513' }}>Loading...</p>
          ) : tickets.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>No tickets sold yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Qty</th>
                    <th style={s.th}>Follow</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id}>
                      <td style={{ ...s.td, fontWeight: '700', color: '#d2691e' }}>{t.ticket_number}</td>
                      <td style={s.td}>{t.name}</td>
                      <td style={{ ...s.td, fontSize: '0.8rem', wordBreak: 'break-all' }}>{t.email}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{t.quantity}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {t.follow_nonlinear
                          ? <span style={{ color: '#4caf50', fontWeight: '600' }}>YES</span>
                          : <span style={{ color: '#999' }}>—</span>
                        }
                      </td>
                      <td style={s.td}>
                        {t.torn
                          ? <span style={{ background: '#cc2200', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>TORN</span>
                          : <span style={{ background: 'rgba(76,175,80,0.15)', color: '#4caf50', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>VALID</span>
                        }
                      </td>
                      <td style={{ ...s.td, fontSize: '0.78rem', color: '#8b4513' }}>
                        {new Date(t.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Followers / Mailing List ({followers.length})</h2>
          {loading ? (
            <p style={{ color: '#8b4513' }}>Loading...</p>
          ) : followers.length === 0 ? (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>No followers yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>City</th>
                    <th style={s.th}>Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {followers.map(f => (
                    <tr key={f.id}>
                      <td style={s.td}>{f.name || '—'}</td>
                      <td style={{ ...s.td, fontSize: '0.8rem', wordBreak: 'break-all' }}>{f.email}</td>
                      <td style={s.td}>{f.city}</td>
                      <td style={{ ...s.td, fontSize: '0.78rem', color: '#8b4513' }}>
                        {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
