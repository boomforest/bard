// Artist Portal — /artist
// MVP for the Artist Accounts module. Artists see their bookings (rows in
// event_producers where user_id = me AND role = 'Artist'), can Greenlight
// each one (signs + triggers the follower broadcast), toggle per-show
// "don't broadcast" before Greenlighting, and copy their affiliate link
// for each event.
//
// Reuses the same auth/styling primitives as PromoterDashboard.

import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'

function LoginPanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }
  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={LogoMark({ size: 56 })}>GRAIL</div>
        </div>
        <div style={{ ...eyebrowStyle(), textAlign: 'center' }}>Artist Portal</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: '1.4rem', textAlign: 'center', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
          Sign in
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input style={INPUT} type="email"    placeholder="Email"    value={email}    onChange={e => setEmail(e.target.value)} required />
          <input style={INPUT} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

function BookingCard({ booking, onChange, accessToken }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')

  const ev = booking.events
  const dateStr = ev?.show_date
    ? new Date(ev.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD'
  const venue = ev?.venue_hint || ev?.venue_address || ''
  const eventUrl = ev?.slug ? `${window.location.origin}/e/${ev.slug}?ref=artist:${booking.id}` : ''
  const sourceKey = `artist:${booking.id}`

  const greenlight = async () => {
    setBusy(true); setMsg('')
    try {
      const { error: upErr } = await supabase
        .from('event_producers')
        .update({ signed: true, signed_at: new Date().toISOString() })
        .eq('id', booking.id)
      if (upErr) throw upErr

      // Fire-and-forget broadcast — eligibility re-checked server-side.
      if (!booking.broadcast_disabled && accessToken) {
        try {
          const res = await fetch('/.netlify/functions/send-artist-greenlight-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ producer_id: booking.id, origin: window.location.origin }),
          })
          const data = await res.json().catch(() => ({}))
          if (data.ok) setMsg(data.sent ? `Greenlit · broadcast to ${data.sent} of ${data.total} followers` : 'Greenlit')
          else setMsg('Greenlit — broadcast retry needed')
        } catch { setMsg('Greenlit — broadcast retry needed') }
      } else {
        setMsg('Greenlit (broadcast disabled)')
      }
      onChange()
    } catch (e) {
      setMsg(e.message || 'Greenlight failed')
    }
    setBusy(false)
  }

  const toggleBroadcast = async () => {
    if (booking.signed) return  // can't toggle post-Greenlight in MVP
    setBusy(true)
    const { error } = await supabase
      .from('event_producers')
      .update({ broadcast_disabled: !booking.broadcast_disabled })
      .eq('id', booking.id)
    setBusy(false)
    if (!error) onChange()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(eventUrl); setMsg('Link copied') }
    catch { setMsg(eventUrl) }
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
      padding: '1.1rem 1.25rem', marginBottom: '0.85rem',
    }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', marginBottom: '0.25rem' }}>
        {ev?.name || ev?.artist_name || 'Untitled show'}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', marginBottom: '0.85rem' }}>
        {dateStr}{venue ? ` · ${venue}` : ''}{booking.split_pct ? ` · ${booking.split_pct}% split` : ''}
      </div>

      {!booking.signed && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.textMid, fontSize: '0.78rem', marginBottom: '0.7rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={booking.broadcast_disabled} onChange={toggleBroadcast} disabled={busy} />
            Don't broadcast this one to my followers
          </label>
          <button onClick={greenlight} disabled={busy} style={{ ...PRIMARY_BTN, width: '100%' }}>
            {busy ? 'Working…' : '✓ Greenlight booking'}
          </button>
        </>
      )}

      {booking.signed && (
        <>
          <div style={{ color: BRAND.neon, fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            ✓ Greenlit{booking.last_broadcast_at ? ' · Broadcast sent' : (booking.broadcast_disabled ? ' · Broadcast off' : '')}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.74rem', marginBottom: '0.3rem' }}>Your link</div>
          <div style={{
            background: '#0a0a10', border: `1px solid ${C.border}`, borderRadius: '8px',
            padding: '0.55rem 0.7rem', color: C.text, fontSize: '0.72rem',
            fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', marginBottom: '0.5rem',
          }}>{eventUrl}</div>
          <button onClick={copy} style={{
            background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem',
            fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          }}>
            Copy link
          </button>
          {booking.attributedCount != null && (
            <span style={{ marginLeft: '0.7rem', color: C.textMid, fontSize: '0.78rem' }}>
              Tickets via your link: <strong style={{ color: C.text }}>{booking.attributedCount}</strong>
            </span>
          )}
        </>
      )}

      {msg && <div style={{ marginTop: '0.6rem', color: C.textMid, fontSize: '0.76rem' }}>{msg}</div>}
    </div>
  )
}

