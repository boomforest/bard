import { supabase } from './supabase'

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
