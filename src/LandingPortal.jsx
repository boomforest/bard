// LandingPortal — three-tab explainer + apply / discover surface for
// unauthenticated visitors. Embedded inside GrailHome.
//
// Tabs:
//   PROMOTER — what promoter accounts do, feature cards, mock dashboard,
//              Apply → /request-access?kind=promoter
//   ARTIST   — what artist accounts do, feature cards, mock dashboard,
//              Apply → /request-access?kind=artist
//   FAN      — artist directory (users with user_type='artist' + handle),
//              search, suggestion form on empty-search states
//
// Style follows GrailDemo aesthetic: dark cards, eyebrow labels in uppercase
// neon / orange, gradient CTAs, mini-mockups stylized as fake dashboards.

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN } from './theme'
import ArtistMap from './ArtistMap'
import PromoterCommunityViz from './PromoterCommunityViz'

const TABS = [
  { key: 'promoter', label: 'Promoter' },
  { key: 'artist',   label: 'Artist'   },
  { key: 'fan',      label: 'Fan'      },
]

// Loads the current authenticated user's profile row. Returns:
//   undefined → still loading
//   null      → no session (anonymous visitor)
//   object    → users-table row (id, user_type, etc.)
// Tab components branch on user.user_type to show either the explainer-
// plus-Apply flow (default) or the role-specific status widget.
function useCurrentUser() {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    let cancelled = false
    const load = async (session) => {
      if (!session?.user) { if (!cancelled) setUser(null); return }
      const { data } = await supabase
        .from('users')
        .select('id, user_type, username, handle, artist_name')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!cancelled) setUser(data || null)
    }
    supabase.auth.getSession().then(({ data: { session } }) => load(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => load(s))
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])
  return user
}

// Feature cards are intentionally minimal here — the real pitch lives in
// the PromoterCommunityViz / ArtistMap callouts above them. These cards
// just hint at the texture of the tool without devolving into a feature
// dump. The mocks below show what the tool actually looks like in use.

function Tab({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '0.75rem 0.5rem', cursor: 'pointer',
      background: active ? `linear-gradient(135deg, ${BRAND.pink}22, ${BRAND.orange}22)` : 'transparent',
      color: active ? C.text : C.textMid,
      border: 'none', borderBottom: `2px solid ${active ? BRAND.pink : 'transparent'}`,
      fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.01em', fontFamily: FONT,
      transition: 'all 0.15s ease',
    }}>
      {label}
    </button>
  )
}

function Eyebrow({ children, color }) {
  return (
    <div style={{
      fontSize: '0.68rem', color: color || BRAND.neon, textTransform: 'uppercase',
      letterSpacing: '0.18em', fontWeight: 800, marginBottom: '0.5rem',
    }}>{children}</div>
  )
}

// ── Mock dashboard previews ─────────────────────────────────────────────────

function PromoterMock() {
  return (
    <div style={{
      background: '#0a0a10', border: `1px solid ${C.border}`, borderRadius: '14px',
      padding: '1.1rem 1.2rem', marginTop: '1rem',
    }}>
      <Eyebrow color={BRAND.orange}>Your dashboard</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', marginBottom: '0.85rem' }}>
        Astral · May 30
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginBottom: '0.85rem' }}>
        <MiniStat label="Sold"    value="184 / 250" />
        <MiniStat label="Revenue" value="$4,830"   accent={BRAND.orange} />
        <MiniStat label="Greenlit" value="4 of 5"  accent={BRAND.neon} />
      </div>
      <div style={{ color: C.textMid, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
        Contract
      </div>
      <ContractRow name="Hilda"          role="Artist"   split="35%" signed />
      <ContractRow name="Espacio Dengue" role="Venue"    split="30%" signed />
      <ContractRow name="Sound Co."      role="Sound"    split="20%" signed />
      <ContractRow name="You"            role="Promoter" split="15%" signed={false} />
    </div>
  )
}

