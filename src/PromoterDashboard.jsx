import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import GrailSetup from './GrailSetup'
import PromoterEvents from './PromoterEvents'
import OnboardingWizard from './OnboardingWizard'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

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
        <div style={{ ...eyebrowStyle(), textAlign: 'center' }}>Promoter Portal</div>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', textAlign: 'center', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
          Sign in to your account
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input style={INPUT} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={INPUT} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!email.trim()) { setError('Enter your email above first.'); return }
              setError('')
              const { error: rErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
              })
              setError(rErr ? rErr.message : 'Reset link sent — check your email.')
            }}
            style={{
              background: 'transparent', border: 'none', color: C.textMid,
              fontSize: '0.78rem', cursor: 'pointer', padding: '0.2rem 0',
              fontFamily: FONT,
            }}
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PromoterDashboard() {
  const [session, setSession] = useState(undefined)
  const [view, setView]       = useState('events')   // events | new | find
  const [stripeReady, setStripeReady] = useState(null)  // null = unknown, false/true once checked
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Check Stripe Connect status whenever we land on the events view
  useEffect(() => {
    if (!session?.user?.id || view !== 'events') return
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/.netlify/functions/stripe-connect-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user.id }),
        })
        const json = await res.json()
        if (!cancelled) setStripeReady(!!(json.charges_enabled && json.details_submitted))
      } catch {
        if (!cancelled) setStripeReady(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [session, view, refreshKey])

  const startStripeOnboarding = async () => {
    if (!session?.user?.id) return
    try {
      const res = await fetch('/.netlify/functions/stripe-connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          email:   session.user.email,
          origin:  window.location.origin,
        }),
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else alert(json.error || 'Could not start Stripe onboarding')
    } catch (err) {
      alert(err.message)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (session === undefined) return null
  if (!session) return <LoginForm />

  return (
    <div style={PAGE}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '0.4rem 0.7rem', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: FONT,
          }}>
            ←
          </button>
          <div style={LogoMark({ size: 30 })}>GRAIL</div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>GRAIL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {(view === 'new' || view === 'find') && (
            <button onClick={() => { setView('events'); setRefreshKey(k => k + 1) }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
              borderRadius: '6px', padding: '0.4rem 0.85rem', cursor: 'pointer',
              fontSize: '0.78rem', fontFamily: FONT,
            }}>
              ← My Events
            </button>
          )}
          <span style={{ color: C.textMid, fontSize: '0.82rem' }}>{session.user.email}</span>
          <button onClick={signOut} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer',
            fontSize: '0.78rem', fontFamily: FONT,
          }}>
            Sign out
          </button>
        </div>
      </div>

      {view === 'events' && (
        <>
          <OnboardingWizard
            key={refreshKey}
            promoterId={session.user.id}
            stripeReady={stripeReady}
            onConnectStripe={startStripeOnboarding}
            onCreateEvent={() => setView('new')}
          />
          <FollowersStrip promoterId={session.user.id} />
          <FindArtistsTeaser onClick={() => setView('find')} />
          <PromoterEvents
            key={refreshKey}
            promoterId={session.user.id}
            onNew={() => setView('new')}
            onCheckStripe={startStripeOnboarding}
            stripeReady={stripeReady}
          />
        </>
      )}
      {view === 'new' && <GrailSetup />}
      {view === 'find' && <FindArtists />}
    </div>
  )
}

