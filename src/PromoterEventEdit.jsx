import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { uploadFlyer } from './eventService'
import { CURRENCIES } from './currencies'
import { BRAND, C, FONT, INPUT, PAGE, eyebrowStyle, LogoMark } from './theme'

const AGE_OPTIONS = ['All Ages', '18+', '21+']

// Convert a stored ISO timestamp + doors_time string into the values
// our <input type="date"> / <input type="time"> need.
function dateForInput(iso) {
  if (!iso) return ''
  // Format: yyyy-mm-dd (CDMX local)
  const d = new Date(iso)
  const cdmx = new Date(d.getTime() - 6 * 60 * 60 * 1000) // shift UTC -> CDMX
  return cdmx.toISOString().slice(0, 10)
}

export default function PromoterEventEdit() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(undefined)
  const [event, setEvent]     = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Form state
  const [name, setName]               = useState('')
  const [date, setDate]               = useState('')
  const [time, setTime]               = useState('')
  const [venue, setVenue]             = useState('')
  const [address, setAddress]         = useState('')
  const [capacity, setCapacity]       = useState('')
  const [age, setAge]                 = useState('21+')
  const [currency, setCurrency]       = useState('mxn')
  const [description, setDescription] = useState('')
  const [active, setActive]           = useState(true)
  const [flyerFile, setFlyerFile]     = useState(null)
  const [flyerPreview, setFlyerPreview] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setError('Sign in to edit this event.'); setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: ev, error: evErr } = await supabase
        .from('events').select('*').eq('slug', slug).maybeSingle()
      if (cancelled) return
      if (evErr || !ev) { setError('Event not found.'); setLoading(false); return }
      if (ev.promoter_id !== session.user.id) { setError('You do not have access to this event.'); setLoading(false); return }
      setEvent(ev)
      setName(ev.name || ev.artist_name || '')
      setDate(dateForInput(ev.show_date || ev.event_date))
      setTime(ev.doors_time || '')
      setVenue(ev.venue_hint || '')
      setAddress(ev.venue_address || ev.address || '')
      setCapacity(ev.capacity ?? '')
      setAge(ev.age_restriction || '21+')
      setCurrency((ev.currency || 'mxn').toLowerCase())
      setDescription(ev.description || '')
      setActive(ev.active !== false)
      setFlyerPreview(ev.flyer_url || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [session, slug])

  const handleFlyer = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setFlyerFile(file)
    const reader = new FileReader()
    reader.onload = ev => setFlyerPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async (e) => {
    e?.preventDefault()
    if (!event) return
    setSaving(true)
    setError('')

    try {
      let showDateIso = event.show_date || event.event_date
      if (date) {
        const t = time || '21:00'
        showDateIso = new Date(`${date}T${t}:00-06:00`).toISOString()
      }

      let flyerUrl = event.flyer_url
      if (flyerFile) {
        try {
          const url = await uploadFlyer(flyerFile, event.slug)
          if (url) flyerUrl = url
        } catch (uploadErr) {
          console.warn('Flyer upload failed:', uploadErr.message)
        }
      }

      const newCapacity = Number(capacity) || event.capacity || 0
      if (newCapacity < (event.tickets_sold || 0)) {
        throw new Error(`Capacity can't be lower than tickets already sold (${event.tickets_sold})`)
      }

      const { error: updErr } = await supabase
        .from('events')
        .update({
          name,
          artist_name:     name,
          show_date:       showDateIso,
          doors_time:      time || null,
          venue_hint:      venue || null,
          venue_address:   address || null,
          capacity:        newCapacity,
          age_restriction: age || null,
          currency:        (currency || 'mxn').toLowerCase(),
          description:     description || null,
          active,
          flyer_url:       flyerUrl,
        })
        .eq('id', event.id)

      if (updErr) throw updErr
      navigate(`/promoter/event/${event.slug}`)
    } catch (err) {
      setError(err.message || 'Could not save changes.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (error && !event) {
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

  return (
    <div style={{ ...PAGE, padding: '2rem 1.5rem 4rem' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate(`/promoter/event/${slug}`)} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
          }}>
            ← Cancel
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
        </div>

        <div style={eyebrowStyle()}>Edit Event</div>
        <div style={{ color: C.text, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '1.75rem' }}>
          {event?.name || event?.artist_name}
        </div>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Flyer */}
          <Field label="Flyer">
            <label style={{
              display: 'block', cursor: 'pointer',
              border: `1.5px dashed ${flyerPreview ? BRAND.pink + '55' : C.border}`,
              borderRadius: '12px', overflow: 'hidden',
              background: '#0d0d14', textAlign: 'center',
            }}>
              {flyerPreview ? (
                <img src={flyerPreview} alt="Flyer" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ padding: '2rem', color: C.textMid, fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>+</div>
                  Upload flyer
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFlyer} style={{ display: 'none' }} />
            </label>
          </Field>

          <Field label="Name">
            <input style={INPUT} value={name} onChange={e => setName(e.target.value)} required />
          </Field>

          <Row>
            <Field label="Date">
              <input style={INPUT} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Doors">
              <input style={INPUT} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </Field>
          </Row>

          <Field label="Venue">
            <input style={INPUT} value={venue} onChange={e => setVenue(e.target.value)} placeholder="The Rooftop" />
          </Field>

          <Field label="Address">
            <input style={INPUT} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City" />
          </Field>

          <Row>
            <Field label="Capacity">
              <input style={INPUT} type="number" value={capacity} onChange={e => setCapacity(e.target.value)} min={event?.tickets_sold || 0} />
            </Field>
            <Field label="Age">
              <select value={age} onChange={e => setAge(e.target.value)} style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}>
                {AGE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </Row>

          <Field label="Currency">
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{ ...INPUT, resize: 'vertical', minHeight: '100px', lineHeight: 1.5 }}
            />
          </Field>

          <Field label="Status">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                style={{ accentColor: BRAND.pink }}
              />
              <span style={{ color: C.text, fontSize: '0.88rem' }}>
                Event is live (uncheck to take the ticket page offline)
              </span>
            </label>
          </Field>

          {error && (
            <div style={{ background: 'rgba(240,112,32,0.08)', border: `1px solid ${BRAND.orange}55`, borderRadius: '10px', padding: '0.75rem 1rem', color: BRAND.orange, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.95rem', fontSize: '0.95rem', fontWeight: '800', cursor: saving ? 'wait' : 'pointer',
            fontFamily: FONT, marginTop: '0.5rem', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: '0.68rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.4rem' }}>
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      {children}
    </div>
  )
}
