import { supabase } from './supabase'
import { FEATURED_DRINKS } from './featuredDrinks'

// True when an id is a UUID (existing DB row), false when it's a Date.now()
// number (new row added in the editor that hasn't been saved yet).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (id) => typeof id === 'string' && UUID_RE.test(id)
const FEATURED_NAMES = FEATURED_DRINKS.map(d => d.name.toLowerCase())

// ─── Slug helpers ─────────────────────────────────────────────────────────────

const baseSlug = (name) =>
  (name || 'event')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'event'

// Generate a unique slug by checking Supabase. Appends -2, -3… on collision.
export async function generateUniqueSlug(name) {
  const base = baseSlug(name)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') throw error
    if (!data) return candidate
  }
  return `${base}-${Date.now()}`
}

// ─── Flyer upload ─────────────────────────────────────────────────────────────

export async function uploadFlyer(file, slug) {
  if (!file) return null
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
  const path = `${slug}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('flyers')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('flyers').getPublicUrl(path)
  return data?.publicUrl || null
}

// ─── Save event from GrailSetup data ──────────────────────────────────────────

export async function createEventFromSetup(setupData, promoterId) {
  if (!promoterId) throw new Error('Not signed in')

  const slug = await generateUniqueSlug(setupData.name)

  let flyerUrl = null
  if (setupData.flyer) {
    try {
      flyerUrl = await uploadFlyer(setupData.flyer, slug)
    } catch (err) {
      console.warn('Flyer upload failed, continuing without:', err.message)
    }
  }

  // Combine date + time → ISO timestamp (CDMX timezone is UTC-6)
  let showDateIso = null
  if (setupData.date) {
    const time = setupData.time || '21:00'
    showDateIso = new Date(`${setupData.date}T${time}:00-06:00`).toISOString()
  }

  // Insert event
  const { data: event, error: evErr } = await supabase
    .from('events')
    .insert({
      promoter_id:     promoterId,
      name:            setupData.name,
      slug,
      artist_name:     setupData.name,           // legacy field, mirror name
      show_date:       showDateIso,
      doors_time:      setupData.time || null,
      venue_hint:      setupData.venue || null,
      venue_address:   setupData.address || null,
      capacity:        Number(setupData.capacity) || 0,
      age_restriction: setupData.age || null,
      description:     setupData.description || null,
      flyer_url:       flyerUrl,
      currency:        (setupData.currency || 'mxn').toLowerCase(),
      bar_enabled:     setupData.barEnabled !== false,
      active:          true,
      status:          'live',
    })
    .select('id, slug')
    .single()

  if (evErr) throw evErr

  // Ticket tiers
  if (setupData.tiers?.length) {
    const tierRows = setupData.tiers.map((t, i) => ({
      event_id:    event.id,
      name:        t.name,
      price_cents: Math.round(Number(t.price) * 100),
      qty:         Number(t.qty) || 0,
      description: t.desc || null,
      sort_order:  i,
    }))
    const { error: tierErr } = await supabase.from('ticket_tiers').insert(tierRows)
    if (tierErr) throw tierErr
  }

  // Producers / contract
  if (setupData.producers?.length) {
    const prodRows = setupData.producers.map(p => ({
      event_id:  event.id,
      name:      p.name,
      role:      p.role,
      split_pct: Number(p.split),
      signed:    !!p.signed,
      signed_at: p.signed ? new Date().toISOString() : null,
    }))
    const { error: prodErr } = await supabase.from('event_producers').insert(prodRows)
    if (prodErr) throw prodErr
  }

  // Bar menu
  if (setupData.barEnabled !== false && setupData.barItems?.length) {
    const barRows = setupData.barItems.map((b, i) => ({
      event_id:    event.id,
      name:        b.name,
      price_cents: Math.round(Number(b.price) * 100),
      category:    b.category || 'Drinks',
      description: b.desc || null,
      sort_order:  i,
      active:      true,
    }))
    const { error: barErr } = await supabase.from('bar_menu_items').insert(barRows)
    if (barErr) throw barErr
  }

  return event
}

// ─── Load an event into GrailSetup data shape (for edit mode) ───────────────
//
// Returns { eventId, slug, data } where `data` is shaped exactly like the
// state GrailSetup uses on a fresh create. The two flows can then share
// the same step UI.
export async function loadEventForEdit(slug) {
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (evErr || !event) throw new Error('Event not found')

  const [{ data: tiers }, { data: producers }, { data: barItems }] = await Promise.all([
    supabase.from('ticket_tiers').select('*').eq('event_id', event.id).order('sort_order', { ascending: true }),
    supabase.from('event_producers').select('*').eq('event_id', event.id).order('created_at', { ascending: true }),
    supabase.from('bar_menu_items').select('*').eq('event_id', event.id).eq('active', true).order('sort_order', { ascending: true }),
  ])

  // Format show_date back into yyyy-mm-dd in CDMX local for <input type="date">.
  let dateStr = ''
  if (event.show_date) {
    const cdmx = new Date(new Date(event.show_date).getTime() - 6 * 60 * 60 * 1000)
    dateStr = cdmx.toISOString().slice(0, 10)
  }

  const data = {
    name:         event.name || '',
    date:         dateStr,
    time:         event.doors_time || '',
    venue:        event.venue_hint || '',
    address:      event.venue_address || '',
    capacity:     String(event.capacity || ''),
    age:          event.age_restriction || '21+',
    description:  event.description || '',
    flyer:        null,
    flyerPreview: event.flyer_url || null,
    currency:     (event.currency || 'mxn').toLowerCase(),

    producers: (producers || []).map(p => ({
      id:     p.id,
      name:   p.name,
      role:   p.role,
      split:  Number(p.split_pct),
      signed: !!p.signed,
    })),

    tiers: (tiers || []).map(t => ({
      id:    t.id,
      name:  t.name || '',
      price: String((t.price_cents || 0) / 100),
      qty:   String(t.qty || ''),
      desc:  t.description || '',
    })),

    barEnabled: event.bar_enabled !== false,
    barItems: (barItems || []).map(b => ({
      id:       b.id,
      name:     b.name,
      price:    String((b.price_cents || 0) / 100),
      category: b.category || 'Drinks',
      desc:     b.description || '',
      featured: FEATURED_NAMES.includes((b.name || '').toLowerCase()),
    })),

    stripeConnected: true,  // edit means create already happened — Stripe must've been connected
  }

  return { eventId: event.id, slug: event.slug, data }
}

// ─── Save edits back to all four tables ────────────────────────────────────
//
// Diff strategy:
//   - events: UPDATE the single row.
//   - ticket_tiers: UPSERT existing UUIDs, INSERT new (Date.now() ids).
//     No DELETE — tickets.tier_id is an FK and we don't want orphaned sales.
//   - event_producers: DELETE all + INSERT all. No FK refs in to producers,
//     so this is safe and simpler than diffing.
//   - bar_menu_items: UPSERT existing, INSERT new, soft-DELETE removed
//     by setting active=false (existing orders reference items by name).
export async function updateEventFromSetup(setupData, eventId) {
  if (!eventId) throw new Error('eventId required')

  let showDateIso = null
  if (setupData.date) {
    const time = setupData.time || '21:00'
    showDateIso = new Date(`${setupData.date}T${time}:00-06:00`).toISOString()
  }

  // Flyer: only re-upload if a new file was selected. Otherwise keep the
  // existing flyer_url (which is what flyerPreview holds in edit mode).
  let flyerUrl = setupData.flyerPreview || null
  if (setupData.flyer) {
    try {
      const url = await uploadFlyer(setupData.flyer, setupData.slug || `event-${eventId}`)
      if (url) flyerUrl = url
    } catch (err) {
      console.warn('Flyer upload failed, keeping existing:', err.message)
    }
  }

  const { error: evErr } = await supabase
    .from('events')
    .update({
      name:            setupData.name,
      artist_name:     setupData.name,
      show_date:       showDateIso,
      doors_time:      setupData.time || null,
      venue_hint:      setupData.venue || null,
      venue_address:   setupData.address || null,
      capacity:        Number(setupData.capacity) || 0,
      age_restriction: setupData.age || null,
      description:     setupData.description || null,
      flyer_url:       flyerUrl,
      currency:        (setupData.currency || 'mxn').toLowerCase(),
      bar_enabled:     setupData.barEnabled !== false,
    })
    .eq('id', eventId)
  if (evErr) throw evErr

  // Ticket tiers: upsert existing, insert new
  const tiers = setupData.tiers || []
  const tierUpserts = tiers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => isUuid(t.id))
    .map(({ t, i }) => ({
      id:          t.id,
      event_id:    eventId,
      name:        t.name,
      price_cents: Math.round(Number(t.price) * 100),
      qty:         Number(t.qty) || 0,
      description: t.desc || null,
      sort_order:  i,
    }))
  const tierInserts = tiers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !isUuid(t.id))
    .map(({ t, i }) => ({
      event_id:    eventId,
      name:        t.name,
      price_cents: Math.round(Number(t.price) * 100),
      qty:         Number(t.qty) || 0,
      description: t.desc || null,
      sort_order:  i,
    }))
  if (tierUpserts.length) {
    const { error } = await supabase.from('ticket_tiers').upsert(tierUpserts)
    if (error) throw error
  }
  if (tierInserts.length) {
    const { error } = await supabase.from('ticket_tiers').insert(tierInserts)
    if (error) throw error
  }

  // Producers: delete-and-replace
  await supabase.from('event_producers').delete().eq('event_id', eventId)
  const producers = setupData.producers || []
  if (producers.length) {
    const prodRows = producers.map(p => ({
      event_id:  eventId,
      name:      p.name,
      role:      p.role,
      split_pct: Number(p.split),
      signed:    !!p.signed,
      signed_at: p.signed ? new Date().toISOString() : null,
    }))
    const { error } = await supabase.from('event_producers').insert(prodRows)
    if (error) throw error
  }

  // Bar menu: soft-DELETE rows the user removed, UPSERT existing, INSERT new
  const barItems = setupData.barItems || []
  const dataBarIds = new Set(barItems.filter(b => isUuid(b.id)).map(b => b.id))
  const { data: dbBarItems } = await supabase
    .from('bar_menu_items')
    .select('id')
    .eq('event_id', eventId)
    .eq('active', true)
  const removedIds = (dbBarItems || []).map(r => r.id).filter(id => !dataBarIds.has(id))
  if (removedIds.length) {
    await supabase.from('bar_menu_items').update({ active: false }).in('id', removedIds)
  }
  const barUpserts = barItems
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => isUuid(b.id))
    .map(({ b, i }) => ({
      id:          b.id,
      event_id:    eventId,
      name:        b.name,
      price_cents: Math.round(Number(b.price) * 100),
      category:    b.category || 'Drinks',
      description: b.desc || null,
      sort_order:  i,
      active:      true,
    }))
  const barInserts = barItems
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !isUuid(b.id))
    .map(({ b, i }) => ({
      event_id:    eventId,
      name:        b.name,
      price_cents: Math.round(Number(b.price) * 100),
      category:    b.category || 'Drinks',
      description: b.desc || null,
      sort_order:  i,
      active:      true,
    }))
  if (barUpserts.length) {
    const { error } = await supabase.from('bar_menu_items').upsert(barUpserts)
    if (error) throw error
  }
  if (barInserts.length) {
    const { error } = await supabase.from('bar_menu_items').insert(barInserts)
    if (error) throw error
  }

  return { id: eventId }
}