function ArtistMock() {
  return (
    <div style={{
      background: '#0a0a10', border: `1px solid ${C.border}`, borderRadius: '14px',
      padding: '1.1rem 1.2rem', marginTop: '1rem',
    }}>
      <Eyebrow color={BRAND.pink}>Your bookings</Eyebrow>
      <div style={{
        background: C.card, border: `1px solid ${BRAND.neon}33`, borderRadius: '10px',
        padding: '0.85rem 1rem', marginBottom: '0.6rem',
      }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
          Astral · May 30
        </div>
        <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.6rem' }}>
          Espacio Dengue · 35% split
        </div>
        <div style={{
          display: 'inline-block', padding: '0.3rem 0.7rem', borderRadius: '6px',
          background: `${BRAND.neon}1a`, color: BRAND.neon, fontSize: '0.7rem',
          fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          ✓ Greenlit · Broadcast sent to 47
        </div>
      </div>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
        padding: '0.85rem 1rem', marginBottom: '0.6rem',
      }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
          Equinoccio · Jun 18
        </div>
        <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.6rem' }}>
          Foro Indie Rocks · 25% split
        </div>
        <div style={{
          display: 'inline-block', padding: '0.35rem 0.85rem', borderRadius: '7px',
          background: BRAND.gradient, color: '#000', fontSize: '0.75rem', fontWeight: 800,
        }}>
          ✓ Greenlight booking
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0.55rem 0.7rem' }}>
      <div style={{ fontSize: '0.6rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ color: accent || C.text, fontSize: '0.9rem', fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function ContractRow({ name, role, split, signed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.4rem 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ flex: 2, color: C.text, fontSize: '0.82rem', fontWeight: 700 }}>{name}</div>
      <div style={{ flex: 1, color: C.textMid, fontSize: '0.72rem' }}>{role}</div>
      <div style={{ width: '50px', color: C.textMid, fontSize: '0.78rem', textAlign: 'right' }}>{split}</div>
      <div style={{
        width: '70px', textAlign: 'center',
        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: signed ? BRAND.neon : C.textMid,
      }}>
        {signed ? '✓ Signed' : 'Pending'}
      </div>
    </div>
  )
}

// ── Fan tab: directory + search + suggestion ────────────────────────────────

function FanTab() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Suggested artists: anyone with user_type='artist' and a handle.
      // Order by created_at desc as a stand-in for "newest" — when there
      // are enough artists this becomes ordered by follower count or
      // recent activity, but MVP keeps it simple.
      const { data } = await supabase
        .from('users')
        .select('id, handle, username, artist_name, avatar_url')
        .eq('user_type', 'artist')
        .not('handle', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60)
      if (!cancelled) {
        setArtists(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = q.trim()
    ? artists.filter(a => {
        const needle = q.trim().toLowerCase()
        return (a.handle || '').toLowerCase().includes(needle)
            || (a.artist_name || '').toLowerCase().includes(needle)
            || (a.username || '').toLowerCase().includes(needle)
      })
    : artists

  const noResults = q.trim() && filtered.length === 0

  return (
    <div>
      <Eyebrow color={BRAND.pink}>Discover</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '0.6rem' }}>
        Follow the artists you love
      </div>
      <div style={{ color: C.textMid, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        Get a personal email when one of them confirms a show within your radius. No feeds, no algorithms — just the artists you actually want to hear from.
      </div>

      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search artists by name or @handle…"
        style={{ ...INPUT, marginBottom: '1rem' }}
      />

      {loading
        ? <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '1rem 0' }}>Loading…</div>
        : noResults
          ? <ArtistNotFound query={q.trim()} />
          : (
            <>
              {!q.trim() && (
                <div style={{ color: C.textMid, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                  Suggested artists
                </div>
              )}
              {filtered.length === 0
                ? <div style={{ color: C.textMid, fontSize: '0.88rem', padding: '1rem 0' }}>
                    No artists on GRAIL yet. Be the first to <a href="/join" style={{ color: BRAND.pink, textDecoration: 'none', fontWeight: 700 }}>sign up</a>.
                  </div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filtered.map(a => (
                      <a key={a.id} href={`/a/${a.handle}`} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
                        padding: '0.75rem 1rem', textDecoration: 'none',
                      }}>
                        {a.avatar_url ? (
                          <img
                            src={a.avatar_url}
                            alt=""
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: BRAND.gradient, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            color: '#000', fontWeight: 900, fontSize: '0.85rem',
                            flexShrink: 0,
                          }}>
                            {(a.artist_name || a.handle || '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: C.text, fontWeight: 700, fontSize: '0.92rem' }}>
                            {a.artist_name || a.username || a.handle}
                          </div>
                          <div style={{ color: C.textMid, fontSize: '0.76rem' }}>@{a.handle}</div>
                        </div>
                        <div style={{ color: BRAND.pink, fontSize: '0.78rem', fontWeight: 700 }}>Follow →</div>
                      </a>
                    ))}
                  </div>
                )
              }
            </>
          )
      }
    </div>
  )
}

function ArtistNotFound({ query }) {
  const [name,  setName]  = useState(query)
  const [email, setEmail] = useState('')
  const [note,  setNote]  = useState('')
  const [done,  setDone]  = useState(false)
  const [busy,  setBusy]  = useState(false)
  const [err,   setErr]   = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase
      .from('artist_suggestions')
      .insert({
        artist_name:        name.trim(),
        suggested_by_email: email.trim() || null,
        note:               note.trim() || null,
      })
    setBusy(false)
    if (error) setErr(error.message)
    else setDone(true)
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
      padding: '1.4rem 1.3rem', marginTop: '0.5rem',
    }}>
      <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
        We're still building this out.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.86rem', lineHeight: 1.6, marginBottom: '1rem' }}>
        If there's an artist you'd like to see on GRAIL, let them know — or drop it in our suggestion box and we'll reach out:
      </div>
      {done ? (
        <div style={{
          background: `${BRAND.neon}11`, border: `1px solid ${BRAND.neon}44`,
          borderRadius: '10px', padding: '0.9rem 1.1rem', color: C.text,
          fontSize: '0.88rem', textAlign: 'center', fontWeight: 700,
        }}>
          Got it. Thanks for the suggestion 🕊
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input style={INPUT} type="text"  value={name}  onChange={e => setName(e.target.value)} placeholder="Artist name" required />
          <input style={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email (so we can let you know when they join)" />
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Anything we should know? (city they're based, contact info, etc.)"
            rows={3}
            style={{ ...INPUT, resize: 'vertical', minHeight: '70px', lineHeight: 1.5 }}
          />
          {err && <div style={{ color: BRAND.orange, fontSize: '0.78rem' }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ ...PRIMARY_BTN, marginTop: '0.4rem', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Sending…' : 'Suggest this artist'}
          </button>
        </form>
      )}
    </div>
  )
}

// ── Tab content ─────────────────────────────────────────────────────────────

// Status widget shown to approved promoters in the Promoter tab.
// Lists their most recent events with quick stats + a deep-link into
// the full promoter dashboard.
function PromoterStatusWidget({ user, navigate }) {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, slug, name, artist_name, show_date, capacity, tickets_sold, greenlit_at')
        .eq('promoter_id', user.id)
        .order('show_date', { ascending: false })
        .limit(5)
      if (!cancelled) setEvents(data || [])
    })()
    return () => { cancelled = true }
  }, [user.id])

  const displayName = user.artist_name || user.username || user.handle || 'Promoter'
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (events || []).filter(e => (e.show_date || '') >= today)
  const past     = (events || []).filter(e => (e.show_date || '') <  today)

  return (
    <div>
      <Eyebrow color={BRAND.orange}>Your promoter portal</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
        Welcome back, {displayName}.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>
        Your shows at a glance. Open the full dashboard for contracts, settlement, and edits.
      </div>

      {events === null ? (
        <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '0.8rem 0' }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '1.1rem 1.25rem', color: C.textMid, fontSize: '0.88rem', textAlign: 'center', marginBottom: '0.9rem',
        }}>
          No shows yet. Hit the dashboard to design your first sunrise.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div style={{ color: C.textMid, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                Upcoming
              </div>
              {upcoming.slice(0, 3).map(ev => <EventStatRow key={ev.id} ev={ev} navigate={navigate} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <div style={{ color: C.textMid, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1rem 0 0.5rem' }}>
                Recent
              </div>
              {past.slice(0, 3).map(ev => <EventStatRow key={ev.id} ev={ev} navigate={navigate} />)}
            </>
          )}
        </>
      )}

      <button onClick={() => navigate('/promoter')} style={{ ...PRIMARY_BTN, width: '100%', marginTop: '1.25rem' }}>
        Open promoter dashboard →
      </button>
    </div>
  )
}

