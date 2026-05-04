import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fmtPriceCents } from './currencies'
import { BRAND, C, FONT, eyebrowStyle, badgeStyle, INPUT } from './theme'

// Shared styling for these two cards — keeps them visually paired.
const CARD = {
  background: `linear-gradient(135deg, ${C.card} 0%, #160b1f 100%)`,
  border: `1px solid ${C.border}`,
  borderRadius: '18px',
  padding: '1.25rem 1.4rem',
  marginBottom: '1.75rem',
  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
}

function SectionHead({ eyebrow, title, caption, accent = BRAND.pink }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ ...eyebrowStyle(accent), fontSize: '0.65rem', marginBottom: '0.35rem' }}>
        {eyebrow}
      </div>
      <div style={{ color: C.text, fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {title}
      </div>
      {caption && (
        <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.25rem' }}>
          {caption}
        </div>
      )}
    </div>
  )
}

// ─── PROMO CODES CARD ────────────────────────────────────────────────────────

const KIND_OPTIONS = [
  { value: 'percent',  label: '% off',     hint: 'Discount as a %, e.g. 20% off' },
  { value: 'fixed',    label: 'Amount off', hint: 'Flat discount per ticket' },
  { value: 'override', label: 'Set price',  hint: 'Override per-ticket price (e.g. $400 tickets)' },
]

