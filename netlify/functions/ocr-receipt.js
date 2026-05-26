// Photo-receipt OCR — promoter snaps a picture of a receipt (bar restock,
// gear rental, transport, etc.); we extract the total + a short description
// via Claude Vision and return them for the client to add as a fixed_costs
// line on the event.
//
// POST body:    { event_id, image_base64, mime_type }
// Auth header:  Authorization: Bearer <supabase access token>
// Response:     { amount_cents, currency, description }
//   or:         { error: '...' }
//
// We don't store the receipt image — the OCR runs on the upload in-flight
// and the result becomes the line item. The image is only ever in memory.
//
// Required env: ANTHROPIC_API_KEY (Netlify dashboard)

const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')

const SYSTEM = `You extract expense information from a single receipt image.

Return ONLY a JSON object with exactly these fields (no prose, no markdown fences):
- amount_cents: integer, the receipt's TOTAL in minor units (multiply major × 100)
- currency: "MXN" or "USD" (default "MXN" if unclear)
- description: short 1-5 word English label suitable for a budget line (e.g. "Bar restock", "Sound rental", "Ice + cups", "Door cash drawer")

If the image is unreadable, blurry, not a receipt, or has no clear total, return:
{"error": "Cannot read receipt"}

JSON only. No explanation.`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('OCR is not configured on this deploy (missing ANTHROPIC_API_KEY).')
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const body = JSON.parse(event.body || '{}')
    const { event_id, image_base64, mime_type } = body
    if (!event_id)     throw new Error('event_id required')
    if (!image_base64) throw new Error('image_base64 required')
    const mt = (mime_type || 'image/jpeg').toLowerCase()
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mt)) {
      throw new Error('mime_type must be jpeg / png / webp / gif')
    }

    // Authz — only the event's promoter can OCR receipts onto it.
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')
    const { data: ev } = await supabase
      .from('events')
      .select('id, promoter_id, greenlit_at')
      .eq('id', event_id)
      .maybeSingle()
    if (!ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized for this event')
    if (ev.greenlit_at) throw new Error('Contract is greenlit — costs are locked')

    // Vision call. Haiku is fine here — receipts are simple and fast wins.
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: image_base64 } },
          { type: 'text',  text: 'Extract the total and a short description for this receipt.' },
        ],
      }],
    })

    const text = (resp.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
    if (!text) throw new Error('Empty response from OCR')

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      // Sometimes models wrap JSON in ```json — tolerate that.
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('OCR returned non-JSON: ' + text.slice(0, 80))
      parsed = JSON.parse(m[0])
    }

    if (parsed.error) {
      return { statusCode: 200, body: JSON.stringify({ error: parsed.error }) }
    }

    const amount_cents = Math.max(0, Math.round(Number(parsed.amount_cents) || 0))
    const currency    = (parsed.currency || 'MXN').toUpperCase()
    const description = String(parsed.description || '').trim().slice(0, 60) || 'Receipt'

    if (amount_cents === 0) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Could not detect a total amount on this receipt.' }) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ amount_cents, currency, description }),
    }
  } catch (err) {
    console.error('ocr-receipt error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