function EventStatRow({ ev, navigate }) {
  const dateStr = ev.show_date
    ? new Date(ev.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD'
  const sold = ev.tickets_sold || 0
  const cap  = ev.capacity || 0
  const pct  = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0
  return (
    <a
      onClick={() => navigate(`/promoter/event/${ev.slug}`)}
      style={{
        display: 'block', cursor: 'pointer', textDecoration: 'none',
        background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
        padding: '0.85rem 1rem', marginBottom: '0.55rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
          {ev.name || ev.artist_name || 'Untitled'}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.78rem' }}>{dateStr}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontSize: '0.78rem' }}>
        <div style={{ color: C.textMid }}>
          <strong style={{ color: C.text }}>{sold}</strong>{cap > 0 ? <>{' / '}{cap}</> : ''} sold
        </div>
        {cap > 0 && (
          <div style={{ flex: 1, height: '4px', background: '#1a1a24', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: BRAND.gradient }} />
          </div>
        )}
        <div style={{
          fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: ev.greenlit_at ? BRAND.neon : C.textMid,
        }}>
          {ev.greenlit_at ? '✓ Greenlit' : 'Pending'}
        </div>
      </div>
    </a>
  )
}

function PromoterTab({ navigate, user }) {
  // Approved promoter → status widget. Everyone else → the explainer + Apply.
  if (user?.user_type === 'promoter') {
    return <PromoterStatusWidget user={user} navigate={navigate} />
  }
  return (
    <div>
      <Eyebrow color={BRAND.orange}>Promoter</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em', marginBottom: '0.6rem', lineHeight: 1.15 }}>
        Build your scene.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        Throw a show on Grail and you're not just running an event — you're building a community that compounds. Every fan you bring follows you. Every artist you book grows their following because of the night you gave them. The scene you build is yours, for life.
      </div>

      <PromoterCommunityViz />

      <PromoterMock />

      <button onClick={() => navigate('/request-access?kind=promoter')} style={{ ...PRIMARY_BTN, width: '100%', marginTop: '1.5rem' }}>
        Apply to become a promoter →
      </button>
      <div style={{ color: C.textDim, fontSize: '0.72rem', textAlign: 'center', marginTop: '0.5rem' }}>
        We approve promoters individually right now — keeps the scene tight while we're early.
      </div>
    </div>
  )
}

// Status widget shown to approved artists in the Artist tab. Pending
// Greenlights are surfaced prominently because they're the next-action
// the artist needs to take.
function ArtistStatusWidget({ user, navigate }) {
  const [bookings, setBookings] = useState(null)
  const [followerCount, setFollowerCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: bks } = await supabase
        .from('event_producers')
        .select(`
          id, signed, signed_at, last_broadcast_at,
          events:event_id ( id, slug, name, artist_name, show_date, venue_hint )
        `)
        .eq('user_id', user.id)
        .eq('role', 'Artist')
        .order('signed_at', { ascending: false })
        .limit(10)
      if (!cancelled) setBookings(bks || [])

      const { count } = await supabase
        .from('artist_followers')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', user.id)
      if (!cancelled) setFollowerCount(count ?? 0)
    })()
    return () => { cancelled = true }
  }, [user.id])

  const displayName = user.artist_name || user.username || user.handle || 'Artist'
  const pending   = (bookings || []).filter(b => !b.signed)
  const confirmed = (bookings || []).filter(b =>  b.signed)

  return (
    <div>
      <Eyebrow color={BRAND.pink}>Your artist portal</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
        Welcome back, {displayName}.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>
        {followerCount === null ? '' : `${followerCount} follower${followerCount === 1 ? '' : 's'} · `}
        Greenlight bookings + share your affiliate links from the full dashboard.
      </div>

      {bookings === null ? (
        <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '0.8rem 0' }}>Loading…</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{
              background: `${BRAND.orange}10`, border: `1px solid ${BRAND.orange}66`,
              borderRadius: '12px', padding: '1rem 1.2rem', marginBottom: '0.85rem',
            }}>
              <div style={{ color: BRAND.orange, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '0.4rem' }}>
                {pending.length} pending your Greenlight
              </div>
              {pending.slice(0, 2).map(b => (
                <div key={b.id} style={{ color: C.text, fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                  {b.events?.name || b.events?.artist_name || 'Booking'} · {b.events?.show_date
                    ? new Date(b.events.show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'TBD'}
                </div>
              ))}
            </div>
          )}

          {confirmed.length > 0 && (
            <>
              <div style={{ color: C.textMid, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                Confirmed
              </div>
              {confirmed.slice(0, 3).map(b => (
                <div key={b.id} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
                  padding: '0.75rem 1rem', marginBottom: '0.5rem',
                }}>
                  <div style={{ color: C.text, fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {b.events?.name || b.events?.artist_name || 'Show'}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '0.76rem' }}>
                    {b.events?.show_date ? new Date(b.events.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                    {b.events?.venue_hint ? ` · ${b.events.venue_hint}` : ''}
                    {b.last_broadcast_at ? ' · Broadcast sent' : ''}
                  </div>
                </div>
              ))}
            </>
          )}

          {pending.length === 0 && confirmed.length === 0 && (
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '1.1rem 1.25rem', color: C.textMid, fontSize: '0.88rem', textAlign: 'center', marginBottom: '0.9rem',
            }}>
              No bookings yet. Once a promoter adds you to a lineup, you'll see it here.
            </div>
          )}
        </>
      )}

      <button onClick={() => navigate('/artist')} style={{ ...PRIMARY_BTN, width: '100%', marginTop: '1.25rem' }}>
        Open artist dashboard →
      </button>
    </div>
  )
}

