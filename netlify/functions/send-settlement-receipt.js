const { createClient } = require('@supabase/supabase-js')

// Sends settlement receipts after run-settlement or auto-settle moves
// money. One email per non-lead co-producer ("you just got paid $X for
// event Y"), plus a summary email to the lead promoter.
//
// POST body: {
//   event_id,
//   transfers: [{ producer_id, name, amount_cents, transfer_id }],
//   skipped:   [{ name, reason }],     // optional, included in lead summary
//   currency:  'mxn' | 'usd',
//   complete:  boolean,                // settlement_complete vs partial
// }
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, transfers = [], skipped = [], currency = 'mxn', complete = false } =
      JSON.parse(event.body || '{}')
    if (!event_id) throw new Error('event_id required')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: ev } = await supabase
      .from('events')
      .select('id, slug, name, show_date, promoter_id')
      .eq('id', event_id)
      .maybeSingle()
    if (!ev) throw new Error('event not found')

    // Pull the lead's email + the producer rows for transfer recipients.
    const producerIds = transfers.map(t => t.producer_id).filter(Boolean)
    const [{ data: leadProfile }, { data: producers }] = await Promise.all([
      supabase.from('users').select('email, username').eq('id', ev.promoter_id).maybeSingle(),
      producerIds.length > 0
        ? supabase.from('event_producers').select('id, user_id, name, role, split_pct').in('id', producerIds)
        : Promise.resolve({ data: [] }),
    ])
    const producerById = Object.fromEntries((producers || []).map(p => [p.id, p]))

    const userIds = (producers || []).map(p => p.user_id).filter(Boolean)
    let emailByUser = {}
    if (userIds.length > 0) {
      const { data: profileEmails } = await supabase
        .from('users').select('id, email').in('id', userIds)
      emailByUser = Object.fromEntries((profileEmails || []).map(p => [p.id, p.email]))
    }

    const sent    = []
    const errors  = []

    // Per-producer receipts
    let totalTransferred = 0
    for (const tr of transfers) {
      totalTransferred += Number(tr.amount_cents || 0)
      const p = producerById[tr.producer_id]
      const email = p?.user_id ? emailByUser[p.user_id] : null
      if (!email) {
        errors.push({ producer: tr.name, reason: 'no email on profile' })
        continue
      }
      try {
        await sendCoproducerReceipt({
          to:        email,
          name:      p.name,
          role:      p.role,
          split_pct: p.split_pct,
          amount_cents: tr.amount_cents,
          transfer_id:  tr.transfer_id,
          currency,
          event:    ev,
        })
        sent.push({ producer: tr.name, email })
      } catch (e) {
        errors.push({ producer: tr.name, reason: e.message })
      }
    }

    // Lead summary (only if there were transfers OR skipped — silent
    // settlements with nothing to say skip the email).
    if (leadProfile?.email && (transfers.length > 0 || skipped.length > 0)) {
      try {
        await sendLeadSummary({
          to: leadProfile.email,
          event: ev,
          transfers, skipped, currency, totalTransferred, complete,
        })
        sent.push({ producer: 'lead', email: leadProfile.email })
      } catch (e) {
        errors.push({ producer: 'lead', reason: e.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: sent.length, errors }),
    }
  } catch (err) {
    console.error('send-settlement-receipt error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ─── email senders ──────────────────────────────────────────────────────

async function sendCoproducerReceipt({ to, name, role, split_pct, amount_cents, transfer_id, currency, event }) {
  const eventName = event.name || event.slug || 'GRAIL event'
  const showDate  = event.show_date
    ? new Date(event.show_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const amount    = fmtMoney(amount_cents, currency)
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
      <div style="font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">GRAIL · You got paid</div>
      <h2 style="margin: 0 0 14px 0; font-size: 1.4rem; letter-spacing: -0.02em;">Hey ${escapeHtml(name)},</h2>
      <p style="margin: 0 0 14px 0; line-height: 1.55;">Settlement just ran for <strong>${escapeHtml(eventName)}</strong>${showDate ? ' (' + showDate + ')' : ''}.</p>
      <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px; padding: 18px 20px; margin: 18px 0;">
        <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Your share</div>
        <div style="color: #aaff00; font-weight: 800; font-size: 1.7rem; margin-bottom: 4px;">${amount}</div>
        <div style="color: #8a8098; font-size: 0.85rem;">${escapeHtml(role || 'Producer')} · ${escapeHtml(String(split_pct ?? 0))}% of net</div>
      </div>
      <p style="margin: 0 0 12px 0; line-height: 1.55;">The funds were transferred from the lead promoter's Stripe account to yours. Your Stripe payout schedule controls when they hit your bank.</p>
      <p style="margin: 0; color: #8a8098; font-size: 12px;">Stripe transfer ID: <code>${escapeHtml(transfer_id || '—')}</code></p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'GRAIL <hello@casadecopas.com>',
      to:      [to],
      subject: `Settlement: you got paid ${amount} for ${eventName}`,
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 120)}`)
}

async function sendLeadSummary({ to, event, transfers, skipped, currency, totalTransferred, complete }) {
  const eventName = event.name || event.slug || 'GRAIL event'
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
      <div style="font-size: 11px; color: ${complete ? '#aaff00' : '#f07020'}; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">GRAIL · Settlement ${complete ? 'complete' : 'partial'}</div>
      <h2 style="margin: 0 0 14px 0; font-size: 1.4rem; letter-spacing: -0.02em;">${escapeHtml(eventName)}</h2>
      <p style="margin: 0 0 14px 0; line-height: 1.55;">${transfers.length} transfer${transfers.length === 1 ? '' : 's'} totaling <strong>${fmtMoney(totalTransferred, currency)}</strong> went out from your Stripe balance to your co-producers.</p>
      ${transfers.length > 0 ? `
      <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px; padding: 14px 16px; margin: 16px 0;">
        ${transfers.map(t => `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e1e2a; font-size: 0.88rem;">
            <span style="color: #e8e0d0;">${escapeHtml(t.name)}</span>
            <span style="color: #aaff00; font-weight: 700;">${fmtMoney(t.amount_cents, currency)}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
      ${skipped.length > 0 ? `
      <div style="background: #1a0d00; border: 1px solid #4a2a0a; border-radius: 10px; padding: 14px 16px; margin: 16px 0;">
        <div style="font-size: 11px; color: #f07020; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; font-weight: 700;">Skipped</div>
        ${skipped.map(s => `
          <div style="font-size: 0.85rem; color: #c9c4d4; padding: 4px 0;">
            <strong>${escapeHtml(s.name)}</strong> — ${escapeHtml(s.reason)}
          </div>
        `).join('')}
        ${!complete ? `<p style="margin: 8px 0 0 0; font-size: 0.78rem; color: #8a8098; line-height: 1.5;">Open the event to fix the issue and re-run settlement; the transfers above won't happen again (idempotency keys).</p>` : ''}
      </div>
      ` : ''}
      <p style="margin: 0; color: #8a8098; font-size: 12px;">Your remainder stays in your Stripe balance — Stripe's own payout schedule moves it to your bank.</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'GRAIL <hello@casadecopas.com>',
      to:      [to],
      subject: `Settlement ${complete ? 'complete' : 'partial'}: ${eventName}`,
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 120)}`)
}

// ─── helpers ────────────────────────────────────────────────────────────

function fmtMoney(cents, currency) {
  const c = (currency || 'mxn').toUpperCase()
  const symbol = c === 'USD' ? '$' : c === 'MXN' ? '$' : ''
  const value = ((Number(cents) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${symbol}${value} ${c}`
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
}
