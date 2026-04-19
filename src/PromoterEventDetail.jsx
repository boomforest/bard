import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

const dollars = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const fmtWhen = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
         ' · ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function PromoterEventDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(undefined)
  const [event, setEvent]     = useState(null)
  const [tiers, setTiers]     = useState([])
  const [tickets, setTickets] = useState([])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setError('Sign in to view this event.'); setLoading(false); return }
    if (!slug) return
    let cancelled = false
    async function load() {
      setLoading(true)

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (cancelled) return
      if (evErr || !ev) { setError('Event not found.'); setLoading(false); return }
      if (ev.promoter_id !== session.user.id) {
        setError('You do not have access to this event.'); setLoading(false); return
      }
      setEvent(ev)

      const [{ data: tierRows }, { data: ticketRows }] = await Promise.all([
        supabase.from('ticket_tiers').select('*').eq('event_id', ev.id).order('sort_order'),
        supabase.from('tickets').select('id, ticket_number, name, email, tier_id, tier_name, torn, torn_at, created_at, stripe_payment_intent_id').eq('event_id', ev.id).order('created_at', { ascending: false }),
      ])

      if (cancelled) return
      setTiers(tierRows || [])
      setTickets(ticketRows || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [session, slug])

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  if (loading) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>{error}</div>
          <button onClick={() => navigate('/promoter')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT, marginTop: '1rem',
          }}>
            ← Back to events
          </button>
        </div>
      </div>
    )
  }

  // Aggregations
  const eventName = event.name || event.artist_name
  const date = event.show_date || event.event_date
  const isPast = date && new Date(date) < new Date()

  const sold = event.tickets_sold || 0
  const cap  = event.capacity || 0

  const grossCents = tickets.reduce((sum, t) => {
    const tier = tiers.find(x => x.id === t.tier_id)
    return sum + (tier?.price_cents || 0)
  }, 0)
  const platformFeeCents = Math.round(grossCents * 0.02)
  const netCents = grossCents - platformFeeCents
  const admittedCount = tickets.filter(t => t.torn).length

  const eventLink = `${window.location.origin}/e/${event.slug}`
  const scanLink  = `${window.location.origin}/scan/${event.slug}`

  return (
    <div style={{ ...PAGE, padding: '2rem 1.5rem 4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate('/promoter')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
          }}>
            ← My Events
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
        </div>

        {/* Event header */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: '14px', padding: '1.5rem 1.6rem', marginBottom: '1.25rem',
          display: 'flex', gap: '1rem', alignItems: 'center',
        }}>
          {event.flyer_url ? (
            <img src={event.flyer_url} alt={eventName} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: 'linear-gradient(135deg, #2a0a2e, #1a0d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0, opacity: 0.6 }}>🕊</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={badgeStyle(isPast ? 'neutral' : 'live')}>{isPast ? 'Past' : 'Live'}</span>
            </div>
            <div style={{ color: C.text, fontWeight: '900', fontSize: '1.4rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {eventName}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.85rem', marginTop: '0.2rem' }}>
              {fmtDate(date)} · {event.venue_hint || event.address || ''}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Stat label="Tickets sold" value={`${sold} / ${cap}`} accent={C.text} />
          <Stat label="Admitted" value={`${admittedCount}`} accent={BRAND.neon} />
          <Stat label="Gross" value={dollars(grossCents)} accent={C.text} />
          <Stat label="Net (after 2%)" value={dollars(netCents)} accent={BRAND.pink} />
        </div>

        {/* Quick actions */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem',
          display: 'flex', flexWrap: 'wrap',
        }}>
          <ActionBtn label="View ticket page" onClick={() => window.open(eventLink, '_blank')} />
          <Divider />
          <ActionBtn label={copied === 'event' ? '✓ Copied' : 'Copy ticket link'} onClick={() => copy(eventLink, 'event')} accent={copied === 'event' ? BRAND.neon : null} />
          <Divider />
          <ActionBtn label="Open scanner" onClick={() => window.open(scanLink, '_blank')} />
          <Divider />
          <ActionBtn label={copied === 'scan' ? '✓ Copied' : 'Copy scanner link'} onClick={() => copy(scanLink, 'scan')} accent={copied === 'scan' ? BRAND.neon : null} />
        </div>

        {/* Tier breakdown */}
        {tiers.length > 0 && (
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={eyebrowStyle()}>Tier breakdown</div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
              {tiers.map((t, i) => {
                const remaining = t.qty - (t.sold || 0)
                const tierGross = (t.sold || 0) * t.price_cents
                return (
                  <div key={t.id} style={{
                    padding: '0.85rem 1.2rem',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>{t.name}</div>
                      <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.15rem' }}>
                        {dollars(t.price_cents)} · {t.sold || 0}/{t.qty} sold · {remaining} left
                      </div>
                    </div>
                    <div style={{ color: BRAND.pink, fontWeight: '800', fontSize: '0.95rem' }}>
                      {dollars(tierGross)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Attendee list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={eyebrowStyle()}>Attendees ({tickets.length})</div>
          </div>

          {tickets.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{ color: C.textMid, fontSize: '0.88rem' }}>No tickets sold yet.</div>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
              {tickets.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  padding: '0.8rem 1.2rem',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                }}>
                  <div style={{ width: '36px', textAlign: 'center', color: C.textMid, fontSize: '0.85rem', fontFamily: 'monospace', flexShrink: 0 }}>
                    #{t.ticket_number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || '—'}
                    </div>
                    <div style={{ color: C.textMid, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.email}{t.tier_name && ` · ${t.tier_name}`}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {t.torn ? (
                      <span style={badgeStyle('success')}>ADMITTED</span>
                    ) : (
                      <span style={badgeStyle('neutral')}>WAITING</span>
                    )}
                    <div style={{ color: C.textDim, fontSize: '0.7rem', marginTop: '0.25rem' }}>
                      {fmtWhen(t.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '0.85rem 1rem' }}>
      <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.62rem', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: accent, fontSize: '1.25rem', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function ActionBtn({ label, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      flex: '1 1 140px', padding: '0.85rem 0.6rem', background: 'transparent', border: 'none',
      color: accent || C.textMid, fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT, fontWeight: '700',
    }}>
      {label}
    </button>
  )
}

function Divider() {
  return <div style={{ width: '1px', background: C.border }} />
}
