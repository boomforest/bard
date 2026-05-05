const { createClient } = require('@supabase/supabase-js')

// Resolve a postal code OR free-text address to {lat, lng} via Nominatim
// (OpenStreetMap). Postal codes get cached in zip_locations forever
// (zips don't move); free-text addresses are not cached (per-event,
// not reusable).
//
// POST body: one of
//   { zip, country? }     -> uses Nominatim postalcode lookup, caches
//   { address, country? } -> uses Nominatim free-text search, no cache
// country defaults to 'mx'.
//
// Response: { lat, lng, cached } or { lat: null, lng: null } on miss.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Nominatim usage policy: 1 req/sec, set User-Agent. We're well under
// that for our scale; keep an eye on it if usage scales up.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const country = String(body.country || 'mx').trim().toLowerCase().slice(0, 2)

    if (body.zip && String(body.zip).trim()) {
      return await lookupZip(String(body.zip).trim(), country)
    }
    if (body.address && String(body.address).trim()) {
      return await lookupAddress(String(body.address).trim(), country)
    }
    throw new Error('Provide either zip or address')
  } catch (err) {
    console.error('geocode-zip error:', err)
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }
}

async function lookupZip(zip, country) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // Cache hit?
  const { data: cached } = await supabase
    .from('zip_locations')
    .select('lat, lng')
    .eq('zip', zip)
    .eq('country', country)
    .maybeSingle()
  if (cached?.lat != null && cached?.lng != null) {
    return ok({ zip, country, lat: cached.lat, lng: cached.lng, cached: true })
  }

  // Miss → Nominatim
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('postalcode', zip)
  url.searchParams.set('country',    country.toUpperCase())
  url.searchParams.set('format',     'json')
  url.searchParams.set('limit',      '1')

  const res = await fetch(url, { headers: { 'User-Agent': 'GRAIL-geocoder (jp@casadecopas.com)' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const arr = await res.json()
  const hit = Array.isArray(arr) && arr[0]

  if (!hit?.lat || !hit?.lon) {
    // Cache the miss so we don't re-query the same zip each time.
    await supabase.from('zip_locations').upsert({ zip, country, lat: null, lng: null })
    return ok({ zip, country, lat: null, lng: null, cached: false })
  }

  const lat = parseFloat(hit.lat)
  const lng = parseFloat(hit.lon)
  await supabase.from('zip_locations').upsert({ zip, country, lat, lng })
  return ok({ zip, country, lat, lng, cached: false })
}

async function lookupAddress(address, country) {
  // Free-text search — not cached. Each event has a unique venue
  // string, so caching would just bloat the table.
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q',          address)
  url.searchParams.set('countrycodes', country.toLowerCase())
  url.searchParams.set('format',     'json')
  url.searchParams.set('limit',      '1')

  const res = await fetch(url, { headers: { 'User-Agent': 'GRAIL-geocoder (jp@casadecopas.com)' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const arr = await res.json()
  const hit = Array.isArray(arr) && arr[0]
  if (!hit?.lat || !hit?.lon) {
    return ok({ address, country, lat: null, lng: null, cached: false })
  }
  return ok({
    address, country,
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    cached: false,
  })
}

function ok(body) {
  return { statusCode: 200, body: JSON.stringify(body) }
}
