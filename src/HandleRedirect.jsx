import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE } from './theme'
import { RESERVED_HANDLES } from './handleUtils'

// Resolves grail.mx/{handle} → /e/{slug-of-most-recent-upcoming-event}.
// If the promoter has no upcoming events, falls back to their most recent
// past event. If they have no events at all (or the handle isn't claimed),
// shows a small "not found" state.

export default function HandleRedirect() {
  const { handle } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function go() {
      // Defensive: don't even hit Supabase if it's a reserved word — it
      // won't be in the table anyway, but skip the round trip.
      if (RESERVED_HANDLES.has((handle || '').toLowerCase())) {
        if (!cancelled) setError(`@${handle} isn't a promoter handle.`)
        return
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('handle', handle)
        .maybeSingle()

      if (cancelled) return
      if (!user) {
        setError(`@${handle} hasn't claimed this handle yet.`)
        return
      }

      const { data: rows } = await supabase
        .from('events')
        .select('slug, show_date')
        .eq('promoter_id', user.id)
        .order('show_date', { ascending: false })
        .limit(20)

      if (cancelled) return
      const events = rows || []
      const now = Date.now()
      const dateOf = (e) => new Date(e.event_date || e.show_date || 0).getTime()
      const upcoming = events.filter(e => dateOf(e) >= now).sort((a, b) => dateOf(a) - dateOf(b))
      const target = upcoming[0] || events[0]

      if (!target?.slug) {
        setError(`@${handle} hasn't created an event yet.`)
        return
      }
      navigate(`/e/${target.slug}`, { replace: true })
    }
    go()
    return () => { cancelled = true }
  }, [handle, navigate])

  if (error) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Nothing here yet
          </div>
          <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>{error}</div>
          <a href="/" style={{
            display: 'inline-block', background: BRAND.gradient, color: '#000',
            border: 'none', borderRadius: '10px', padding: '0.85rem 1.5rem',
            fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none', fontFamily: FONT,
          }}>
            Home →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
    </div>
  )
}
