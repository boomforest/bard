import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { createEventFromSetup } from './eventService'
import { FEATURED_DRINKS } from './featuredDrinks'

// Builds the default barItems[] for a brand-new event — the 4 featured
// hydration-forward drinks with their default prices. Promoters can edit
// the price, remove any of them, or add custom items on top.
const buildFeaturedBarItems = () => FEATURED_DRINKS.map((d, i) => ({
  id:       `feat-${d.slug}-${Date.now() + i}`,
  name:     d.name,
  price:    String(d.defaultPrice),
  category: d.category,
  desc:     '',
  featured: true,
}))

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#080808',
  surface:   '#0f0f0f',
  card:      '#131313',
  border:    '#1e1e1e',
  gold:      '#c8922a',
  goldLight: '#e8b84b',
  goldDim:   '#6b4a14',
  green:     '#22c55e',
  greenDim:  '#14532d',
  text:      '#f0ece4',
  textMid:   '#7a7060',
  textDim:   '#3a3028',
  red:       '#ef4444',
  blue:      '#5b9bff',
}

// ─── STEPS CONFIG ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'info',    label: 'Event'    },
  { id: 'splits',  label: 'Contract' },
  { id: 'tickets', label: 'Tickets'  },
  { id: 'bar',     label: 'Bar'      },
  { id: 'payout',  label: 'Payout'   },
  { id: 'review',  label: 'Launch'   },
]

