// Public artist profile — /a/:handle
// Lists the artist's upcoming Greenlit shows and a follow form. The
// follow form mirrors the promoter follow flow in EventPage.jsx —
// email + name + zip + radius, geocoded in the background so the
// artist_followers_in_event_radius RPC can filter properly.

import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'

function FollowForm({ artistId, artistName }) {
  const [open, setOpen]           = useState(false)
  const [done, setDone]           = useState(false)
  const [email, setEmail]         = useState('')
  const [name, setName]           = useState('')
  const [zip, setZip]             = useState('')
  const [radius, setRadius]       = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]             = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setSubmitting(true)
    const { data: inserted, error } = await supabase
      .from('artist_followers')
      .upsert(
        {
          artist_id:    artistId,
          email:        email.trim(),
          name:         name.trim() || null,
          zip:          zip.trim() || null,
          radius_miles: parseInt(radius, 10) || 25,
          lang:         (navigator.language || 'es').startsWith('en') ? 'en' : 'es',
        },
        { onConflict: 'artist_id,email', ignoreDuplicates: false },
      )
      .select('id')
    setSubmitting(false)
    if (error) { setErr(error.message); return }

    // Background geocode so future blasts can radius-filter.
    if (zip.trim()) {
      const followerId = inserted?.[0]?.id
      fetch('/.netlify/functions/geocode-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip: zip.trim(), country: 'mx' }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(async geo => {
          if (geo?.lat != null && geo?.lng != null && followerId) {
            await supabase.from('artist_followers')
              .update({ lat: geo.lat, lng: geo.lng })
              .eq('id', followerId)
          }
        })
        .catch(() => {})
    }
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        background: C.card, border: `1px solid ${BRAND.neon}55`, borderRadius: '14px',
        padding: '1.25rem 1.4rem', marginTop: '1.5rem', textAlign: 'center',
      }}>
        <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
          You're following {artistName}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5 }}>
          You'll get an email when they confirm a show within {radius} miles of your zip.
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        marginTop: '1.5rem', width: '100%',
        background: 'transparent', border: `1px solid ${C.border}`,
        color: C.textMid, borderRadius: '12px',
        padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 700,
        cursor: 'pointer', fontFamily: FONT,
      }}>
        Follow {artistName} →
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
      padding: '1.25rem 1.4rem', marginTop: '1.5rem',
    }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
        Follow {artistName}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
        We'll email you when they confirm a show near your zip.
      </div>
      <input style={{ ...INPUT, marginBottom: '0.5rem' }} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input style={{ ...INPUT, marginBottom: '0.5rem' }} type="text"  placeholder="Your name (optional)" value={name}  onChange={e => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <input style={{ ...INPUT, flex: 1 }} type="text" placeholder="Zip" value={zip} onChange={e => setZip(e.target.value)} />
        <input style={{ ...INPUT, width: '90px' }} type="number" min="1" max="500" value={radius} onChange={e => setRadius(e.target.value)} />
        <span style={{ color: C.textMid, fontSize: '0.78rem', alignSelf: 'center' }}>mi</span>
      </div>
      {err && <div style={{ color: BRAND.orange, fontSize: '0.78rem', marginBottom: '0.5rem' }}>{err}</div>}
      <button type="submit" disabled={submitting} style={{ ...PRIMARY_BTN, width: '100%' }}>
        {submitting ? 'Following…' : `Follow ${artistName}`}
      </button>
    </form>
  )
}

