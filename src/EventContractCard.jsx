import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fmtPriceCents } from './currencies'
import { BRAND, C, FONT, INPUT } from './theme'

// Drop-in card for PromoterEventDetail. Shows the multi-producer contract:
//   - Revenue total (from ticket tiers)
//   - Fixed costs (jsonb on events.fixed_costs, editable in place)
//   - Producers list (event_producers rows) with split %, sign status,
//     Greenlight button on the row owned by the current user
//   - Add-a-co-producer form
//   - Locked banner once events.greenlit_at is set
//
// First co-producer added to a solo event auto-creates a row for the calling
// promoter (handled in netlify/functions/invite-co-producer.js).

export default function EventContractCard({ event, tiers, currentUserId, onUpdate }) {
  const [producers, setProducers] = useState([])
  const [costs,     setCosts]     = useState(event?.fixed_costs || [])
  const [costsDirty,setCostsDirty]= useState(false)
  const [costsSaving,setCostsSaving] = useState(false)
  const [adding,    setAdding]    = useState(false)
  const [form,      setForm]      = useState({ name: '', email: '', role: 'Venue', split_pct: 30 })
  const [posting,   setPosting]   = useState(false)
  const [error,     setError]     = useState('')
  const [signing,   setSigning]   = useState(null)

  const greenlit = !!event?.greenlit_at

  useEffect(() => { loadProducers() }, [event?.id])
  useEffect(() => { setCosts(event?.fixed_costs || []); setCostsDirty(false) }, [event?.id])

  async function loadProducers() {
    if (!event?.id) return
    const { data } = await supabase
      .from('event_producers')
      .select('id, name, role, split_pct, signed, signed_at, email, user_id')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    setProducers(data || [])
  }

  // ─── Revenue + cost math ───────────────────────────────────────────────
  const ticketRevCents = (tiers || []).reduce((s, t) => s + (t.qty || 0) * (t.price_cents || 0), 0)
  const fixedCostsCents = costs.reduce((s, c) => s + (Number(c.amount_cents) || 0), 0)
  const netCents = Math.max(0, ticketRevCents - fixedCostsCents)
  const totalSplit = producers.reduce((s, p) => s + Number(p.split_pct || 0), 0)
  const splitsBalance = Math.abs(totalSplit - 100) < 0.01

  // ─── Costs editor ──────────────────────────────────────────────────────
  const updateCost = (i, field, val) => {
    const next = [...costs]
    next[i] = { ...next[i], [field]: field === 'amount_cents' ? Math.max(0, Math.round(Number(val) * 100)) : val }
    setCosts(next); setCostsDirty(true)
  }
  const addCost = () => { setCosts([...costs, { name: '', amount_cents: 0 }]); setCostsDirty(true) }
  const removeCost = (i) => { setCosts(costs.filter((_, j) => j !== i)); setCostsDirty(true) }
  const saveCosts = async () => {
    setCostsSaving(true); setError('')
    const cleaned = costs.filter(c => c.name?.trim() && c.amount_cents > 0)
    const { error: e } = await supabase
      .from('events')
      .update({ fixed_costs: cleaned })
      .eq('id', event.id)
    setCostsSaving(false)
    if (e) { setError(e.message); return }
    setCosts(cleaned); setCostsDirty(false)
    onUpdate?.()
  }

  // ─── Add co-producer ───────────────────────────────────────────────────
  const submitAdd = async (e) => {
    e.preventDefault(); setError(''); setPosting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/invite-co-producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          event_id: event.id,
          name:     form.name.trim(),
          email:    form.email.trim(),
          role:     form.role.trim(),
          split_pct: Number(form.split_pct),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Invite failed (${res.status})`)
      setForm({ name: '', email: '', role: 'Venue', split_pct: 30 })
      setAdding(false)
      await loadProducers()
      onUpdate?.()
    } catch (err) {
      setError(err.message)
    }
    setPosting(false)
  }

  // ─── Greenlight (only on my row) ───────────────────────────────────────
  const greenlight = async (producerId) => {
    setSigning(producerId); setError('')
    const { error: e } = await supabase
      .from('event_producers')
      .update({ signed: true, signed_at: new Date().toISOString() })
      .eq('id', producerId)
      .eq('user_id', currentUserId)   // belt + RLS suspenders
    setSigning(null)
    if (e) { setError(e.message); return }
    await loadProducers()
    onUpdate?.()
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.4rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.25rem' }}>
            The Contract
          </div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1.1rem' }}>Producers, costs & splits</div>
        </div>
        {greenlit && (
          <div style={{ background: '#0a1400', border: `1px solid #2a5a1a`, borderRadius: '99px', padding: '0.25rem 0.7rem', fontSize: '0.72rem', color: '#6abf4b', fontWeight: '700' }}>
            🔒 Greenlit
          </div>
        )}
      </div>

      {/* Math summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem', marginBottom: '1.2rem' }}>
        <SummaryTile label="Ticket revenue (full)" value={fmtPriceCents(ticketRevCents, event?.currency)} />
        <SummaryTile label="Fixed costs"            value={fmtPriceCents(fixedCostsCents, event?.currency)} accent={C.red} />
        <SummaryTile label="Estimated net"          value={fmtPriceCents(netCents, event?.currency)} accent={BRAND.neon} />
      </div>

      {/* Producers list */}
      <Section title="Producers">
        {producers.length === 0 ? (
          <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '0.5rem 0', lineHeight: 1.5 }}>
            You're solo on this event. Add a co-producer below to start a multi-party contract — their share comes out of the net, and they each Greenlight before the show locks.
          </div>
        ) : (
          producers.map(p => {
            const isMine    = p.user_id === currentUserId
            const payoutCents = Math.round(netCents * (p.split_pct / 100))
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.7rem 0.85rem', marginBottom: '0.4rem',
                background: p.signed ? '#0a1400' : C.surface,
                border: `1px solid ${p.signed ? '#2a5a1a' : C.border}`, borderRadius: '9px',
              }}>
                <RoleBadge role={p.role} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: '700', fontSize: '0.92rem' }}>
                    {p.name}{isMine && <span style={{ color: C.textMid, fontWeight: '500', marginLeft: '0.4rem' }}>(you)</span>}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '0.72rem' }}>
                    {p.split_pct}% · est. {fmtPriceCents(payoutCents, event?.currency)}{p.email ? ` · ${p.email}` : ''}
                  </div>
                </div>
                {p.signed ? (
                  <span style={{ fontSize: '0.78rem', color: '#6abf4b', fontWeight: '700' }}>✓ Greenlit</span>
                ) : isMine ? (
                  <button
                    onClick={() => greenlight(p.id)}
                    disabled={signing === p.id}
                    style={{
                      background: 'transparent', border: `1px solid ${BRAND.neon}66`,
                      color: BRAND.neon, borderRadius: '7px', padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
                      opacity: signing === p.id ? 0.5 : 1,
                    }}
                  >
                    {signing === p.id ? 'Signing…' : 'Greenlight'}
                  </button>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: C.textMid }}>Pending</span>
                )}
              </div>
            )
          })
        )}
        {producers.length > 0 && !splitsBalance && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: BRAND.orange }}>
            Splits sum to {totalSplit}%, not 100%. Adjust before everyone Greenlights.
          </div>
        )}
      </Section>

      {/* Fixed costs editor */}
      <Section title="Fixed costs">
        {costs.length === 0 && (
          <div style={{ color: C.textMid, fontSize: '0.82rem', padding: '0.4rem 0' }}>No costs yet. Add the DJ, venue, sound, security, etc. — anything that gets paid before splits.</div>
        )}
        {costs.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <input value={c.name} onChange={e => updateCost(i, 'name', e.target.value)} placeholder="DJ / Venue / Sound" style={{ ...INPUT, flex: 2 }} />
            <input
              type="number" min="0" step="any"
              value={c.amount_cents > 0 ? c.amount_cents / 100 : ''}
              onChange={e => updateCost(i, 'amount_cents', e.target.value)}
              placeholder="0"
              style={{ ...INPUT, flex: 1, maxWidth: '120px' }}
            />
            <button onClick={() => removeCost(i)} type="button" style={{
              background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
              borderRadius: '7px', padding: '0 0.7rem', cursor: 'pointer', fontSize: '0.85rem',
            }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <button onClick={addCost} type="button" style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '7px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600',
          }}>+ Add cost</button>
          {costsDirty && (
            <button onClick={saveCosts} disabled={costsSaving} type="button" style={{
              background: BRAND.neon, color: '#000', border: 'none',
              borderRadius: '7px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '700',
              opacity: costsSaving ? 0.5 : 1,
            }}>{costsSaving ? 'Saving…' : 'Save costs'}</button>
          )}
        </div>
      </Section>

      {/* Add co-producer */}
      <Section title="Add co-producer">
        {!adding ? (
          <button onClick={() => setAdding(true)} type="button" style={{
            background: 'transparent', border: `1px solid ${BRAND.pink}66`, color: BRAND.pink,
            borderRadius: '7px', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '700',
          }}>+ Add co-producer</button>
        ) : (
          <form onSubmit={submitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <input value={form.name}  onChange={e => setForm({ ...form, name:  e.target.value })} placeholder="Name"  style={INPUT} required />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" style={INPUT} required />
              <input value={form.role}  onChange={e => setForm({ ...form, role:  e.target.value })} placeholder="Role (Venue / Promoter / etc.)" style={INPUT} required />
              <input
                value={form.split_pct}
                onChange={e => setForm({ ...form, split_pct: e.target.value })}
                placeholder="Split %"
                type="number" min="0" max="100" step="any"
                style={INPUT} required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
              <button type="submit" disabled={posting} style={{
                background: BRAND.gradientAngle || `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`,
                color: '#000', border: 'none', borderRadius: '7px',
                padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                opacity: posting ? 0.5 : 1,
              }}>{posting ? 'Sending invite…' : 'Send invite'}</button>
              <button type="button" onClick={() => { setAdding(false); setError('') }} style={{
                background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
                borderRadius: '7px', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer',
              }}>Cancel</button>
            </div>
            <div style={{ color: C.textMid, fontSize: '0.72rem', marginTop: '0.2rem', lineHeight: 1.5 }}>
              They'll get an email to set up their own GRAIL account and review the contract.
            </div>
          </form>
        )}
      </Section>

      {error && <div style={{ marginTop: '0.6rem', color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.1rem', paddingTop: '0.9rem', borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: '0.66rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', marginBottom: '0.6rem' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SummaryTile({ label, value, accent }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '9px', padding: '0.7rem 0.9rem' }}>
      <div style={{ fontSize: '0.62rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ color: accent || C.text, fontSize: '1.05rem', fontWeight: '800' }}>{value}</div>
    </div>
  )
}

function RoleBadge({ role }) {
  const map = {
    'Promoter': { bg: '#0d0820', border: '#3d1a6e', text: '#b57bff' },
    'Venue':    { bg: '#0a1200', border: '#1a3a0a', text: '#6abf4b' },
  }
  const rc = map[role] || { bg: C.surface, border: C.border, text: C.textMid }
  return (
    <div style={{
      fontSize: '0.6rem', fontWeight: '800', padding: '0.2rem 0.5rem',
      borderRadius: '5px', background: rc.bg, border: `1px solid ${rc.border}`,
      color: rc.text, flexShrink: 0, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {role || 'Producer'}
    </div>
  )
}
