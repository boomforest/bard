import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'

const TABS = ['Tickets', 'Doves', 'History']

export default function ProfilePage() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [tab, setTab] = useState('Tickets')
  const [tickets, setTickets] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auth form state
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Doves send state
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendNote, setSendNote] = useState('')
  const [sendStatus, setSendStatus] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    setLoading(true)
    const userEmail = session.user.email

    const [ticketsRes, profileRes] = await Promise.all([
      supabase.from('tickets').select('*, events(artist_name, event_date, flyer_url)').eq('email', userEmail),
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
    ])

    setTickets(ticketsRes.data || [])
    setProfile(profileRes.data || null)
    setLoading(false)
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setAuthError(error.message)
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setAuthError(error.message)
        else setAuthError('Check your email to confirm your account.')
      }
    } catch (err) {
      setAuthError(err.message)
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleSendDoves = async (e) => {
    e.preventDefault()
    setSendStatus('')
    const amount = parseInt(sendAmount)
    if (!sendTo || !amount || amount <= 0) {
      setSendStatus('Enter a recipient and amount.')
      return
    }
    if (!profile || profile.dov_balance < amount) {
      setSendStatus('Not enough doves.')
      return
    }

    // Find recipient profile by username or email
    const { data: recipient } = await supabase
      .from('profiles')
      .select('id, dov_balance, username')
      .or(`username.eq.${sendTo},email.eq.${sendTo}`)
      .single()

    if (!recipient) {
      setSendStatus('Recipient not found.')
      return
    }

    // Deduct from sender
    const { error: deductErr } = await supabase
      .from('profiles')
      .update({ dov_balance: profile.dov_balance - amount })
      .eq('id', session.user.id)

    if (deductErr) { setSendStatus('Transfer failed.'); return }

    // Add to recipient
    await supabase
      .from('profiles')
      .update({ dov_balance: (recipient.dov_balance || 0) + amount })
      .eq('id', recipient.id)

    setSendStatus(`Sent ${amount} doves to ${recipient.username || sendTo}.`)
    setSendTo('')
    setSendAmount('')
    setSendNote('')
    fetchData()
  }

  // Loading state
  if (session === undefined) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>🕊</div>
      </div>
    )
  }

  // Not logged in — show auth form
  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.authCard}>
          <div style={styles.logo}>🕊</div>
          <h1 style={styles.title}>Grail</h1>
          <p style={styles.subtitle}>Your tickets. Your doves. Your history.</p>

          <div style={styles.modeTabs}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => setAuthMode(m)}
                style={{ ...styles.modeTab, ...(authMode === m ? styles.modeTabActive : {}) }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} style={styles.form}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />
            {authError && <p style={styles.error}>{authError}</p>}
            <button type="submit" style={styles.submitBtn} disabled={authLoading}>
              {authLoading ? '...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Logged in
  const activeTickets = tickets.filter(t => !t.torn)
  const tornTickets = tickets.filter(t => t.torn)
  const attendedEvents = tickets
    .filter((t, i, arr) => arr.findIndex(x => x.event_id === t.event_id) === i)
    .filter(t => t.event_id)

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.headerLogo}>🕊 Grail</span>
        <div style={styles.headerRight}>
          <span style={styles.headerEmail}>{session.user.email}</span>
          <button onClick={handleSignOut} style={styles.signOutBtn}>Sign out</button>
        </div>
      </div>

      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>🕊</div>
        ) : tab === 'Tickets' ? (
          <TicketsTab active={activeTickets} torn={tornTickets} />
        ) : tab === 'Doves' ? (
          <DovesTab
            profile={profile}
            sendTo={sendTo} setSendTo={setSendTo}
            sendAmount={sendAmount} setSendAmount={setSendAmount}
            sendNote={sendNote} setSendNote={setSendNote}
            sendStatus={sendStatus}
            onSend={handleSendDoves}
          />
        ) : (
          <HistoryTab attendedEvents={attendedEvents} />
        )}
      </div>
    </div>
  )
}

function TicketsTab({ active, torn }) {
  return (
    <div>
      {active.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Active</h2>
          <div style={styles.ticketGrid}>
            {active.map(t => <TicketCard key={t.id} ticket={t} active />)}
          </div>
        </section>
      )}
      {torn.length > 0 && (
        <section style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, opacity: 0.5 }}>Used</h2>
          <div style={styles.ticketGrid}>
            {torn.map(t => <TicketCard key={t.id} ticket={t} active={false} />)}
          </div>
        </section>
      )}
      {active.length === 0 && torn.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No tickets yet.</p>
          <a href="/" style={styles.emptyLink}>Get tickets →</a>
        </div>
      )}
    </div>
  )
}

function TicketCard({ ticket, active }) {
  const ev = ticket.events || {}
  const eventName = ev.artist_name || 'Event'
  const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div style={{ ...styles.ticketCard, opacity: active ? 1 : 0.45 }}>
      <div style={styles.ticketTop}>
        <span style={styles.ticketEvent}>{eventName}</span>
        {active ? <span style={styles.ticketBadge}>VALID</span> : <span style={{ ...styles.ticketBadge, color: '#444', borderColor: '#333' }}>USED</span>}
      </div>
      <div style={styles.ticketDate}>{eventDate}</div>
      <div style={styles.ticketId}>#{ticket.id?.slice(0, 8)}</div>
      {active && (
        <a href={`/t/${ticket.id}`} style={styles.ticketLink}>View ticket →</a>
      )}
    </div>
  )
}

