import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, badgeStyle } from './theme'
import { validateHandle } from './handleUtils'

const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PromoterEvents({ promoterId, onNew, onCheckStripe, stripeReady }) {
  const navigate = useNavigate()
  const [events,    setEvents]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [hideBusy,  setHideBusy]  = useState('')

  // Reload helper so Hide/Unhide can refresh without remounting
  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('events')
      .select('id, name, artist_name, slug, show_date, capacity, tickets_sold, status, flyer_url, hidden')
      .eq('promoter_id', promoterId)
      // Most recent show date first; nulls last so dateless drafts don't
      // pin themselves to the top.
      .order('show_date', { ascending: false, nullsFirst: false })
    if (!showHidden) q = q.eq('hidden', false)
    const { data } = await q
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!promoterId) return
    let cancelled = false
    ;(async () => {
      await load()
      if (cancelled) return
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoterId, showHidden])

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  const toggleHidden = async (ev) => {
    setHideBusy(ev.id)
    await supabase.from('events').update({ hidden: !ev.hidden }).eq('id', ev.id)
    await load()
    setHideBusy('')
  }

  return (
    <div style={{ ...PAGE, padding: '2rem 1.5rem 4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={eyebrowStyle()}>Promoter</div>
            <div style={{ color: C.text, fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.02em' }}>Your Events</div>
          </div>
          <button onClick={onNew} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.7rem 1.2rem', fontSize: '0.88rem', fontWeight: '800',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            + New Event
          </button>
        </div>

        {/* Show hidden events toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            onClick={() => setShowHidden(v => !v)}
            style={{
              background: 'transparent', border: 'none', color: C.textMid,
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: FONT, padding: '0.2rem 0',
            }}
          >
            {showHidden ? '↓ Hiding hidden events' : '↑ Show hidden events'}
          </button>
        </div>

        {/* Promoter handle */}
        <HandleCard promoterId={promoterId} />

        {/* Stripe status banner */}
        {stripeReady === false && (
          <div style={{
            background: 'rgba(240,112,32,0.08)',
            border: `1px solid ${BRAND.orange}55`,
            borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          }}>
            <div>
              <div style={{ color: C.text, fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                Connect Stripe to start selling tickets.
              </div>
              <div style={{ color: C.textMid, fontSize: '0.8rem' }}>
                Until your account is connected, the Checkout button on your event pages stays disabled.
              </div>
            </div>
            <button onClick={onCheckStripe} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '8px',
              padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer',
              fontFamily: FONT, flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              Connect →
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', fontSize: '2rem', opacity: 0.4 }}>🕊</div>
        ) : events.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.5 }}>🕊</div>
            <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              No events yet.
            </div>
            <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Build your first show to start selling tickets.
            </div>
            <button onClick={onNew} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
              padding: '0.85rem 1.75rem', fontSize: '0.95rem', fontWeight: '800',
              cursor: 'pointer', fontFamily: FONT,
            }}>
              + New Event
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {events.map(ev => {
              const date = ev.show_date || ev.event_date
              const isPast = date && new Date(date) < new Date()
              const origin    = window.location.origin
              const eventLink = `${origin}/e/${ev.slug}`
              const barLink   = `${origin}/${ev.slug}/bar`
              const staffLink = `${origin}/${ev.slug}/bar/staff`
              const dovesLink = `${origin}/${ev.slug}/doves`
              const scanLink  = `${origin}/scan/${ev.slug}`
              const sold = ev.tickets_sold || 0
              const cap = ev.capacity || 0

              const linkRow = [
                { label: 'Public',      url: eventLink, key: `ev-${ev.id}` },
                { label: 'Bar (fans)',  url: barLink,   key: `bar-${ev.id}` },
                { label: 'Bar staff',   url: staffLink, key: `staff-${ev.id}` },
                { label: 'Doves menu',  url: dovesLink, key: `dov-${ev.id}` },
                { label: 'Door scan',   url: scanLink,  key: `sc-${ev.id}` },
              ]

              return (
                <div key={ev.id} style={{
                  background: C.card, border: `1px solid ${ev.hidden ? '#1a1a1a' : C.border}`,
                  borderRadius: '14px', overflow: 'hidden',
                  opacity: ev.hidden ? 0.55 : 1,
                }}>
                  <button
                    onClick={() => navigate(`/promoter/event/${ev.slug}`)}
                    style={{
                      display: 'flex', gap: '1rem', padding: '1rem 1.25rem', width: '100%',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontFamily: FONT,
                    }}
                  >
                    {ev.flyer_url ? (
                      <img src={ev.flyer_url} alt={ev.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: 'linear-gradient(135deg, #2a0a2e, #1a0d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0, opacity: 0.6 }}>🕊</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.name || ev.artist_name}
                        </div>
                        <span style={badgeStyle(isPast ? 'neutral' : 'live')}>{isPast ? 'Past' : 'Live'}</span>
                        {ev.hidden && <span style={badgeStyle('neutral')}>hidden</span>}
                      </div>
                      <div style={{ color: C.textMid, fontSize: '0.82rem' }}>
                        {fmtDate(date)} · {sold}/{cap} tickets sold
                      </div>
                    </div>
                    <div style={{ alignSelf: 'center', color: C.textMid, fontSize: '1.1rem', flexShrink: 0 }}>›</div>
                  </button>

                  {/* Quick-link grid: every URL the promoter might want to share */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '1px', background: C.border, borderTop: `1px solid ${C.border}`,
                  }}>
                    {linkRow.map(l => (
                      <button
                        key={l.key}
                        onClick={() => copy(l.url, l.key)}
                        style={{
                          padding: '0.7rem 0.5rem', background: C.card, border: 'none',
                          color: copied === l.key ? BRAND.neon : C.textMid,
                          fontSize: '0.78rem', cursor: 'pointer',
                          fontFamily: FONT, fontWeight: '600',
                        }}
                      >
                        {copied === l.key ? '✓ Copied' : l.label}
                      </button>
                    ))}
                  </div>

                  {/* Manage + Hide controls */}
                  <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => navigate(`/promoter/event/${ev.slug}`)}
                      style={{
                        flex: 1, padding: '0.7rem', background: 'transparent', border: 'none',
                        color: C.text, fontSize: '0.82rem', cursor: 'pointer',
                        borderRight: `1px solid ${C.border}`, fontFamily: FONT, fontWeight: '700',
                      }}
                    >
                      Manage event →
                    </button>
                    <button
                      onClick={() => toggleHidden(ev)}
                      disabled={hideBusy === ev.id}
                      style={{
                        padding: '0.7rem 1.25rem', background: 'transparent', border: 'none',
                        color: C.textMid, fontSize: '0.78rem',
                        cursor: hideBusy === ev.id ? 'wait' : 'pointer',
                        fontFamily: FONT, fontWeight: '600',
                      }}
                    >
                      {hideBusy === ev.id ? '…' : ev.hidden ? 'Unhide' : 'Hide'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── HANDLE CARD ──────────────────────────────────────────────────────────────
// Lets a promoter claim a vanity handle (grail.mx/{handle}) that resolves
// to their most recent upcoming event. Once claimed, shows the live link
// with a copy button. No edit-after-claim for MVP — they live with what
// they pick. (Future: add a rename flow that releases the old handle.)
function HandleCard({ promoterId }) {
  const [handle, setHandle]   = useState('')        // current saved handle, or ''
  const [input, setInput]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    if (!promoterId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('users')
        .select('handle')
        .eq('id', promoterId)
        .maybeSingle()
      if (!cancelled) {
        setHandle(data?.handle || '')
        setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [promoterId])

  const claim = async (e) => {
    e?.preventDefault()
    setError('')
    const v = validateHandle(input)
    if (!v.ok) { setError(v.reason); return }
    setBusy(true)
    try {
      // Upsert in case the user row doesn't exist yet (rare; usually it does)
      const { error: upErr } = await supabase
        .from('users')
        .update({ handle: v.handle })
        .eq('id', promoterId)
      if (upErr) {
        // Unique-violation is the expected "already taken" path
        if (upErr.code === '23505') throw new Error('That handle is already taken.')
        throw upErr
      }
      setHandle(v.handle)
      setInput('')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const copyLink = () => {
    const url = `${window.location.origin}/${handle}`
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!loaded) return null

  // Claimed state — show the live link
  if (handle) {
    const url = `${window.location.origin}/${handle}`
    return (
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '12px', padding: '0.85rem 1.1rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...eyebrowStyle(), marginBottom: '0.25rem' }}>Your handle</div>
          <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {url} <span style={{ color: C.textMid, fontSize: '0.78rem', fontWeight: '500' }}>→ your latest event</span>
          </div>
        </div>
        <button onClick={copyLink} style={{
          background: 'transparent', color: C.text, border: `1px solid ${C.border}`,
          borderRadius: '8px', padding: '0.5rem 0.85rem', fontSize: '0.78rem', fontWeight: '700',
          cursor: 'pointer', fontFamily: FONT, flexShrink: 0,
        }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  // Unclaimed state — show input
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '1.5rem',
    }}>
      <div style={{ ...eyebrowStyle(), marginBottom: '0.4rem' }}>Claim your handle</div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.7rem' }}>
        Pick a short link like <span style={{ color: C.text, fontWeight: '700' }}>grail.mx/your-name</span> that always points to your latest event.
      </div>
      <form onSubmit={claim} style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <div style={{
          display: 'flex', alignItems: 'center', flex: 1,
          background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '8px',
          paddingLeft: '0.7rem',
        }}>
          <span style={{ color: C.textMid, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>grail.mx /</span>
          <input
            value={input}
            onChange={e => { setInput(e.target.value.toLowerCase()); setError('') }}
            placeholder="your-name"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, padding: '0.6rem 0.5rem', fontSize: '0.85rem', fontFamily: FONT,
            }}
          />
        </div>
        <button type="submit" disabled={busy || !input.trim()} style={{
          background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '8px',
          padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: '800',
          cursor: (busy || !input.trim()) ? 'not-allowed' : 'pointer', fontFamily: FONT,
          opacity: (busy || !input.trim()) ? 0.5 : 1,
        }}>
          {busy ? '…' : 'Claim'}
        </button>
      </form>
      {error && <div style={{ color: BRAND.orange, fontSize: '0.78rem', marginTop: '0.45rem' }}>{error}</div>}
    </div>
  )
}