export default function ArtistProfile() {
  const { handle } = useParams()
  const [artist, setArtist]   = useState(undefined)  // undefined = loading, null = not found
  const [shows, setShows]     = useState([])
  const [viewer, setViewer]   = useState(null)       // { user_type, access_token } of the visiting user

  // Identify the visitor so we can show promoter-only CTAs.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || cancelled) { setViewer(null); return }
      const { data: me } = await supabase
        .from('users')
        .select('id, user_type')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!cancelled) setViewer({ ...me, access_token: session.access_token })
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id, username, handle, artist_name, user_type, bio, avatar_url')
        .eq('handle', handle).maybeSingle()
      if (cancelled) return
      if (!user || user.user_type !== 'artist') {
        setArtist(null); return
      }
      setArtist(user)

      // Upcoming Greenlit shows: producer rows for this artist where
      // signed=true, joined to events with show_date >= today.
      const today = new Date().toISOString().slice(0, 10)
      const { data: rows } = await supabase
        .from('event_producers')
        .select(`
          id, signed, signed_at,
          events:event_id ( id, slug, name, artist_name, show_date, venue_hint, venue_address )
        `)
        .eq('user_id', user.id)
        .eq('role', 'Artist')
        .eq('signed', true)
        .order('signed_at', { ascending: false })
      if (cancelled) return

      const upcoming = (rows || [])
        .filter(r => r.events?.show_date && r.events.show_date >= today)
        .sort((a, b) => (a.events.show_date || '').localeCompare(b.events.show_date || ''))
      setShows(upcoming)
    })()
    return () => { cancelled = true }
  }, [handle])

  if (artist === undefined) {
    return <div style={{ ...PAGE, padding: '2rem', color: C.textMid }}>Loading…</div>
  }

  if (artist === null) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Nothing here yet
          </div>
          <div style={{ color: C.textMid, fontSize: '0.88rem' }}>
            @{handle} isn't an artist on GRAIL.
          </div>
        </div>
      </div>
    )
  }

  const displayName = artist.artist_name || artist.username || artist.handle

  return (
    <div style={{ ...PAGE, padding: '2rem 1.25rem', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div style={LogoMark({ size: 44 })}>GRAIL</div>
      </div>

      {artist.avatar_url && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <img
            src={artist.avatar_url}
            alt=""
            style={{
              width: 110, height: 110, borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${C.border}`,
            }}
          />
        </div>
      )}

      <div style={{ ...eyebrowStyle(), textAlign: 'center' }}>Artist</div>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em', textAlign: 'center' }}>
        {displayName}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', marginBottom: artist.bio ? '1rem' : '2rem' }}>
        @{artist.handle}
      </div>

      {artist.bio && (
        <div style={{
          color: C.text, fontSize: '0.92rem', lineHeight: 1.6, textAlign: 'center',
          marginBottom: '2rem', padding: '0 0.5rem',
        }}>
          {artist.bio}
        </div>
      )}

      <div style={{ ...eyebrowStyle() }}>Upcoming</div>
      {shows.length === 0
        ? <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '1rem' }}>No confirmed shows yet.</div>
        : shows.map(s => {
            const ev = s.events
            const dateStr = new Date(ev.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            const venue = ev.venue_hint || ev.venue_address || ''
            return (
              <a key={s.id} href={`/e/${ev.slug}?ref=artist:${s.id}`} style={{
                display: 'block', textDecoration: 'none',
                background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
                padding: '0.9rem 1.1rem', marginBottom: '0.7rem',
              }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                  {ev.name || ev.artist_name || 'Show'}
                </div>
                <div style={{ color: C.textMid, fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  {dateStr}{venue ? ` · ${venue}` : ''}
                </div>
              </a>
            )
          })
      }

      {viewer?.user_type === 'promoter' && viewer.id !== artist.id && (
        <BookArtistButton
          artist={artist}
          artistName={displayName}
          accessToken={viewer.access_token}
        />
      )}

      <FollowForm artistId={artist.id} artistName={displayName} />
    </div>
  )
}

// ─── Book this artist ───────────────────────────────────────────────────────
// Shown only to logged-in promoters viewing an artist's public profile.
// Click → modal with the promoter's open (not-yet-greenlit) events that
// don't already include this artist. Pick one, set split %, submit →
// invite-co-producer fires with artist_user_id (email looked up server-side).
function BookArtistButton({ artist, artistName, accessToken }) {
  const [open, setOpen]           = useState(false)
  const [events, setEvents]       = useState(null)
  const [selectedId, setSelected] = useState('')
  const [split, setSplit]         = useState(25)
  const [busy, setBusy]           = useState(false)
  const [msg, setMsg]             = useState('')
  const [done, setDone]           = useState(false)

  useEffect(() => {
    if (!open || events !== null) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      // Pull this promoter's not-yet-greenlit events, minus the ones
      // that already have this artist on the lineup.
      const { data: evs } = await supabase
        .from('events')
        .select(`
          id, slug, name, artist_name, show_date, greenlit_at,
          event_producers!event_producers_event_id_fkey ( user_id )
        `)
        .eq('promoter_id', session.user.id)
        .is('greenlit_at', null)
        .order('show_date', { ascending: true })
        .limit(50)
      if (cancelled) return
      const filtered = (evs || []).filter(ev => {
        const hasArtist = (ev.event_producers || []).some(p => p.user_id === artist.id)
        return !hasArtist
      })
      setEvents(filtered)
    })()
    return () => { cancelled = true }
  }, [open, events, artist.id])

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedId) { setMsg('Pick an event first'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/.netlify/functions/invite-co-producer', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          event_id:       selectedId,
          artist_user_id: artist.id,
          role:           'Artist',
          split_pct:      Number(split),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setDone(true)
    } catch (err) {
      setMsg(err.message)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div style={{
        background: `${BRAND.neon}11`, border: `1px solid ${BRAND.neon}55`,
        borderRadius: '14px', padding: '1.1rem 1.3rem', marginTop: '1.5rem',
      }}>
        <div style={{ color: BRAND.neon, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '0.35rem' }}>
          Invite sent
        </div>
        <div style={{ color: C.text, fontSize: '0.9rem', lineHeight: 1.5 }}>
          {artistName} has been added to the lineup. They'll get an email and need to Greenlight before the contract locks.
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        marginTop: '1.5rem', width: '100%',
        background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '12px',
        padding: '0.95rem 1rem', fontSize: '0.92rem', fontWeight: 800,
        cursor: 'pointer', fontFamily: FONT,
      }}>
        Book {artistName} for one of your shows →
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
      padding: '1.25rem 1.4rem', marginTop: '1.5rem',
    }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
        Book {artistName}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
        Pick one of your upcoming shows. They'll get an email to confirm — once they Greenlight, the contract locks.
      </div>

      {events === null ? (
        <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '0.5rem 0' }}>Loading your events…</div>
      ) : events.length === 0 ? (
        <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '0.5rem 0' }}>
          No open events to book them on. Either every event is greenlit, or {artistName} is already on every lineup.
        </div>
      ) : (
        <select
          value={selectedId}
          onChange={e => setSelected(e.target.value)}
          style={{ ...INPUT, marginBottom: '0.5rem' }}
          required
        >
          <option value="">Pick an event…</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name || ev.artist_name || 'Untitled'} · {ev.show_date ? new Date(ev.show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
            </option>
          ))}
        </select>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.85rem' }}>
        <span style={{ color: C.textMid, fontSize: '0.82rem' }}>Split %</span>
        <input
          type="number" min="0" max="100" step="1"
          value={split}
          onChange={e => setSplit(e.target.value)}
          style={{ ...INPUT, width: '90px' }}
          required
        />
        <span style={{ color: C.textDim, fontSize: '0.72rem' }}>
          (their cut of net revenue — adjustable until everyone signs)
        </span>
      </div>

      {msg && <div style={{ color: BRAND.orange, fontSize: '0.78rem', marginBottom: '0.5rem' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={busy || !events?.length} style={{
          flex: 1,
          background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
          padding: '0.7rem 1rem', fontSize: '0.88rem', fontWeight: 800,
          cursor: busy ? 'wait' : 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Sending invite…' : 'Send invite'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg('') }} style={{
          background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: '10px',
          padding: '0.7rem 1rem', fontSize: '0.85rem', cursor: 'pointer', fontFamily: FONT,
        }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