const ROLES = ['Promoter', 'Venue', 'Artist', 'Manager', 'Co-Promoter', 'Sponsor']

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{ fontSize: '0.62rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.45rem' }}>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: '#111', border: `1px solid ${C.border}`,
        borderRadius: '10px', color: C.text,
        padding: '0.75rem 0.9rem', fontSize: '0.9rem',
        outline: 'none', fontFamily: 'inherit',
        ...style,
      }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: '#111', border: `1px solid ${C.border}`,
        borderRadius: '10px', color: C.text,
        padding: '0.75rem 0.9rem', fontSize: '0.9rem',
        outline: 'none', fontFamily: 'inherit', resize: 'vertical',
      }}
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        background: '#111', border: `1px solid ${C.border}`,
        borderRadius: '10px', color: C.text,
        padding: '0.75rem 0.9rem', fontSize: '0.9rem',
        outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
        appearance: 'none',
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function FieldGroup({ children, columns = 1 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1rem', marginBottom: '1.2rem' }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  )
}

function NavButtons({ onBack, onNext, nextLabel = 'Continue', backLabel = 'Back', nextDisabled = false }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
      {onBack && (
        <button onClick={onBack} style={{
          flex: 1, background: 'transparent', border: `1px solid ${C.border}`,
          color: C.textMid, borderRadius: '10px', padding: '0.85rem',
          fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
        }}>
          {backLabel}
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          flex: 2,
          background: nextDisabled ? '#1a1a1a' : `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: nextDisabled ? C.textMid : '#000',
          border: 'none', borderRadius: '10px', padding: '0.85rem',
          fontSize: '0.9rem', fontWeight: '800',
          cursor: nextDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

// ─── STEP 1: EVENT INFO ───────────────────────────────────────────────────────
function StepInfo({ data, setData, onNext }) {
  const flyerRef = useRef()
  const [preview, setPreview] = useState(data.flyerPreview || null)

  const set = key => e => setData(d => ({ ...d, [key]: e.target.value }))

  const handleFlyer = e => {
    const file = e.target.files[0]
    if (!file) return
    setData(d => ({ ...d, flyer: file }))
    const reader = new FileReader()
    reader.onload = ev => {
      setPreview(ev.target.result)
      setData(d => ({ ...d, flyerPreview: ev.target.result }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <SectionHeader title="Event Info" sub="The basics — name, date, where." />

      {/* Flyer upload */}
      <div style={{ marginBottom: '1.2rem' }}>
        <Label>Flyer / Cover Image</Label>
        <div
          onClick={() => flyerRef.current.click()}
          style={{
            border: `1.5px dashed ${preview ? C.goldDim : C.border}`,
            borderRadius: '12px', overflow: 'hidden',
            height: preview ? 'auto' : '120px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: '#0d0d0d', position: 'relative',
          }}
        >
          {preview ? (
            <img src={preview} alt="Flyer" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ textAlign: 'center', color: C.textMid, fontSize: '0.85rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>+</div>
              Upload flyer
            </div>
          )}
          {preview && (
            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.6)', color: C.textMid, fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
              tap to change
            </div>
          )}
        </div>
        <input ref={flyerRef} type="file" accept="image/*" onChange={handleFlyer} style={{ display: 'none' }} />
      </div>

      <FieldGroup>
        <Field label="Event Name">
          <Input value={data.name} onChange={set('name')} placeholder="e.g. Rooftop Sessions Vol. 4" />
        </Field>
      </FieldGroup>

      <FieldGroup columns={2}>
        <Field label="Date">
          <Input type="date" value={data.date} onChange={set('date')} />
        </Field>
        <Field label="Doors Open">
          <Input type="time" value={data.time} onChange={set('time')} />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Venue Name">
          <Input value={data.venue} onChange={set('venue')} placeholder="e.g. The Rooftop" />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Address">
          <Input value={data.address} onChange={set('address')} placeholder="123 Main St, Atlanta, GA" />
        </Field>
      </FieldGroup>

      <FieldGroup columns={2}>
        <Field label="Capacity">
          <Input type="number" value={data.capacity} onChange={set('capacity')} placeholder="200" />
        </Field>
        <Field label="Age Restriction">
          <Select value={data.age} onChange={set('age')} options={['All Ages', '18+', '21+']} />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field label="Description (optional)">
          <Textarea value={data.description} onChange={set('description')} placeholder="What's the vibe? Who's playing?" rows={3} />
        </Field>
      </FieldGroup>

      <NavButtons onNext={onNext} nextDisabled={!data.name || !data.date || !data.venue} />
    </div>
  )
}

// ─── STEP 2: CONTRACT / SPLITS ────────────────────────────────────────────────
function StepSplits({ data, setData, onBack, onNext }) {
  const [newName,  setNewName]  = useState('')
  const [newRole,  setNewRole]  = useState('Promoter')
  const [newSplit, setNewSplit] = useState('')
  const [error,    setError]    = useState('')

  const producers = data.producers || []
  const totalSplit = producers.reduce((s, p) => s + Number(p.split), 0)
  const remaining  = 100 - totalSplit

  const addProducer = () => {
    if (!newName.trim()) { setError('Add a name'); return }
    const split = Number(newSplit)
    if (!split || split <= 0) { setError('Enter a valid split %'); return }
    if (split > remaining) { setError(`Only ${remaining}% remaining`); return }
    setData(d => ({ ...d, producers: [...(d.producers || []), { name: newName.trim(), role: newRole, split, signed: false }] }))
    setNewName(''); setNewSplit(''); setError('')
  }

  const remove = idx => setData(d => ({ ...d, producers: d.producers.filter((_, i) => i !== idx) }))

  const toggleSign = idx => setData(d => ({
    ...d,
    producers: d.producers.map((p, i) => i === idx ? { ...p, signed: !p.signed } : p),
  }))

  const allSigned = producers.length > 0 && producers.every(p => p.signed) && totalSplit === 100

  const ROLE_COLORS = {
    Promoter:    '#e8b84b',
    Venue:       '#5b9bff',
    Artist:      '#c084fc',
    Manager:     '#fb923c',
    'Co-Promoter': '#34d399',
    Sponsor:     '#f472b6',
  }

  return (
    <div>
      <SectionHeader title="Contract & Splits" sub="Who gets paid, and how much. Everyone signs before the show goes live." />

      {/* Split visual */}
      {producers.length > 0 && (
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', height: '10px', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.5rem', background: C.border }}>
            {producers.map((p, i) => (
              <div key={i} style={{ width: `${p.split}%`, background: ROLE_COLORS[p.role] || C.gold, transition: 'width 0.3s' }} />
            ))}
            {remaining > 0 && <div style={{ flex: 1, background: C.textDim }} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {producers.map((p, i) => (
              <span key={i} style={{ fontSize: '0.68rem', color: ROLE_COLORS[p.role] || C.gold, fontWeight: '700' }}>
                {p.name} {p.split}%
              </span>
            ))}
            {remaining > 0 && (
              <span style={{ fontSize: '0.68rem', color: C.textDim, fontWeight: '600' }}>{remaining}% unassigned</span>
            )}
          </div>
        </div>
      )}

      {/* Existing producers */}
      {producers.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: p.signed ? '#0a120a' : '#111',
          border: `1px solid ${p.signed ? C.green + '44' : C.border}`,
          borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '0.5rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
              <span style={{ fontWeight: '700', color: C.text, fontSize: '0.9rem' }}>{p.name}</span>
              <span style={{
                fontSize: '0.6rem', fontWeight: '700', padding: '0.1rem 0.45rem', borderRadius: '99px',
                background: (ROLE_COLORS[p.role] || C.gold) + '22',
                color: ROLE_COLORS[p.role] || C.gold,
              }}>{p.role}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: C.textMid }}>{p.split}% of net revenue</div>
          </div>
          <button
            onClick={() => toggleSign(i)}
            style={{
              background: p.signed ? C.greenDim : '#1a1a1a',
              border: `1px solid ${p.signed ? C.green : C.border}`,
              color: p.signed ? C.green : C.textMid,
              borderRadius: '8px', padding: '0.4rem 0.8rem',
              fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {p.signed ? '✓ Signed' : 'Sign'}
          </button>
          <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}>×</button>
        </div>
      ))}

      {/* Add producer form */}
      {totalSplit < 100 && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '0.9rem', marginBottom: '0.5rem' }}>
          <Label>Add a party</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              style={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, padding: '0.75rem 0.7rem', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <Input value={newSplit} onChange={e => setNewSplit(e.target.value)} placeholder="%" type="number" style={{ width: '64px' }} />
          </div>
          {error && <div style={{ color: C.red, fontSize: '0.72rem', marginBottom: '0.4rem' }}>{error}</div>}
          <button onClick={addProducer} style={{
            width: '100%', background: C.card, border: `1px solid ${C.border}`,
            color: C.textMid, borderRadius: '8px', padding: '0.6rem',
            fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer',
          }}>
            + Add party
          </button>
        </div>
      )}

      {totalSplit === 100 && !allSigned && (
        <div style={{ fontSize: '0.78rem', color: C.textMid, textAlign: 'center', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          All parties must sign before the show goes live.
        </div>
      )}

      {allSigned && (
        <div style={{ background: '#0a120a', border: `1px solid ${C.green}44`, borderRadius: '10px', padding: '0.7rem 1rem', textAlign: 'center', color: C.green, fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Contract locked — all parties signed
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={producers.length === 0 || totalSplit !== 100} />
    </div>
  )
}

// ─── STEP 3: TICKETS ──────────────────────────────────────────────────────────
function StepTickets({ data, setData, onBack, onNext }) {
  const tiers = data.tiers || []

  const addTier = () => setData(d => ({
    ...d,
    tiers: [...(d.tiers || []), { id: Date.now(), name: '', price: '', qty: '', desc: '' }],
  }))

  const updateTier = (id, key, val) => setData(d => ({
    ...d,
    tiers: d.tiers.map(t => t.id === id ? { ...t, [key]: val } : t),
  }))

  const removeTier = id => setData(d => ({ ...d, tiers: d.tiers.filter(t => t.id !== id) }))

  return (
    <div>
      <SectionHeader title="Tickets" sub="Set your tiers, prices, and how many of each." />

      {tiers.map((tier, i) => (
        <div key={tier.id} style={{
          background: '#111', border: `1px solid ${C.border}`,
          borderRadius: '14px', padding: '1rem', marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.7rem', color: C.textMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tier {i + 1}</div>
            <button onClick={() => removeTier(tier.id)} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '1rem' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div>
              <Label>Name</Label>
              <Input value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} placeholder="General Admission" />
            </div>
            <div>
              <Label>Price ($)</Label>
              <Input type="number" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} placeholder="25" />
            </div>
            <div>
              <Label>Qty</Label>
              <Input type="number" value={tier.qty} onChange={e => updateTier(tier.id, 'qty', e.target.value)} placeholder="100" />
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input value={tier.desc} onChange={e => updateTier(tier.id, 'desc', e.target.value)} placeholder="Includes one drink ticket" />
          </div>
        </div>
      ))}

      <button onClick={addTier} style={{
        width: '100%', background: 'transparent', border: `1.5px dashed ${C.border}`,
        color: C.textMid, borderRadius: '12px', padding: '0.85rem',
        fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', marginBottom: '0.5rem',
      }}>
        + Add ticket tier
      </button>

      {tiers.length > 0 && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.68rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Summary</div>
          {tiers.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: C.text, marginBottom: '0.2rem' }}>
              <span>{t.name || '—'}</span>
              <span style={{ color: C.textMid }}>{t.qty ? `${t.qty} × ` : ''}<span style={{ color: C.goldLight }}>${t.price || '—'}</span></span>
            </div>
          ))}
          {tiers.length > 0 && tiers[0].qty && tiers[0].price && (
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: C.textMid }}>Max gross</span>
              <span style={{ color: C.goldLight, fontWeight: '700' }}>
                ${tiers.reduce((s, t) => s + (Number(t.qty) * Number(t.price) || 0), 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={tiers.length === 0 || tiers.some(t => !t.name || !t.price || !t.qty)} />
    </div>
  )
}

// ─── STEP 4: BAR ──────────────────────────────────────────────────────────────
function StepBar({ data, setData, onBack, onNext }) {
  const items      = data.barItems || []
  const barEnabled = data.barEnabled !== false

  const addItem = () => setData(d => ({
    ...d,
    barItems: [...(d.barItems || []), { id: Date.now(), name: '', price: '', category: 'Drinks', desc: '' }],
  }))

  const updateItem = (id, key, val) => setData(d => ({
    ...d,
    barItems: d.barItems.map(it => it.id === id ? { ...it, [key]: val } : it),
  }))

  const removeItem = id => setData(d => ({ ...d, barItems: d.barItems.filter(it => it.id !== id) }))

  const CATEGORIES = ['Drinks', 'Beer', 'Cocktails', 'Shots', 'Non-Alcoholic', 'Food', 'Merch']

  return (
    <div>
      <SectionHeader title="Bar Menu" sub="What are you selling? Set items and prices. Fans order from their phone." />

      {/* Bar on/off toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#111', border: `1px solid ${C.border}`, borderRadius: '12px',
        padding: '0.9rem 1rem', marginBottom: '1.2rem',
      }}>
        <div>
          <div style={{ fontWeight: '700', color: C.text, fontSize: '0.9rem' }}>Enable bar ordering</div>
          <div style={{ fontSize: '0.75rem', color: C.textMid, marginTop: '0.1rem' }}>Fans order and pay from their phone</div>
        </div>
        <button
          onClick={() => setData(d => ({ ...d, barEnabled: !barEnabled }))}
          style={{
            width: '48px', height: '26px', borderRadius: '99px',
            background: barEnabled ? C.gold : C.border,
            border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px',
            left: barEnabled ? '25px' : '3px',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {barEnabled && (
        <>
          {items.map((item, i) => (
            <div key={item.id} style={{
              background: '#111', border: `1px solid ${item.featured ? C.gold + '44' : C.border}`,
              borderRadius: '14px', padding: '0.9rem', marginBottom: '0.65rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: C.textMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {item.featured ? item.name : `Custom ${i + 1}`}
                  </div>
                  {item.featured && (
                    <span style={{ fontSize: '0.6rem', color: C.gold, background: C.gold + '15', border: `1px solid ${C.gold}55`, borderRadius: '99px', padding: '0.1rem 0.45rem', fontWeight: '700', letterSpacing: '0.08em' }}>
                      FEATURED
                    </span>
                  )}
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '1rem' }}>×</button>
              </div>

              {item.featured ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <Label>Item Name</Label>
                    <Input value={item.name} disabled style={{ opacity: 0.7 }} />
                  </div>
                  <div>
                    <Label>Price (🕊)</Label>
                    <Input type="number" value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div>
                      <Label>Item Name</Label>
                      <Input value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} placeholder="Michelada" />
                    </div>
                    <div>
                      <Label>Price (🕊)</Label>
                      <Input type="number" value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} placeholder="8" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={item.category}
                        onChange={e => updateItem(item.id, 'category', e.target.value)}
                        style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, padding: '0.75rem 0.7rem', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={item.desc} onChange={e => updateItem(item.id, 'desc', e.target.value)} placeholder="Short tagline" />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          <button onClick={addItem} style={{
            width: '100%', background: 'transparent', border: `1.5px dashed ${C.border}`,
            color: C.textMid, borderRadius: '12px', padding: '0.85rem',
            fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer',
          }}>
            + Add custom item
          </button>
        </>
      )}

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ─── STEP 5: PAYOUT ───────────────────────────────────────────────────────────
function StepPayout({ data, setData, onBack, onNext }) {
  const [connecting, setConnecting] = useState(false)
  const [done,       setDone]       = useState(data.stripeConnected || false)
  const [errMsg,     setErrMsg]     = useState('')

  // On mount, check whether the current user already has a connected,
  // charges-enabled Stripe account from a previous session.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      try {
        const res = await fetch('/.netlify/functions/stripe-connect-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user.id }),
        })
        const json = await res.json()
        if (!cancelled && json.charges_enabled && json.details_submitted) {
          setDone(true)
          setData(d => ({ ...d, stripeConnected: true }))
        }
      } catch {/* ignore */}
    }
    check()
    return () => { cancelled = true }
  }, [setData])

  const connect = async () => {
    setConnecting(true)
    setErrMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Sign in first')
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
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not start Stripe onboarding')
      window.location.href = json.url
    } catch (err) {
      setErrMsg(err.message)
      setConnecting(false)
    }
  }

  return (
    <div>
      <SectionHeader title="Payouts" sub="Connect your bank. Money lands as tickets and drinks sell." />

      <div style={{ marginBottom: '1.2rem' }}>
        {/* Stripe Connect card */}
        <div style={{
          background: done ? '#0a120a' : '#111',
          border: `1px solid ${done ? C.green + '44' : C.border}`,
          borderRadius: '14px', padding: '1.2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.8rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#635bff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: '900', color: '#fff', flexShrink: 0,
            }}>S</div>
            <div>
              <div style={{ fontWeight: '700', color: C.text, fontSize: '0.9rem' }}>Stripe Connect</div>
              <div style={{ fontSize: '0.72rem', color: C.textMid }}>
                {done ? 'Account connected — payouts active' : 'Connect your bank account'}
              </div>
            </div>
            {done && <div style={{ marginLeft: 'auto', color: C.green, fontSize: '1.2rem' }}>✓</div>}
          </div>

          {!done && (
            <>
              <button
                onClick={connect}
                disabled={connecting}
                style={{
                  width: '100%', background: connecting ? '#1a1a1a' : '#635bff',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  padding: '0.8rem', fontSize: '0.9rem', fontWeight: '700',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                }}
              >
                {connecting ? 'Redirecting to Stripe…' : 'Connect with Stripe'}
              </button>
              {errMsg && (
                <div style={{ color: C.red, fontSize: '0.78rem', marginTop: '0.5rem' }}>{errMsg}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payout schedule info */}
      <div style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' }}>
        <Label>How payouts work</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            ['Ticket sales', 'Transferred as each ticket sells, minus 2%'],
            ['Bar sales',    'Settled at end of night after redemptions'],
            ['Refunds',      'Unused doves refunded to fans within 24 hours'],
            ['Split',        'Each party in the contract receives their % automatically'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.gold, marginTop: '0.45rem', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: '700', color: C.text, fontSize: '0.82rem' }}>{title} — </span>
                <span style={{ color: C.textMid, fontSize: '0.82rem' }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!done} nextLabel={done ? 'Review & Launch' : 'Connect to continue'} />
    </div>
  )
}

// ─── STEP 6: REVIEW & LAUNCH ──────────────────────────────────────────────────
function StepReview({ data, onBack, onLaunch, launching, launchError, launchedSlug }) {
  const tiers    = data.tiers    || []
  const barItems = data.barItems || []
  const producers = data.producers || []

  if (launchedSlug) {
    const link = `${window.location.origin}/e/${launchedSlug}`
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🕊</div>
        <div style={{
          fontSize: '1.6rem', fontWeight: '900', marginBottom: '0.4rem',
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {data.name} is live.
        </div>
        <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Share your link and start selling.<br />
          Money moves as tickets go.
        </div>
        <div style={{
          background: '#111', border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '0.9rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          marginBottom: '1rem', textAlign: 'left',
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Your event link</div>
            <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {link}
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(link)}
            style={{ background: C.gold, color: '#000', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            Copy
          </button>
        </div>
        <a
          href={`/promoter/event/${launchedSlug}`}
          style={{
            display: 'block', textAlign: 'center',
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
            color: '#000', borderRadius: '12px', padding: '0.95rem',
            fontSize: '0.95rem', fontWeight: '800', textDecoration: 'none',
            marginBottom: '0.5rem',
          }}
        >
          Open event dashboard →
        </a>
        <a
          href="/promoter"
          style={{
            display: 'block', textAlign: 'center',
            background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
            borderRadius: '10px', padding: '0.7rem',
            fontSize: '0.85rem', textDecoration: 'none',
          }}
        >
          Back to all events
        </a>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Review & Launch" sub="One last look before your show goes live." />

      {/* Event summary */}
      <ReviewCard title="Event">
        <ReviewRow label="Name"  value={data.name} />
        <ReviewRow label="Date"  value={data.date} />
        <ReviewRow label="Venue" value={data.venue} />
        <ReviewRow label="Doors" value={data.time} />
        <ReviewRow label="Capacity" value={data.capacity} />
        <ReviewRow label="Age" value={data.age} />
      </ReviewCard>

      {/* Contract */}
      <ReviewCard title="Contract">
        {producers.map((p, i) => (
          <ReviewRow key={i} label={p.role} value={`${p.name} — ${p.split}%`} signed={p.signed} />
        ))}
      </ReviewCard>

      {/* Tickets */}
      <ReviewCard title="Tickets">
        {tiers.map(t => (
          <ReviewRow key={t.id} label={t.name} value={`$${t.price} · ${t.qty} available`} />
        ))}
      </ReviewCard>

      {/* Bar */}
      <ReviewCard title="Bar">
        {data.barEnabled === false ? (
          <div style={{ color: C.textMid, fontSize: '0.82rem' }}>Bar ordering disabled</div>
        ) : barItems.length === 0 ? (
          <div style={{ color: C.textMid, fontSize: '0.82rem' }}>No items added</div>
        ) : barItems.map(it => (
          <ReviewRow key={it.id} label={it.name} value={`🕊 ${it.price}`} />
        ))}
      </ReviewCard>

      {/* Payout */}
      <ReviewCard title="Payout">
        <ReviewRow label="Stripe" value="Connected" signed={true} />
        <ReviewRow label="GRAIL fee" value="2% of all revenue" />
      </ReviewCard>

      {launchError && (
        <div style={{ background: '#1a0808', border: `1px solid ${C.red}55`, borderRadius: '10px', padding: '0.75rem 1rem', color: C.red, fontSize: '0.82rem', marginTop: '1rem' }}>
          {launchError}
        </div>
      )}

      <button
        onClick={onLaunch}
        disabled={launching}
        style={{
          width: '100%', marginTop: '1rem',
          background: launching ? '#1a1a1a' : `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: launching ? C.textMid : '#000', border: 'none', borderRadius: '12px',
          padding: '1.1rem', fontSize: '1.05rem', fontWeight: '900',
          cursor: launching ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em',
        }}
      >
        {launching ? 'Launching…' : 'Go Live'}
      </button>

      <button onClick={onBack} disabled={launching} style={{ width: '100%', marginTop: '0.6rem', background: 'transparent', border: 'none', color: C.textMid, fontSize: '0.85rem', cursor: launching ? 'not-allowed' : 'pointer', padding: '0.5rem' }}>
        ← Back
      </button>
    </div>
  )
}