function DovesTab({ profile, sendTo, setSendTo, sendAmount, setSendAmount, sendNote, setSendNote, sendStatus, onSend }) {
  const balance = profile?.dov_balance ?? 0
  return (
    <div>
      <div style={styles.doveBalance}>
        <div style={styles.doveIcon}>🕊</div>
        <div style={styles.doveCount}>{balance}</div>
        <div style={styles.doveLabel}>Doves</div>
      </div>

      <div style={styles.sendCard}>
        <h3 style={styles.sendTitle}>Send Doves</h3>
        <form onSubmit={onSend} style={styles.form}>
          <input
            placeholder="Username or email"
            value={sendTo}
            onChange={e => setSendTo(e.target.value)}
            style={styles.input}
          />
          <input
            type="number"
            placeholder="Amount"
            value={sendAmount}
            onChange={e => setSendAmount(e.target.value)}
            style={styles.input}
            min="1"
          />
          <input
            placeholder="Note (optional)"
            value={sendNote}
            onChange={e => setSendNote(e.target.value)}
            style={styles.input}
          />
          {sendStatus && <p style={styles.sendStatus}>{sendStatus}</p>}
          <button type="submit" style={styles.submitBtn}>Send</button>
        </form>
      </div>
    </div>
  )
}

function HistoryTab({ attendedEvents }) {
  if (attendedEvents.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No events yet. Your history will live here.</p>
      </div>
    )
  }
  return (
    <div style={styles.flyerGrid}>
      {attendedEvents.map(ticket => {
        const ev = ticket.events || {}
        const flyer = ev.flyer_url || '/flyer.jpg'
        const eventName = ev.artist_name || 'Event'
        const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
        return (
          <div key={ticket.event_id} style={styles.flyerCard}>
            <img src={flyer} alt={eventName} style={styles.flyerImg} />
            <div style={styles.flyerName}>{eventName}</div>
            <div style={styles.flyerDate}>{eventDate}</div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#f0ece4',
    fontFamily: "'Georgia', serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #1e1e1e',
  },
  headerLogo: {
    fontSize: '1.1rem',
    letterSpacing: '0.05em',
    color: '#f0ece4',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerEmail: {
    fontSize: '0.8rem',
    color: '#666',
  },
  signOutBtn: {
    background: 'transparent',
    border: '1px solid #333',
    color: '#888',
    padding: '6px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1e1e1e',
    padding: '0 24px',
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    color: '#555',
    padding: '16px 20px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    letterSpacing: '0.05em',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 0.2s',
  },
  tabBtnActive: {
    color: '#f0ece4',
    borderBottomColor: '#c8a96e',
  },
  content: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  loading: {
    textAlign: 'center',
    padding: '80px 0',
    fontSize: '2rem',
    opacity: 0.4,
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: '16px',
  },
  ticketGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  ticketCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    padding: '20px 24px',
    transition: 'border-color 0.2s',
  },
  ticketTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  ticketEvent: {
    fontSize: '1.1rem',
    color: '#f0ece4',
  },
  ticketBadge: {
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    color: '#c8a96e',
    border: '1px solid #c8a96e',
    padding: '3px 8px',
    borderRadius: '3px',
  },
  ticketDate: {
    fontSize: '0.85rem',
    color: '#888',
    marginBottom: '8px',
  },
  ticketId: {
    fontSize: '0.75rem',
    color: '#444',
    fontFamily: 'monospace',
  },
  ticketLink: {
    display: 'inline-block',
    marginTop: '12px',
    fontSize: '0.85rem',
    color: '#c8a96e',
    textDecoration: 'none',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
  },
  emptyText: {
    color: '#555',
    marginBottom: '16px',
  },
  emptyLink: {
    color: '#c8a96e',
    fontSize: '0.9rem',
  },
  doveBalance: {
    textAlign: 'center',
    padding: '48px 0 40px',
  },
  doveIcon: {
    fontSize: '2.5rem',
    marginBottom: '12px',
  },
  doveCount: {
    fontSize: '3.5rem',
    fontWeight: '300',
    color: '#f0ece4',
    lineHeight: 1,
  },
  doveLabel: {
    fontSize: '0.8rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#666',
    marginTop: '8px',
  },
  sendCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '400px',
    margin: '0 auto',
  },
  sendTitle: {
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '16px',
    fontWeight: 'normal',
  },
  sendStatus: {
    fontSize: '0.85rem',
    color: '#c8a96e',
    margin: '0 0 8px',
  },
  flyerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
  },
  flyerCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  flyerImg: {
    width: '100%',
    aspectRatio: '3/4',
    objectFit: 'cover',
    display: 'block',
  },
  flyerPlaceholder: {
    width: '100%',
    aspectRatio: '3/4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    background: '#0d0d0d',
  },
  flyerName: {
    padding: '12px 16px 4px',
    fontSize: '0.95rem',
    color: '#f0ece4',
  },
  flyerDate: {
    padding: '0 16px 12px',
    fontSize: '0.8rem',
    color: '#666',
  },
  // Auth form styles
  authCard: {
    maxWidth: '400px',
    margin: '80px auto',
    padding: '40px 32px',
    background: '#111',
    border: '1px solid #222',
    borderRadius: '12px',
    textAlign: 'center',
  },
  logo: {
    fontSize: '2.5rem',
    marginBottom: '12px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'normal',
    marginBottom: '8px',
    color: '#f0ece4',
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '28px',
  },
  modeTabs: {
    display: 'flex',
    marginBottom: '24px',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #222',
  },
  modeTab: {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: 'none',
    color: '#555',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    transition: 'all 0.2s',
  },
  modeTabActive: {
    background: '#1e1e1e',
    color: '#f0ece4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    background: '#0d0d0d',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    color: '#f0ece4',
    padding: '12px 14px',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: '#c8a96e',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    padding: '14px',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    marginTop: '4px',
  },
  error: {
    fontSize: '0.82rem',
    color: '#c8a96e',
    margin: '0',
    textAlign: 'left',
  },
}
