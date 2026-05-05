const { createClient } = require('@supabase/supabase-js')

// Daily nudge to producers who haven't Greenlit yet on contracts whose
// show is approaching. Throttled to one email per producer every 48h.
//
// Cadence (per netlify.toml):  0 15 * * *   (3pm UTC)
//
// Eligibility per producer:
//   - parent event greenlit_at IS NULL  (contract not yet locked)
//   - parent event show_date BETWEEN now() AND now() + 7 days
//   - producer signed = false
//   - producer user_id IS NOT NULL  (account exists; co-producers who
//     haven't redeemed their invite yet are a different problem — the
//     invite email is the nudge for them)
//   - producer last_reminded_at IS NULL OR last_reminded_at < now() - 48h
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

exports.handler = async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  try {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Pull unsigned producers + their event metadata in one query.
    const { data: rows, error } = await supabase
      .from('event_producers')
      .select(`
        id, name, role, split_pct, signed, user_id, last_reminded_at,
        events!inner(id, slug, name, show_date, greenlit_at)
      `)
      .eq('signed', false)
      .not('user_id', 'is', null)
      .is('events.greenlit_at', null)
      .gte('events.show_date', now)
      .lte('events.show_date', inSevenDays)
    if (error) throw error

    const eligible = (rows || []).filter(r => !r.last_reminded_at || r.last_reminded_at < cutoff48h)

    // Resolve emails via the users table.
    const userIds = [...new Set(eligible.map(r => r.user_id))]
    let emailByUser = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds)
      emailByUser = Object.fromEntries((users || []).map(u => [u.id, u.email]))
    }

    const sent    = []
    const skipped = []

    for (const r of eligible) {
      const email = emailByUser[r.user_id]
      if (!email) { skipped.push({ producer_id: r.id, reason: 'no email on profile' }); continue }
      try {
        await sendReminder({ to: email, producer: r, event: r.events })
        await supabase
          .from('event_producers')
          .update({ last_reminded_at: new Date().toISOString() })
          .eq('id', r.id)
        sent.push({ producer_id: r.id, name: r.name, email })
      } catch (err) {
        console.error(`reminder failed for ${r.name}:`, err.message)
        skipped.push({ producer_id: r.id, reason: err.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, scanned: (rows || []).length, eligible: eligible.length, sent, skipped }),
    }
  } catch (err) {
    console.error('remind-pending-greenlight error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

async function sendReminder({ to, producer, event }) {
  const showDate = event.show_date
    ? new Date(event.show_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : 'soon'
  const url = `https://grail.mx/promoter/event/${event.slug}`
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
      <div style="font-size: 11px; color: #f07020; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">GRAIL · Greenlight needed</div>
      <h2 style="margin: 0 0 14px 0; font-size: 1.4rem; letter-spacing: -0.02em;">Hey ${escapeHtml(producer.name)},</h2>
      <p style="margin: 0 0 14px 0; line-height: 1.55;">The contract for <strong>${escapeHtml(event.name || 'your show')}</strong> on ${showDate} is still waiting on your Greenlight.</p>
      <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px; padding: 14px 16px; margin: 16px 0;">
        <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Your share</div>
        <div style="color: #aaff00; font-weight: 800; font-size: 1.25rem;">${escapeHtml(String(producer.split_pct ?? 0))}% — ${escapeHtml(producer.role || 'Producer')}</div>
      </div>
      <p style="margin: 0 0 16px 0; line-height: 1.55;">Once everyone signs, the splits and costs lock and tickets can flow without anyone arguing over the math after the show.</p>
      <p style="margin: 20px 0;">
        <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #aaff00, #6abf4b); color: #000; padding: 12px 24px; border-radius: 10px; font-weight: 800; text-decoration: none;">Review &amp; Greenlight →</a>
      </p>
      <p style="margin: 0; color: #8a8098; font-size: 12px;">If something needs to change before you sign, message the lead promoter directly — splits and costs unlock instantly when anyone un-signs.</p>
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
      subject: `Reminder: Greenlight ${event.name || 'your show'} contract`,
      html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
}