export default function ArtistDashboard() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [bookings, setBookings] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    ;(async () => {
      const uid = session.user.id

      const { data: meRow } = await supabase
        .from('users')
        .select('id, username, handle, artist_name, user_type, broadcast_default')
        .eq('id', uid).maybeSingle()
      if (cancelled) return
      setMe(meRow)

      const { data: bks } = await supabase
        .from('event_producers')
        .select(`
          id, signed, signed_at, split_pct, role, broadcast_disabled, last_broadcast_at, event_id,
          events:event_id ( id, slug, name, artist_name, show_date, venue_hint, venue_address )
        `)
        .eq('user_id', uid)
        .eq('role', 'Artist')
        .order('signed_at', { ascending: false })
      if (cancelled) return

      // Attribution counts: tickets where source = 'artist:<producer_id>'.
      const enriched = await Promise.all((bks || []).map(async (b) => {
        const { count } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('source', `artist:${b.id}`)
          .eq('refunded', false)
        return { ...b, attributedCount: count ?? 0 }
      }))
      if (cancelled) return
      setBookings(enriched)

      const { count: fc } = await supabase
        .from('artist_followers')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', uid)
      if (cancelled) return
      setFollowerCount(fc ?? 0)
    })()
    return () => { cancelled = true }
  }, [session, refreshKey])

  const toggleBroadcastDefault = async () => {
    if (!me) return
    const next = !me.broadcast_default
    const { error } = await supabase.from('users').update({ broadcast_default: next }).eq('id', me.id)
    if (!error) setMe({ ...me, broadcast_default: next })
  }

  if (session === undefined) return <div style={{ ...PAGE, padding: '2rem', color: C.textMid }}>Loading…</div>
  if (!session) return <LoginPanel />

  const pending  = bookings.filter(b => !b.signed)
  const greenlit = bookings.filter(b =>  b.signed)
  const displayName = me?.artist_name || me?.username || me?.handle || 'Artist'

  return (
    <div style={{ ...PAGE, padding: '2rem 1.25rem', maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={LogoMark({ size: 44 })}>GRAIL</div>
        <button onClick={() => supabase.auth.signOut()} style={{
          background: 'transparent', border: 'none', color: C.textMid, fontSize: '0.78rem', cursor: 'pointer', fontFamily: FONT,
        }}>Sign out</button>
      </div>

      <div style={{ ...eyebrowStyle() }}>Artist Portal</div>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>
        {displayName}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '2rem' }}>
        {me?.handle ? `@${me.handle} · ` : ''}{followerCount} follower{followerCount === 1 ? '' : 's'}
      </div>

      <div style={{ ...eyebrowStyle(), marginTop: '1.5rem' }}>Pending your Greenlight</div>
      {pending.length === 0
        ? <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>Nothing pending.</div>
        : pending.map(b => <BookingCard key={b.id} booking={b} onChange={() => setRefreshKey(k => k + 1)} accessToken={session.access_token} />)
      }

      <div style={{ ...eyebrowStyle(), marginTop: '2rem' }}>Confirmed</div>
      {greenlit.length === 0
        ? <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>None yet.</div>
        : greenlit.map(b => <BookingCard key={b.id} booking={b} onChange={() => setRefreshKey(k => k + 1)} accessToken={session.access_token} />)
      }

      <div style={{ ...eyebrowStyle(), marginTop: '2rem' }}>Settings</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: C.text, fontSize: '0.88rem', marginTop: '0.5rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!me?.broadcast_default} onChange={toggleBroadcastDefault} />
        Auto-broadcast my Greenlights to followers in radius
      </label>
      <div style={{ color: C.textMid, fontSize: '0.74rem', marginTop: '0.3rem', marginLeft: '1.6rem' }}>
        When off, each booking is broadcast-disabled by default. You can still flip it per-show before Greenlighting.
      </div>
    </div>
  )
}