function ArtistTab({ navigate, user }) {
  if (user?.user_type === 'artist') {
    return <ArtistStatusWidget user={user} navigate={navigate} />
  }
  return (
    <div>
      <Eyebrow color={BRAND.pink}>Artist</Eyebrow>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em', marginBottom: '0.6rem', lineHeight: 1.15 }}>
        Build the audience you keep.
      </div>
      <div style={{ color: C.textMid, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        Every show you play on Grail recruits followers who stay followed — for life. The audience you build doesn't just come back to your shows. It makes promoters want to book you. We never message your followers outside the radius they chose; the relationship is yours, not the platform's.
      </div>

      <ArtistMap />

      <ArtistMock />

      <button onClick={() => navigate('/request-access?kind=artist')} style={{ ...PRIMARY_BTN, width: '100%', marginTop: '1.5rem' }}>
        Apply to become an artist →
      </button>
      <div style={{ color: C.textDim, fontSize: '0.72rem', textAlign: 'center', marginTop: '0.5rem' }}>
        Same approval flow as promoters — keeps the directory tight while we're early.
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function LandingPortal() {
  const navigate = useNavigate()
  const user = useCurrentUser()

  // Default tab follows the user's role so a logged-in promoter lands on
  // their portal, an artist on theirs, and anyone else on the Fan tab.
  // Anonymous visitors default to Promoter (the most "what is this?" intro).
  const defaultTab =
    user?.user_type === 'artist'   ? 'artist'
  : user?.user_type === 'promoter' ? 'promoter'
  : user?.user_type === 'fan'      ? 'fan'
  : 'promoter'

  const [tab, setTab] = useState(defaultTab)
  const [touched, setTouched] = useState(false)
  // Once user loads, re-default the tab — but only if they haven't already
  // clicked one themselves (touched=true means manual override).
  useEffect(() => {
    if (user !== undefined && !touched) setTab(defaultTab)
  }, [user, defaultTab, touched])

  const selectTab = (k) => { setTouched(true); setTab(k) }

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex', background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem',
      }}>
        {TABS.map(t => (
          <Tab key={t.key} active={tab === t.key} label={t.label} onClick={() => selectTab(t.key)} />
        ))}
      </div>

      {tab === 'promoter' && <PromoterTab navigate={navigate} user={user} />}
      {tab === 'artist'   && <ArtistTab   navigate={navigate} user={user} />}
      {tab === 'fan'      && <FanTab />}
    </div>
  )
}