function ReviewCard({ title, children }) {
  return (
    <div style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.62rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.6rem' }}>{title}</div>
      {children}
    </div>
  )
}

function ReviewRow({ label, value, signed }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
      <span style={{ fontSize: '0.82rem', color: C.textMid }}>{label}</span>
      <span style={{ fontSize: '0.82rem', color: signed ? C.green : C.text, fontWeight: signed ? '700' : '500' }}>
        {signed && '✓ '}{value}
      </span>
    </div>
  )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontWeight: '900', fontSize: '1.3rem', color: C.text, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>{title}</div>
      <div style={{ fontSize: '0.82rem', color: C.textMid, lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
function StepIndicator({ current, onJump }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '2rem' }}>
      {STEPS.map((s, i) => {
        const done    = i < current
        const active  = i === current
        const clickable = !!onJump  // any step is jumpable; data persists in parent
        return (
          <button
            type="button"
            key={s.id}
            onClick={clickable ? () => onJump(i) : undefined}
            disabled={!clickable}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
              background: 'transparent', border: 'none', padding: '0.25rem 0.1rem',
              cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit',
            }}
          >
            <div style={{
              height: '3px', width: '100%', borderRadius: '99px',
              background: done ? C.gold : active ? C.goldDim : C.border,
              transition: 'background 0.3s',
            }} />
            <div style={{
              fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700',
              color: done ? C.gold : active ? C.goldLight : C.textDim,
              transition: 'color 0.3s',
            }}>
              {s.label}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function GrailSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    // info
    name: '', date: '', time: '', venue: '', address: '', capacity: '', age: '21+', description: '', flyer: null, flyerPreview: null,
    // splits
    producers: [],
    // tickets
    tiers: [],
    // bar
    barEnabled: true, barItems: buildFeaturedBarItems(),
    // payout
    stripeConnected: false,
  })

  const [launching,    setLaunching]    = useState(false)
  const [launchError,  setLaunchError]  = useState('')
  const [launchedSlug, setLaunchedSlug] = useState(null)

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))

  const handleLaunch = async () => {
    setLaunching(true)
    setLaunchError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Sign in to launch an event.')
      const event = await createEventFromSetup(data, session.user.id)
      setLaunchedSlug(event.slug)
    } catch (err) {
      setLaunchError(err.message || 'Could not launch the event.')
    }
    setLaunching(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0',
    }}>
      {/* Top nav */}
      <div style={{
        width: '100%', maxWidth: '560px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem 0',
        boxSizing: 'border-box',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
          ← GRAIL
        </button>
        <div style={{
          fontSize: '0.75rem', fontWeight: '900', letterSpacing: '-0.01em',
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          New Show
        </div>
        <div style={{ width: '60px' }} />
      </div>

      {/* Content */}
      <div style={{ width: '100%', maxWidth: '560px', padding: '1.5rem 1.5rem 4rem', boxSizing: 'border-box' }}>
        <StepIndicator current={step} onJump={setStep} />

        {step === 0 && <StepInfo    data={data} setData={setData} onNext={next} />}
        {step === 1 && <StepSplits  data={data} setData={setData} onBack={back} onNext={next} />}
        {step === 2 && <StepTickets data={data} setData={setData} onBack={back} onNext={next} />}
        {step === 3 && <StepBar     data={data} setData={setData} onBack={back} onNext={next} />}
        {step === 4 && <StepPayout  data={data} setData={setData} onBack={back} onNext={next} />}
        {step === 5 && <StepReview
          data={data}
          onBack={back}
          onLaunch={handleLaunch}
          launching={launching}
          launchError={launchError}
          launchedSlug={launchedSlug}
        />}
      </div>
    </div>
  )
}