export function PromoCodesCard({ eventId, tiers, currency }) {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [code, setCode]         = useState('')
  const [kind, setKind]         = useState('percent')
  const [amount, setAmount]     = useState('')
  const [maxUses, setMaxUses]   = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [tierId, setTierId]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [copied, setCopied]     = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    setCodes(data || [])
    setLoading(false)
  }

  useEffect(() => { if (eventId) load() }, [eventId])

  const reset = () => {
    setCode(''); setKind('percent'); setAmount(''); setMaxUses(''); setExpiresAt(''); setTierId(''); setErr('')
  }

  const submit = async (e) => {
    e?.preventDefault()
    setErr('')
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) { setErr('Code is required'); return }
    if (!/^[A-Z0-9_-]{2,40}$/.test(cleanCode)) {
      setErr('Code must be 2–40 letters/numbers/dashes')
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 0) { setErr('Amount must be a positive number'); return }
    if (kind === 'percent' && (amt <= 0 || amt > 100)) { setErr('Percent must be 1–100'); return }

    let amount_cents
    if (kind === 'percent') amount_cents = Math.round(amt * 100)        // 20 → 2000 bps
    else                    amount_cents = Math.round(amt * 100)        // dollars/pesos → cents

    setBusy(true)
    try {
      const payload = {
        event_id: eventId,
        code: cleanCode,
        kind,
        amount_cents,
        max_uses:  maxUses ? Math.max(1, Math.floor(Number(maxUses))) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        tier_id:   tierId || null,
        active:    true,
      }
      const { error: insErr } = await supabase.from('promo_codes').insert(payload)
      if (insErr) {
        if (insErr.code === '23505') throw new Error('That code already exists for this event')
        throw insErr
      }
      reset()
      setShowForm(false)
      await load()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const toggleActive = async (pc) => {
    await supabase.from('promo_codes').update({ active: !pc.active }).eq('id', pc.id)
    setCodes(prev => prev.map(c => c.id === pc.id ? { ...c, active: !c.active } : c))
  }

  const remove = async (pc) => {
    if (!confirm(`Delete code ${pc.code}? This can't be undone.`)) return
    await supabase.from('promo_codes').delete().eq('id', pc.id)
    setCodes(prev => prev.filter(c => c.id !== pc.id))
  }

  const fmtKind = (pc) => {
    if (pc.kind === 'percent') return `${(pc.amount_cents / 100).toFixed(0)}% off`
    if (pc.kind === 'fixed')   return `${fmtPriceCents(pc.amount_cents, currency)} off`
    if (pc.kind === 'override') return `Set to ${fmtPriceCents(pc.amount_cents, currency)}`
    return pc.kind
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <SectionHead
          eyebrow="Promo codes"
          title={loading ? '…' : `${codes.length} active`}
          caption="Discounts buyers can apply at checkout"
        />
        <button
          onClick={() => { setShowForm(s => !s); reset() }}
          style={{
            background: showForm ? 'transparent' : BRAND.gradient,
            color: showForm ? C.textMid : '#000',
            border: showForm ? `1px solid ${C.border}` : 'none',
            borderRadius: '10px', padding: '0.5rem 1rem',
            fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer',
            fontFamily: FONT, flexShrink: 0,
          }}
        >
          {showForm ? 'Cancel' : '+ New code'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{
          background: '#0d0d14', border: `1px solid ${C.border}`,
          borderRadius: '12px', padding: '1rem', marginBottom: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <Label>Code</Label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="MARCARIO"
                style={{ ...INPUT, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>{kind === 'percent' ? 'Percent (1–100)' : kind === 'override' ? 'New price' : 'Amount off'}</Label>
              <input
                type="number" step="any" min="0"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={kind === 'percent' ? '20' : '50'}
                style={INPUT}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <Label>Max uses (optional)</Label>
              <input
                type="number" min="1"
                value={maxUses} onChange={e => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                style={INPUT}
              />
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <input
                type="datetime-local"
                value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                style={INPUT}
              />
            </div>
            <div>
              <Label>Tier (optional)</Label>
              <select
                value={tierId} onChange={e => setTierId(e.target.value)}
                style={{ ...INPUT, cursor: 'pointer' }}
              >
                <option value="">All tiers</option>
                {(tiers || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ color: C.textDim, fontSize: '0.74rem', lineHeight: 1.4 }}>
            {KIND_OPTIONS.find(o => o.value === kind)?.hint}
          </div>

          {err && <div style={{ color: BRAND.orange, fontSize: '0.78rem' }}>{err}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              background: BRAND.gradient, color: '#000', border: 'none',
              borderRadius: '10px', padding: '0.7rem',
              fontSize: '0.85rem', fontWeight: '800',
              cursor: busy ? 'wait' : 'pointer', fontFamily: FONT,
              opacity: busy ? 0.6 : 1, marginTop: '0.25rem',
            }}
          >
            {busy ? 'Creating…' : 'Create code'}
          </button>
        </form>
      )}

      {loading ? null : codes.length === 0 ? (
        <div style={{
          background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '1.5rem', textAlign: 'center', color: C.textMid, fontSize: '0.85rem',
        }}>
          No codes yet. Create one to comp press, reward early supporters, or run flash sales.
        </div>
      ) : (
        <div style={{
          background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {codes.map((pc, i) => {
            const expired = pc.expires_at && new Date(pc.expires_at) < new Date()
            const maxedOut = pc.max_uses != null && pc.used_count >= pc.max_uses
            const dead = !pc.active || expired || maxedOut
            const usedPct = pc.max_uses ? Math.min(1, pc.used_count / pc.max_uses) : 0
            const tierLabel = pc.tier_id ? (tiers || []).find(t => t.id === pc.tier_id)?.name : 'All tiers'

            return (
              <div key={pc.id} style={{
                padding: '0.85rem 1rem',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                opacity: dead ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{
                        color: C.text, fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.95rem', fontWeight: '800', letterSpacing: '0.08em',
                      }}>
                        {pc.code}
                      </div>
                      {expired && <span style={badgeStyle('neutral')}>EXPIRED</span>}
                      {maxedOut && !expired && <span style={badgeStyle('neutral')}>MAXED</span>}
                      {!pc.active && !expired && !maxedOut && <span style={badgeStyle('neutral')}>OFF</span>}
                      {!dead && <span style={badgeStyle('success')}>ACTIVE</span>}
                    </div>
                    <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.25rem' }}>
                      {fmtKind(pc)} · {tierLabel}
                      {pc.expires_at && ` · expires ${new Date(pc.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(pc.code)
                        setCopied(pc.id)
                        setTimeout(() => setCopied(''), 1500)
                      }}
                      style={ctrlBtn(copied === pc.id ? BRAND.neon : C.textMid)}
                    >
                      {copied === pc.id ? '✓' : 'Copy'}
                    </button>
                    <button onClick={() => toggleActive(pc)} style={ctrlBtn(C.textMid)}>
                      {pc.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(pc)} style={ctrlBtn(BRAND.orange)}>Delete</button>
                  </div>
                </div>

                {/* Usage bar */}
                <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    flex: 1, height: '5px', borderRadius: '99px',
                    background: '#1a1a24', overflow: 'hidden',
                    border: `1px solid ${C.border}`,
                  }}>
                    {pc.max_uses != null ? (
                      <div style={{
                        width: `${usedPct * 100}%`, height: '100%',
                        background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange})`,
                        transition: 'width 0.5s ease',
                      }} />
                    ) : null}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                    {pc.used_count}{pc.max_uses != null ? `/${pc.max_uses}` : ''} used
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── GUEST LIST CARD ─────────────────────────────────────────────────────────

export function GuestListCard({ event, tiers, tickets, onMinted }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [qty, setQty]     = useState(1)
  const [tierId, setTierId] = useState('')
  const [lang, setLang]     = useState('es')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')
  const [success, setSuccess] = useState(null)

  const comps = (tickets || []).filter(t => t.is_comp)
  const reset = () => { setName(''); setEmail(''); setQty(1); setTierId(''); setLang('es'); setErr(''); setSuccess(null) }

  const submit = async (e) => {
    e?.preventDefault()
    setErr('')
    if (!name.trim()) { setErr('Guest name required'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Valid email required'); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in expired — please reload.')
      const res = await fetch('/.netlify/functions/mint-comp-tickets', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          event_id: event.id,
          name: name.trim(),
          email: email.trim(),
          qty: Math.max(1, Number(qty) || 1),
          tier_id: tierId || null,
          lang,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Mint failed')
      setSuccess(json)
      setName(''); setEmail(''); setQty(1)
      onMinted?.()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <SectionHead
          eyebrow="Guest list"
          title={`${comps.length} comp${comps.length === 1 ? '' : 's'}`}
          caption="Free tickets for press, friends, talent — no card required"
        />
        <button
          onClick={() => { setShowForm(s => !s); reset() }}
          style={{
            background: showForm ? 'transparent' : BRAND.gradient,
            color: showForm ? C.textMid : '#000',
            border: showForm ? `1px solid ${C.border}` : 'none',
            borderRadius: '10px', padding: '0.5rem 1rem',
            fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer',
            fontFamily: FONT, flexShrink: 0,
          }}
        >
          {showForm ? 'Cancel' : '+ Add guest'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{
          background: '#0d0d14', border: `1px solid ${C.border}`,
          borderRadius: '12px', padding: '1rem', marginBottom: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <Label>Name</Label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Maddix" style={INPUT} />
            </div>
            <div>
              <Label>Email</Label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@example.com" style={INPUT} />
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <div>
              <Label>Quantity</Label>
              <input type="number" min="1" max="50" value={qty} onChange={e => setQty(e.target.value)} style={INPUT} />
            </div>
            <div>
              <Label>Tier</Label>
              <select value={tierId} onChange={e => setTierId(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                <option value="">Auto (first available)</option>
                {(tiers || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Email language</Label>
              <select value={lang} onChange={e => setLang(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                <option value="es">Spanish</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div style={{ color: C.textDim, fontSize: '0.74rem', lineHeight: 1.4 }}>
            Comps consume capacity but not revenue. The guest gets the same email and QR as a paid buyer.
          </div>

          {err && <div style={{ color: BRAND.orange, fontSize: '0.78rem' }}>{err}</div>}

          <button type="submit" disabled={busy} style={{
            background: BRAND.gradient, color: '#000', border: 'none',
            borderRadius: '10px', padding: '0.7rem',
            fontSize: '0.85rem', fontWeight: '800',
            cursor: busy ? 'wait' : 'pointer', fontFamily: FONT,
            opacity: busy ? 0.6 : 1, marginTop: '0.25rem',
          }}>
            {busy ? 'Adding…' : 'Add to guest list & email'}
          </button>

          {success && (
            <div style={{
              background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`,
              borderRadius: '10px', padding: '0.6rem 0.85rem',
              color: BRAND.neon, fontSize: '0.8rem',
            }}>
              ✓ Minted {success.tickets?.length || 0} {success.tier_name} ticket(s).
              {success.email_sent ? ' Confirmation emailed.' : ' Email failed — share the ticket link manually.'}
            </div>
          )}
        </form>
      )}

      {comps.length === 0 ? (
        <div style={{
          background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '1.5rem', textAlign: 'center', color: C.textMid, fontSize: '0.85rem',
        }}>
          No guests on the list yet.
        </div>
      ) : (
        <div style={{
          background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {comps.slice(0, 12).map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              padding: '0.6rem 0.95rem',
              borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
            }}>
              <div style={{ width: '28px', textAlign: 'center', color: C.textMid, fontSize: '0.78rem', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                #{c.ticket_number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name || '—'}
                </div>
                <div style={{ color: C.textMid, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.email}{c.tier_name && ` · ${c.tier_name}`}
                </div>
              </div>
              <span style={{
                fontSize: '0.62rem', color: BRAND.purple || '#b57bff',
                letterSpacing: '0.12em', fontWeight: '800',
                padding: '0.15rem 0.55rem',
                background: `${BRAND.purple || '#b57bff'}18`,
                border: `1px solid ${(BRAND.purple || '#b57bff')}44`,
                borderRadius: '99px', flexShrink: 0,
              }}>
                COMP
              </span>
            </div>
          ))}
          {comps.length > 12 && (
            <div style={{ padding: '0.5rem 0.95rem', color: C.textDim, fontSize: '0.74rem', textAlign: 'center', borderTop: `1px solid ${C.border}` }}>
              + {comps.length - 12} more in the attendee list below
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{
      fontSize: '0.62rem', color: C.textMid, textTransform: 'uppercase',
      letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.3rem',
    }}>{children}</div>
  )
}

function ctrlBtn(color) {
  return {
    background: 'transparent', border: `1px solid ${C.border}`, color,
    borderRadius: '6px', padding: '0.35rem 0.65rem',
    fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer',
    fontFamily: FONT,
  }
}
