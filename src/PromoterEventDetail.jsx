import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { fmtPriceCents } from './currencies'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

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
  const [doveBalances, setDoveBalances] = useState([])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState('')
  const [refunding, setRefunding] = useState(null)   // ticket_id being refunded
  const [refundErr, setRefundErr] = useState('')
  const [closingOut, setClosingOut] = useState(false)
  const [closeOutResult, setCloseOutResult] = useState(null)
  const [pinDraft, setPinDraft] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinErr, setPinErr] = useState('')
  const [pinSaved, setPinSaved] = useState(false)

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

      const [{ data: tierRows }, { data: ticketRows }, { data: balanceRows }] = await Promise.all([
        supabase.from('ticket_tiers').select('*').eq('event_id', ev.id).order('sort_order'),
        supabase.from('tickets').select('id, ticket_number, name, email, tier_id, tier_name, torn, torn_at, refunded, created_at, stripe_payment_intent_id').eq('event_id', ev.id).order('created_at', { ascending: false }),
        supabase.from('bar_tabs').select('*').eq('event_id', ev.id).order('created_at', { ascending: false }),
      ])

      if (cancelled) return
      setTiers(tierRows || [])
      setTickets(ticketRows || [])
      setDoveBalances(balanceRows || [])
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

  const handleCloseOut = async ({ forcePlatformBalance = false } = {}) => {
    if (!forcePlatformBalance) {
      const activeBalances = doveBalances.filter(b => b.status === 'active')
      const unspentTotal = activeBalances.reduce((s, b) => s + (b.loaded_cents - b.spent_cents), 0)
      if (!confirm(
        `Close out the bar?\n\n` +
        `${activeBalances.length} active balance${activeBalances.length === 1 ? '' : 's'}\n` +
        `${fmtPriceCents(unspentTotal, event?.currency)} in unspent Doves will be refunded to buyers.\n\n` +
        `The 2% Grail fee on the original load is non-refundable.`
      )) return
    } else if (!confirm(
      `Force refund from your platform balance?\n\n` +
      `Stripe usually pulls refunds from the bar's incoming charges, but those funds are still pending settlement.\n\n` +
      `This will refund the buyers immediately from your own balance — you'll absorb the cost until the bar's pending funds clear (2–7 days).`
    )) return

    setClosingOut(true)
    if (!forcePlatformBalance) setCloseOutResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in expired — please reload.')
      const res = await fetch('/.netlify/functions/close-out-bar', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ event_id: event.id, force_platform_balance: forcePlatformBalance }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Close-out failed')
      setCloseOutResult(json)
      // Refresh balances
      const { data: refreshed } = await supabase.from('bar_tabs').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
      setDoveBalances(refreshed || [])
    } catch (err) {
      setCloseOutResult({ error: err.message })
    }
    setClosingOut(false)
  }

  const savePin = async (newPin) => {
    setPinErr('')
    if (newPin && !/^\d{4,8}$/.test(newPin)) {
      setPinErr('PIN must be 4–8 digits.')
      return
    }
    setPinSaving(true)
    const { error } = await supabase
      .from('events')
      .update({ staff_pin: newPin || null })
      .eq('id', event.id)
    if (error) {
      setPinErr(error.message)
    } else {
      setEvent(e => ({ ...e, staff_pin: newPin || null }))
      setPinDraft('')
      setPinSaved(true)
      setTimeout(() => setPinSaved(false), 2000)
    }
    setPinSaving(false)
  }

  const generatePin = () => {
    const fresh = String(Math.floor(1000 + Math.random() * 9000))
    setPinDraft(fresh)
  }

  const handleRefund = async (ticket) => {
    if (!confirm(`Refund ticket #${ticket.ticket_number} for ${ticket.name || ticket.email}? The 2% Grail fee is non-refundable.`)) return
    setRefunding(ticket.id)
    setRefundErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in expired — please reload.')
      const res = await fetch('/.netlify/functions/refund-ticket', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticket_id: ticket.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Refund failed')
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, refunded: true, torn: true } : t))
    } catch (err) {
      setRefundErr(err.message)
    }
    setRefunding(null)
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
    if (t.refunded) return sum
    const tier = tiers.find(x => x.id === t.tier_id)
    return sum + (tier?.price_cents || 0)
  }, 0)
  const platformFeeCents = Math.round(grossCents * 0.02)
  const netCents = grossCents - platformFeeCents
  const admittedCount = tickets.filter(t => t.torn && !t.refunded).length

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={() => navigate(`/promoter/event/${slug}/edit`)} style={{
              background: 'transparent', border: `1px solid ${BRAND.pink}55`, color: BRAND.pink,
              borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.82rem',
              cursor: 'pointer', fontFamily: FONT, fontWeight: '700',
            }}>
              Edit
            </button>
            <div style={LogoMark({ size: 32 })}>GRAIL</div>
          </div>
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
          <Stat label="Gross" value={fmtPriceCents(grossCents, event?.currency)} accent={C.text} />
          <Stat label="Net (after 2%)" value={fmtPriceCents(netCents, event?.currency)} accent={BRAND.pink} />
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

        {/* Bar links — only show when bar is enabled */}
        {event.bar_enabled !== false && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', overflow: 'hidden', marginBottom: '1rem',
            display: 'flex', flexWrap: 'wrap',
          }}>
            <ActionBtn label="🥂 Bar menu (customer)" onClick={() => window.open(`/${event.slug}/bar`, '_blank')} />
            <Divider />
            <ActionBtn label="📋 Bar queue (staff)" onClick={() => window.open(`/${event.slug}/bar/staff`, '_blank')} />
            <Divider />
            <ActionBtn
              label={copied === 'barstaff' ? '✓ Copied' : 'Copy staff link'}
              onClick={() => copy(`${window.location.origin}/${event.slug}/bar/staff`, 'barstaff')}
              accent={copied === 'barstaff' ? BRAND.neon : null}
            />
          </div>
        )}

        {/* Bar staff PIN — gates the bar queue */}
        {event.bar_enabled !== false && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
          }}>
            <div style={{ ...eyebrowStyle(), marginBottom: '0.4rem' }}>Bar staff PIN</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.7rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', letterSpacing: '0.15em', fontFamily: 'ui-monospace, monospace' }}>
                  {event.staff_pin || '7777'}
                </div>
                <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.15rem' }}>
                  {event.staff_pin ? 'Custom PIN — share with your bar staff.' : 'Default PIN. Set a custom one before showtime.'}
                </div>
              </div>
              <button
                onClick={() => copy(event.staff_pin || '7777', 'pin')}
                style={{
                  background: 'transparent', color: copied === 'pin' ? BRAND.neon : C.textMid,
                  border: `1px solid ${C.border}`, borderRadius: '8px',
                  padding: '0.5rem 0.85rem', fontSize: '0.78rem', fontWeight: '700',
                  cursor: 'pointer', fontFamily: FONT, flexShrink: 0,
                }}
              >
                {copied === 'pin' ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pinDraft}
                onChange={e => { setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinErr('') }}
                placeholder="New 4–8 digit PIN"
                style={{
                  flex: 1, minWidth: 0, background: '#0d0d0d', border: `1px solid ${C.border}`,
                  borderRadius: '8px', color: C.text, padding: '0.55rem 0.75rem',
                  fontSize: '0.88rem', outline: 'none', fontFamily: FONT,
                }}
              />
              <button
                onClick={generatePin}
                disabled={pinSaving}
                style={{
                  background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
                  borderRadius: '8px', padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: '700',
                  cursor: pinSaving ? 'wait' : 'pointer', fontFamily: FONT, flexShrink: 0,
                }}
              >
                Random
              </button>
              <button
                onClick={() => savePin(pinDraft)}
                disabled={pinSaving || !pinDraft}
                style={{
                  background: pinDraft && !pinSaving ? BRAND.gradient : '#1a1a1a',
                  color: pinDraft && !pinSaving ? '#000' : C.textMid,
                  border: 'none', borderRadius: '8px', padding: '0.55rem 1rem',
                  fontSize: '0.82rem', fontWeight: '800',
                  cursor: pinSaving ? 'wait' : (pinDraft ? 'pointer' : 'not-allowed'),
                  fontFamily: FONT, flexShrink: 0,
                }}
              >
                {pinSaving ? '…' : pinSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            {pinErr && <div style={{ color: BRAND.orange, fontSize: '0.78rem', marginTop: '0.4rem' }}>{pinErr}</div>}
          </div>
        )}

        {/* Doves summary + close-out */}
        {event.bar_enabled !== false && doveBalances.length > 0 && (() => {
          const active = doveBalances.filter(b => b.status === 'active')
          const refunded = doveBalances.filter(b => b.status === 'refunded' || b.status === 'depleted')
          const totalLoaded = doveBalances.reduce((s, b) => s + b.loaded_cents, 0)
          const totalSpent  = doveBalances.reduce((s, b) => s + b.spent_cents, 0)
          const totalUnspent = active.reduce((s, b) => s + (b.loaded_cents - b.spent_cents), 0)
          const totalRefunded = refunded.reduce((s, b) => s + (b.refunded_amount_cents || 0), 0)
          return (
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={eyebrowStyle()}>Doves balances</div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.1rem 1.3rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: active.length > 0 ? '1rem' : '0' }}>
                  <MiniStat label="Loaded"   value={fmtPriceCents(totalLoaded, event?.currency)}   accent={C.text} />
                  <MiniStat label="Spent"    value={fmtPriceCents(totalSpent, event?.currency)}    accent={BRAND.neon} />
                  <MiniStat label="Active"   value={`${active.length}`}     accent={C.text} />
                  <MiniStat label="Unspent"  value={fmtPriceCents(totalUnspent, event?.currency)}  accent={BRAND.orange} />
                  <MiniStat label="Refunded" value={fmtPriceCents(totalRefunded, event?.currency)} accent={C.textMid} />
                </div>
                {active.length > 0 && (
                  <button
                    onClick={handleCloseOut}
                    disabled={closingOut}
                    style={{
                      width: '100%',
                      background: closingOut ? '#1a1a1a' : `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`,
                      color: closingOut ? C.textMid : '#000', border: 'none', borderRadius: '10px',
                      padding: '0.85rem', fontSize: '0.92rem', fontWeight: '800',
                      cursor: closingOut ? 'wait' : 'pointer', fontFamily: FONT,
                    }}
                  >
                    {closingOut ? 'Closing out…' : `Close Out Bar — refund ${fmtPriceCents(totalUnspent, event?.currency)}`}
                  </button>
                )}
                {active.length === 0 && (
                  <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', padding: '0.4rem 0' }}>
                    All balances closed out.
                  </div>
                )}
              </div>
              {closeOutResult && !closeOutResult.error && (() => {
                const hasInsufficientFunds = (closeOutResult.errors || [])
                  .some(e => /sufficient funds|sufficient funds in|reverse this amount/i.test(e.error || ''))
                return (
                  <div style={{ background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`, borderRadius: '10px', padding: '0.75rem 1rem', color: BRAND.neon, fontSize: '0.82rem' }}>
                    ✓ Closed out {closeOutResult.refunded} balance{closeOutResult.refunded === 1 ? '' : 's'} — refunded {fmtPriceCents(closeOutResult.total_refunded_cents || 0, event?.currency)}
                    {closeOutResult.errors?.length > 0 && (
                      <div style={{ color: BRAND.orange, marginTop: '0.6rem', borderTop: `1px solid ${BRAND.orange}33`, paddingTop: '0.6rem' }}>
                        <div style={{ fontWeight: '700', marginBottom: '0.3rem' }}>
                          {closeOutResult.errors.length} balance{closeOutResult.errors.length === 1 ? '' : 's'} couldn't refund:
                        </div>
                        {closeOutResult.errors.map((err, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', lineHeight: 1.45, marginBottom: '0.25rem' }}>
                            • {err.error || 'Unknown error'}
                            {err.balance_id && (
                              <span style={{ color: C.textDim, marginLeft: '0.4rem' }}>
                                ({String(err.balance_id).slice(0, 8)}…)
                              </span>
                            )}
                          </div>
                        ))}
                        {hasInsufficientFunds && (
                          <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: `1px solid ${BRAND.orange}33` }}>
                            <div style={{ color: C.text, fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                              <strong style={{ color: BRAND.orange }}>If your Stripe account is still under review</strong>, incoming charges sit in pending balance and can't be refunded immediately — Stripe needs them cleared before reversing the transfer. This usually clears within 2–7 days of account verification.
                              <br /><br />
                              You can either refund from your platform balance now (you'll absorb the cost until the bar's funds clear and you reconcile), <strong>or do nothing</strong> — the platform retries the refund automatically once a day, and after 7 days will fall back to the platform-balance method on its own.
                            </div>
                            <button
                              onClick={() => handleCloseOut({ forcePlatformBalance: true })}
                              disabled={closingOut}
                              style={{
                                background: BRAND.gradient, color: '#000', border: 'none',
                                borderRadius: '8px', padding: '0.5rem 0.9rem',
                                fontSize: '0.8rem', fontWeight: '800', cursor: closingOut ? 'wait' : 'pointer',
                                fontFamily: FONT, opacity: closingOut ? 0.6 : 1,
                              }}
                            >
                              {closingOut ? 'Refunding…' : 'Refund from platform balance'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
              {closeOutResult?.error && (
                <div style={{ background: 'rgba(240,112,32,0.08)', border: `1px solid ${BRAND.orange}55`, borderRadius: '10px', padding: '0.75rem 1rem', color: BRAND.orange, fontSize: '0.82rem' }}>
                  {closeOutResult.error}
                </div>
              )}
            </div>
          )
        })()}

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
                        {fmtPriceCents(t.price_cents, event?.currency)} · {t.sold || 0}/{t.qty} sold · {remaining} left
                      </div>
                    </div>
                    <div style={{ color: BRAND.pink, fontWeight: '800', fontSize: '0.95rem' }}>
                      {fmtPriceCents(tierGross, event?.currency)}
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

          {refundErr && (
            <div style={{ background: 'rgba(240,112,32,0.08)', border: `1px solid ${BRAND.orange}55`, borderRadius: '10px', padding: '0.7rem 1rem', color: BRAND.orange, fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {refundErr}
            </div>
          )}

          {tickets.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{ color: C.textMid, fontSize: '0.88rem' }}>No tickets sold yet.</div>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
              {tickets.map((t, i) => {
                const isRefunding = refunding === t.id
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.85rem',
                    padding: '0.8rem 1.2rem',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    opacity: t.refunded ? 0.55 : 1,
                  }}>
                    <div style={{ width: '36px', textAlign: 'center', color: C.textMid, fontSize: '0.85rem', fontFamily: 'monospace', flexShrink: 0 }}>
                      #{t.ticket_number}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: t.refunded ? 'line-through' : 'none' }}>
                        {t.name || '—'}
                      </div>
                      <div style={{ color: C.textMid, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.email}{t.tier_name && ` · ${t.tier_name}`}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {t.refunded ? (
                        <span style={badgeStyle('neutral')}>REFUNDED</span>
                      ) : t.torn ? (
                        <span style={badgeStyle('success')}>ADMITTED</span>
                      ) : (
                        <span style={badgeStyle('neutral')}>WAITING</span>
                      )}
                      <div style={{ color: C.textDim, fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        {fmtWhen(t.created_at)}
                      </div>
                    </div>
                    {!t.refunded && t.stripe_payment_intent_id && (
                      <button
                        onClick={() => handleRefund(t)}
                        disabled={isRefunding}
                        style={{
                          background: 'transparent', border: `1px solid ${C.border}`,
                          color: BRAND.orange, borderRadius: '6px', padding: '0.35rem 0.7rem',
                          fontSize: '0.72rem', fontWeight: '700', cursor: isRefunding ? 'wait' : 'pointer',
                          fontFamily: FONT, flexShrink: 0, opacity: isRefunding ? 0.6 : 1,
                        }}
                      >
                        {isRefunding ? '…' : 'Refund'}
                      </button>
                    )}
                  </div>
                )
              })}
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

function MiniStat({ label, value, accent }) {
  return (
    <div>
      <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.6rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: accent, fontSize: '1.05rem', fontWeight: '800', letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</div>
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
