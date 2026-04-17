import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

const TABS = ['Tickets', 'Doves', 'History']

export default function ProfilePage() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('Tickets')
  const [tickets, setTickets] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const navigate = useNavigate()

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendNote, setSendNote] = useState('')
  const [sendStatus, setSendStatus] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchData()
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

  const handleBecomePromoter = async () => {
    setUpgrading(true)
    await supabase.from('users').upsert({
      id: session.user.id,
      email: session.user.email,
      username: session.user.email.split('@')[0].toUpperCase(),
      user_type: 'promoter',
    })
    navigate('/promoter')
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

    const { data: recipient } = await supabase
      .from('profiles')
      .select('id, dov_balance, username')
      .or(`username.eq.${sendTo},email.eq.${sendTo}`)
      .single()

    if (!recipient) {
      setSendStatus('Recipient not found.')
      return
    }

    const { error: deductErr } = await supabase
      .from('profiles')
      .update({ dov_balance: profile.dov_balance - amount })
      .eq('id', session.user.id)

    if (deductErr) { setSendStatus('Transfer failed.'); return }

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

  if (session === undefined) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '500px', pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
        }} />
        <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={LogoMark({ size: 56 })}>GRAIL</div>
          </div>
          <div style={{ ...eyebrowStyle(BRAND.purple), textAlign: 'center' }}>Fan Portal</div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', textAlign: 'center', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>Your tickets. Your doves.</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', marginBottom: '2rem' }}>Sign in to see your shows.</div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '0.25rem' }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => setAuthMode(m)} style={{
                flex: 1, padding: '0.55rem', borderRadius: '7px', border: 'none',
                background: authMode === m ? BRAND.gradient : 'transparent',
                color: authMode === m ? '#000' : C.textMid,
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
                fontFamily: FONT,
              }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={INPUT} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={INPUT} required />
            {authError && <p style={{ fontSize: '0.82rem', color: BRAND.orange, margin: 0 }}>{authError}</p>}
            <button type="submit" style={{ ...PRIMARY_BTN, marginTop: '0.25rem' }} disabled={authLoading}>
              {authLoading ? '…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const activeTickets = tickets.filter(t => !t.torn)
  const tornTickets = tickets.filter(t => t.torn)
  const attendedEvents = tickets
    .filter((t, i, arr) => arr.findIndex(x => x.event_id === t.event_id) === i)
    .filter(t => t.event_id)

  return (
    <div style={PAGE}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: FONT,
          }}>
            ←
          </button>
          <div style={LogoMark({ size: 30 })}>GRAIL</div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>GRAIL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.78rem', color: C.textMid }}>{session.user.email}</span>
          <button onClick={handleSignOut} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: FONT,
          }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'transparent', border: 'none',
              color: tab === t ? C.text : C.textDim,
              padding: '16px 20px', cursor: 'pointer',
              fontSize: '0.85rem', fontFamily: FONT,
              letterSpacing: '0.05em', fontWeight: '700',
              borderBottom: `2px solid ${tab === t ? BRAND.pink : 'transparent'}`,
              marginBottom: '-1px', transition: 'color 0.2s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 0', fontSize: '2rem', opacity: 0.4 }}>🕊</div>
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

        <div style={{
          marginTop: '3rem', padding: '1.4rem 1.6rem',
          border: `1px solid ${C.border}`, borderRadius: '14px',
          background: C.card,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...eyebrowStyle(), marginBottom: '0.4rem' }}>For Promoters</div>
            <div style={{ fontSize: '1rem', color: C.text, fontWeight: '700', marginBottom: '0.3rem' }}>Throwing an event?</div>
            <div style={{ fontSize: '0.82rem', color: C.textMid, lineHeight: '1.5' }}>Switch to a promoter account to sell tickets and manage your bar.</div>
          </div>
          <button onClick={handleBecomePromoter} disabled={upgrading} style={{
            background: BRAND.gradient, color: '#000', border: 'none',
            borderRadius: '8px', padding: '0.65rem 1.2rem', fontSize: '0.85rem',
            fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT,
          }}>
            {upgrading ? '…' : 'Apply →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TicketsTab({ active, torn }) {
  return (
    <div>
      {active.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={eyebrowStyle()}>Active</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {active.map(t => <TicketCard key={t.id} ticket={t} active />)}
          </div>
        </section>
      )}
      {torn.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ ...eyebrowStyle(C.textMid), opacity: 0.6 }}>Used</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {torn.map(t => <TicketCard key={t.id} ticket={t} active={false} />)}
          </div>
        </section>
      )}
      {active.length === 0 && torn.length === 0 && (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <p style={{ color: C.textMid, marginBottom: '1rem' }}>No tickets yet.</p>
          <a href="/" style={{ color: BRAND.pink, fontSize: '0.9rem', fontWeight: '700' }}>Get tickets →</a>
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
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '12px', padding: '1.25rem 1.4rem',
      opacity: active ? 1 : 0.45,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem', color: C.text, fontWeight: '700' }}>{eventName}</span>
        <span style={badgeStyle(active ? 'success' : 'neutral')}>
          {active ? 'VALID' : 'USED'}
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '0.5rem' }}>{eventDate}</div>
      <div style={{ fontSize: '0.72rem', color: C.textDim, fontFamily: 'monospace' }}>#{ticket.id?.slice(0, 8)}</div>
      {active && (
        <a href={`/t/${ticket.id}`} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.85rem', color: BRAND.pink, textDecoration: 'none', fontWeight: '700' }}>
          View ticket →
        </a>
      )}
    </div>
  )
}

function DovesTab({ profile, sendTo, setSendTo, sendAmount, setSendAmount, sendNote, setSendNote, sendStatus, onSend }) {
  const balance = profile?.dov_balance ?? 0
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '3rem 0 2.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🕊</div>
        <div style={{ fontSize: '3.5rem', fontWeight: '900', color: balance > 0 ? BRAND.neon : C.textMid, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {balance}
        </div>
        <div style={{ ...eyebrowStyle(C.textMid), marginTop: '0.6rem' }}>Doves</div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>
        <div style={eyebrowStyle()}>Send Doves</div>
        <form onSubmit={onSend} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input placeholder="Username or email" value={sendTo} onChange={e => setSendTo(e.target.value)} style={INPUT} />
          <input type="number" placeholder="Amount" value={sendAmount} onChange={e => setSendAmount(e.target.value)} style={INPUT} min="1" />
          <input placeholder="Note (optional)" value={sendNote} onChange={e => setSendNote(e.target.value)} style={INPUT} />
          {sendStatus && <p style={{ fontSize: '0.85rem', color: BRAND.pink, margin: '0 0 0.25rem' }}>{sendStatus}</p>}
          <button type="submit" style={{ ...PRIMARY_BTN, marginTop: '0.25rem' }}>Send</button>
        </form>
      </div>
    </div>
  )
}

function HistoryTab({ attendedEvents }) {
  if (attendedEvents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <p style={{ color: C.textMid }}>No events yet. Your history will live here.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
      {attendedEvents.map(ticket => {
        const ev = ticket.events || {}
        const flyer = ev.flyer_url || '/flyer.jpg'
        const eventName = ev.artist_name || 'Event'
        const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
        return (
          <div key={ticket.event_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <img src={flyer} alt={eventName} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '0.85rem 1rem 1rem' }}>
              <div style={{ fontSize: '0.95rem', color: C.text, fontWeight: '700', marginBottom: '0.25rem' }}>{eventName}</div>
              <div style={{ fontSize: '0.78rem', color: C.textMid }}>{eventDate}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
