import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'

const ADMIN_PIN = '3333'

function LoginGate({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin === ADMIN_PIN) {
      localStorage.setItem('admin_auth', '1')
      onLogin()
    } else {
      setError('Incorrect PIN')
      setPin('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0a00 50%, #0d0d0d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(26,8,0,0.9)',
        border: '1px solid #2a1500',
        borderRadius: '20px',
        padding: '2.5rem',
        maxWidth: '360px',
        width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}>
        <div style={{ color: '#e8d5b0', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
          Nonlinear Admin
        </div>
        <div style={{ color: '#cd853f', fontSize: '0.9rem', marginBottom: '2rem' }}>
          April 11, 2026
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '1.2rem',
              textAlign: 'center',
              letterSpacing: '0.3em',
              background: '#111',
              border: '2px solid #2a1500',
              borderRadius: '12px',
              color: '#e8d5b0',
              marginBottom: '1rem',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.9rem',
              background: 'linear-gradient(45deg, #d2691e, #cd853f)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '1rem',
            }}
          >
            Enter
          </button>
          {error && (
            <div style={{ color: '#cc2200', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</div>
          )}
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email sweep helpers
// ---------------------------------------------------------------------------

// Group tickets by payment intent so multi-ticket purchases stay together
function groupByPurchase(tickets) {
  const map = new Map()
  for (const t of tickets) {
    const key = t.stripe_payment_intent_id || t.id
    if (!map.has(key)) {
      map.set(key, { name: t.name, email: t.email, ticketIds: [], createdAt: t.created_at })
    }
    map.get(key).ticketIds.push(t.id)
  }
  return Array.from(map.values())
}

// Only real external purchases — skip mock tests and your own test emails
const TEST_EMAILS = new Set(['jproney@gmail.com', 'jp@casadecopas.com'])
const isRealPurchase = t =>
  t.ticket_number > 11 &&
  !TEST_EMAILS.has(t.email) &&
  !t.stripe_payment_intent_id?.startsWith('mock_') &&
  !t.stripe_payment_intent_id?.startsWith('2VU') // old PayPal test

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('admin_auth') === '1')
  const [tickets, setTickets] = useState([])
  const [followers, setFollowers] = useState([])
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copyMsg, setCopyMsg] = useState('')
  const [emailStatuses, setEmailStatuses] = useState({}) // key: first ticketId → 'sending'|'ok'|'err'
  const [sweeping, setSweeping] = useState(false)
  const [resendStatus, setResendStatus] = useState(null) // email → { last_event, sent_at }

  useEffect(() => {
    if (authed) fetchData()
  }, [authed])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: ticketData }, { data: followerData }, { data: eventData }, emailRes] = await Promise.all([
      supabase.from('tickets').select('*').order('ticket_number', { ascending: true }),
      supabase.from('followers').select('*').eq('artist_id', 'nonlinear').order('created_at', { ascending: true }),
      supabase.from('events').select('*').eq('artist_name', 'Nonlinear').single(),
      fetch('/.netlify/functions/get-email-status').then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setTickets(ticketData || [])
    setFollowers(followerData || [])
    setEvent(eventData || null)
    setResendStatus(emailRes || {})
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

  const handleLogout = () => {
    localStorage.removeItem('admin_auth')
    setAuthed(false)
  }

  const sendEmail = async (purchase, key) => {
    setEmailStatuses(prev => ({ ...prev, [key]: 'sending' }))
    try {
      const res = await fetch('/.netlify/functions/send-ticket-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: purchase.email,
          name: purchase.name,
          ticketIds: purchase.ticketIds,
          quantity: purchase.ticketIds.length,
          origin: window.location.origin,
          lang: 'en',
        }),
      })
      setEmailStatuses(prev => ({ ...prev, [key]: res.ok ? 'ok' : 'err' }))
    } catch {
      setEmailStatuses(prev => ({ ...prev, [key]: 'err' }))
    }
  }

  const handleSweepAll = async (purchases) => {
    setSweeping(true)
    for (const { purchase, key } of purchases) {
      await sendEmail(purchase, key)
      // small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 400))
    }
    setSweeping(false)
  }

  if (!authed) {
    return <LoginGate onLogin={() => setAuthed(true)} />
  }

  const realTickets = tickets.filter(t => t.ticket_number > 16)
  const sweepTickets = tickets.filter(isRealPurchase)
  const sweepPurchases = groupByPurchase(sweepTickets).map(purchase => ({
    purchase,
    key: purchase.ticketIds[0],
  }))

  const allPurchaserEmails = [...new Set(realTickets.map(t => t.email))].join(', ')
  const followerEmails = [...new Set(
    realTickets.filter(t => t.follow_nonlinear).map(t => t.email)
  )].join(', ')

  const ticketsSold = realTickets.length
  const capacity = (event?.capacity || 266) - 16

  const EARLY_BIRD_ENDS_UTC = new Date('2026-04-07T06:00:00Z')
  const totalRevenueMXN = realTickets.reduce((sum, t) => {
    const price = new Date(t.created_at) < EARLY_BIRD_ENDS_UTC ? 400 : 500
    return sum + price * t.quantity
  }, 0)

  const s = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0a00 50%, #0d0d0d 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem 1rem',
    },
    card: {
      background: 'rgba(26,8,0,0.8)',
      border: '1px solid #2a1500',
      borderRadius: '20px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    },
    h1: { color: '#e8d5b0', fontSize: '2rem', fontWeight: '800', margin: '0 0 0.25rem 0' },
    h2: { color: '#cd853f', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.08em' },
    btn: {
      padding: '0.6rem 1.2rem',
      background: 'linear-gradient(45deg, #d2691e, #cd853f)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
      boxShadow: '0 2px 8px rgba(210,105,30,0.4)',
      marginRight: '0.5rem',
      marginBottom: '0.5rem',
    },
    stat: {
      display: 'inline-block',
      background: 'rgba(210,105,30,0.1)',
      border: '1px solid rgba(210,105,30,0.3)',
      borderRadius: '10px',
      padding: '0.75rem 1.25rem',
      marginRight: '0.75rem',
      marginBottom: '0.75rem',
      textAlign: 'center',
    },
    statNum: { fontSize: '1.8rem', fontWeight: '800', color: '#d2691e', display: 'block', lineHeight: 1 },
    statLabel: { fontSize: '0.75rem', color: '#cd853f', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.25rem', display: 'block' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
    th: { textAlign: 'left', padding: '0.6rem 0.75rem', color: '#cd853f', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #2a1500' },
    td: { padding: '0.6rem 0.75rem', borderBottom: '1px solid #1a0a00', color: '#e8d5b0', verticalAlign: 'middle' },
  }

  return (
    <div style={s.page}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ ...s.card, paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={s.h1}>Nonlinear — Admin</h1>
            <p style={{ color: '#cd853f', margin: '0', fontSize: '0.9rem' }}>
              April 11, 2026 — 10PM–Sunrise — Mexico City
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{ ...s.btn, background: '#2a1500', border: '1px solid #4a2800', marginBottom: 0 }}
          >
            Log Out
          </button>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Overview</h2>
          {loading ? (
            <p style={{ color: '#cd853f' }}>Loading...</p>
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
                <span style={s.statNum}>{realTickets.filter(t => t.follow_nonlinear).length}</span>
                <span style={s.statLabel}>Followers</span>
              </span>
              <span style={s.stat}>
                <span style={s.statNum}>{realTickets.filter(t => t.torn).length}</span>
                <span style={s.statLabel}>Torn Tickets</span>
              </span>
            </div>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Email Lists</h2>
          <button style={s.btn} onClick={() => copyToClipboard(allPurchaserEmails, 'All purchaser emails')}>
            Copy All Purchaser Emails ({[...new Set(realTickets.map(t => t.email))].length})
          </button>
          <button style={s.btn} onClick={() => copyToClipboard(followerEmails, 'Follower emails')}>
            Copy Nonlinear Follower Emails ({[...new Set(realTickets.filter(t => t.follow_nonlinear).map(t => t.email))].length})
          </button>
          <button style={{ ...s.btn, background: '#2a1500', border: '1px solid #4a2800' }} onClick={fetchData}>
            Refresh
          </button>
          {copyMsg && (
            <div style={{
              display: 'inline-block',
              marginLeft: '0.5rem',
              padding: '0.4rem 0.9rem',
              background: 'rgba(76,175,80,0.15)',
              color: '#80ff80',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '500',
            }}>
              {copyMsg}
            </div>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Tickets ({realTickets.length})</h2>
          {loading ? (
            <p style={{ color: '#cd853f' }}>Loading...</p>
          ) : realTickets.length === 0 ? (
            <p style={{ color: '#4a2800', fontSize: '0.9rem' }}>No tickets sold yet.</p>
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
                  {realTickets.map(t => (
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
                      <td style={{ ...s.td, fontSize: '0.78rem', color: '#cd853f' }}>
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
          {(() => {
            const uniqueFollowers = followers.filter((f, i, arr) => arr.findIndex(x => x.email === f.email) === i)
            return <>
              <h2 style={s.h2}>Followers / Mailing List ({uniqueFollowers.length})</h2>
              {loading ? (
                <p style={{ color: '#cd853f' }}>Loading...</p>
              ) : uniqueFollowers.length === 0 ? (
                <p style={{ color: '#4a2800', fontSize: '0.9rem' }}>No followers yet.</p>
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
                      {uniqueFollowers.map(f => (
                        <tr key={f.id}>
                          <td style={s.td}>{f.name || '—'}</td>
                          <td style={{ ...s.td, fontSize: '0.8rem', wordBreak: 'break-all' }}>{f.email}</td>
                          <td style={s.td}>{f.city}</td>
                          <td style={{ ...s.td, fontSize: '0.78rem', color: '#cd853f' }}>
                            {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          })()}
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Email Sweep — Pre-Event ({sweepPurchases.length} buyers)</h2>
          <p style={{ color: '#cd853f', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
            Resend can't show delivery history, so use this to confirm everyone has their links before April 11. Safe to resend — it just re-sends the confirmation email.
          </p>
          <button
            style={{ ...s.btn, opacity: sweeping ? 0.6 : 1 }}
            disabled={sweeping}
            onClick={() => handleSweepAll(sweepPurchases)}
          >
            {sweeping ? 'Sending…' : `Send Pre-Event Reminder to All (${sweepPurchases.length})`}
          </button>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Tickets</th>
                  <th style={s.th}>Delivery</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sweepPurchases.map(({ purchase, key }) => {
                  const sessionStatus = emailStatuses[key]
                  const historical = resendStatus?.[purchase.email.toLowerCase()]
                  const deliveryLabel = historical?.last_event
                    ? historical.last_event.charAt(0).toUpperCase() + historical.last_event.slice(1)
                    : null
                  const deliveryColor = historical?.last_event === 'delivered' || historical?.last_event === 'clicked' || historical?.last_event === 'opened'
                    ? '#4caf50' : historical?.last_event ? '#cc2200' : '#999'
                  return (
                    <tr key={key}>
                      <td style={s.td}>{purchase.name}</td>
                      <td style={{ ...s.td, fontSize: '0.8rem', wordBreak: 'break-all' }}>{purchase.email}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{purchase.ticketIds.length}</td>
                      <td style={s.td}>
                        <span style={{ color: deliveryColor, fontWeight: '600', fontSize: '0.82rem', marginRight: '0.6rem' }}>
                          {deliveryLabel || '—'}
                        </span>
                      </td>
                      <td style={s.td}>
                        {sessionStatus === 'ok' && <span style={{ color: '#4caf50', fontWeight: '600', fontSize: '0.85rem' }}>Sent ✓</span>}
                        {sessionStatus === 'err' && <span style={{ color: '#cc2200', fontWeight: '600', fontSize: '0.85rem' }}>Failed ✗</span>}
                        {sessionStatus === 'sending' && <span style={{ color: '#cd853f', fontSize: '0.85rem' }}>Sending…</span>}
                        {!sessionStatus && (
                          <button
                            style={{ ...s.btn, padding: '0.35rem 0.8rem', fontSize: '0.8rem', marginBottom: 0, marginRight: 0 }}
                            onClick={() => sendEmail(purchase, key)}
                          >
                            Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