// ─── FIND ARTISTS TEASER (in events view) ────────────────────────────────────
function FindArtistsTeaser({ onClick }) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1rem 1.5rem 0' }}>
      <button onClick={onClick} style={{
        width: '100%', background: 'transparent',
        border: `1px solid ${BRAND.pink}55`, borderRadius: '12px',
        padding: '1rem 1.2rem', cursor: 'pointer', fontFamily: FONT,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
            🔍 Find artists for your next lineup
          </div>
          <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.2rem' }}>
            Browse Grail artists open to bookings, sorted by local follower count.
          </div>
        </div>
        <div style={{ color: BRAND.pink, fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>→</div>
      </button>
    </div>
  )
}

// ─── FIND ARTISTS VIEW ───────────────────────────────────────────────────────
// Lists every artist with open_to_bookings=true, sorted by follower count
// desc. Click → /a/<handle> for full profile. V2 will add genre tags +
// geo-radius filtering, plus an "add to this event" action that wires
// directly into the existing invite-co-producer flow.
function FindArtists() {
  const [artists, setArtists] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, handle, artist_name, username, city, avatar_url, bio, artist_followers(id)')
        .eq('user_type', 'artist')
        .eq('open_to_bookings', true)
        .not('handle', 'is', null)
        .limit(200)
      if (cancelled) return
      const enriched = (data || [])
        .map(a => ({ ...a, follower_count: (a.artist_followers || []).length }))
        .sort((a, b) => b.follower_count - a.follower_count)
      setArtists(enriched)
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = q.trim()
    ? (artists || []).filter(a => {
        const needle = q.trim().toLowerCase()
        return (a.handle       || '').toLowerCase().includes(needle)
            || (a.artist_name  || '').toLowerCase().includes(needle)
            || (a.username     || '').toLowerCase().includes(needle)
            || (a.city         || '').toLowerCase().includes(needle)
      })
    : (artists || [])

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ color: C.textMid, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: '0.4rem' }}>
        Find artists
      </div>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: '0.4rem', lineHeight: 1.2 }}>
        Pick your next lineup.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.86rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>
        Every artist below opted in to be discoverable. Sorted by follower count — the higher the number, the more local fans you reach by booking them.
      </div>

      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name, @handle, or city…"
        style={{ ...INPUT, marginBottom: '1.25rem' }}
      />

      {artists === null
        ? <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '1rem 0' }}>Loading…</div>
        : filtered.length === 0
          ? <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '1.4rem', color: C.textMid, fontSize: '0.88rem', textAlign: 'center',
            }}>
              {q.trim()
                ? `No artists matching "${q.trim()}". Try a different name or city.`
                : 'No artists open to bookings yet. As more artists opt in, this directory fills up.'}
            </div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtered.map(a => (
                <a key={a.id} href={`/a/${a.handle}`} style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
                  padding: '0.85rem 1.1rem', textDecoration: 'none',
                }}>
                  {a.avatar_url ? (
                    <img
                      src={a.avatar_url}
                      alt=""
                      style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: BRAND.gradient, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#000', fontWeight: 900, fontSize: '0.95rem', flexShrink: 0,
                    }}>
                      {(a.artist_name || a.handle || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                      {a.artist_name || a.username || a.handle}
                    </div>
                    <div style={{ color: C.textMid, fontSize: '0.76rem' }}>
                      @{a.handle}{a.city ? ` · ${a.city}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: BRAND.neon, fontWeight: 800, fontSize: '1rem' }}>
                      {a.follower_count.toLocaleString()}
                    </div>
                    <div style={{ color: C.textMid, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      follower{a.follower_count === 1 ? '' : 's'}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
      }
    </div>
  )
}

// ─── FOLLOWERS STRIP ─────────────────────────────────────────────────────────
// Compact card showing how many people are subscribed to this promoter's
// announcements. Click to expand the list (emails + zip + radius).
function FollowersStrip({ promoterId }) {
  const [followers, setFollowers] = useState(null)   // null while loading
  const [expanded,  setExpanded]  = useState(false)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('promoter_followers')
        .select('id, email, name, zip, radius_miles, notified_at, created_at')
        .eq('promoter_id', promoterId)
        .order('created_at', { ascending: false })
      if (!cancelled) setFollowers(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [promoterId])

  const copyEmails = () => {
    const list = [...new Set((followers || []).map(f => f.email).filter(Boolean))]
    if (list.length === 0) return
    navigator.clipboard?.writeText(list.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (followers === null || followers.length === 0) return null

  return (
    <div style={{ padding: '1rem 1.5rem 0' }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '12px', padding: '0.85rem 1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'transparent', border: 'none', color: C.text,
              cursor: 'pointer', fontFamily: FONT, fontSize: '0.85rem',
              fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: 0,
            }}
          >
            <span style={{ color: BRAND.neon }}>{followers.length}</span>
            <span style={{ color: C.textMid, fontWeight: '600' }}>
              {followers.length === 1 ? 'follower' : 'followers'} · auto-emailed when you create new events
            </span>
            <span style={{ color: C.textDim }}>{expanded ? '▴' : '▾'}</span>
          </button>
          {expanded && (
            <button
              onClick={copyEmails}
              style={{
                background: 'transparent', color: copied ? BRAND.neon : C.textMid,
                border: `1px solid ${C.border}`, borderRadius: '6px',
                padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {copied ? '✓ Copied' : 'Copy emails'}
            </button>
          )}
        </div>

        {expanded && (
          <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.75rem' }}>
            {followers.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.4rem 0', fontSize: '0.8rem',
              }}>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: C.text, fontWeight: '700' }}>{f.name || '—'}</span>
                  <span style={{ color: C.textMid, marginLeft: '0.5rem' }}>{f.email}</span>
                </div>
                <div style={{ color: C.textDim, fontSize: '0.72rem', flexShrink: 0, marginLeft: '0.6rem' }}>
                  {f.zip ? `${f.zip} · ${f.radius_miles}mi` : `${f.radius_miles}mi`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
