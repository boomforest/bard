// Hard-deletes a ticket row and decrements the event/tier counters so
// capacity isn't permanently consumed.
//
// Auth: Bearer <supabase access token>
// Body: { ticket_id }
//
// Permitted when:
//   - The signed-in user has users.is_admin = true, OR
//   - The ticket's email matches the signed-in user's email
//     (lets a buyer self-clean a stuck/duplicate ticket from their own
//     account without needing platform-admin help)
//
// Note: this is a HARD delete. If you ever need a soft-delete/audit
// trail, switch to a deleted_at column instead — for now JP just wants
// to clean test rows out of his profile.

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) throw new Error('Not signed in')

    const { ticket_id } = JSON.parse(event.body || '{}')
    if (!ticket_id) throw new Error('ticket_id required')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) throw new Error('Invalid session')
    const userId = userData.user.id
    const userEmail = (userData.user.email || '').toLowerCase()

    const { data: userRow } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle()
    const isAdmin = !!userRow?.is_admin

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, event_id, tier_id, email')
      .eq('id', ticket_id)
      .maybeSingle()
    if (tErr) throw tErr
    if (!ticket) throw new Error('Ticket not found')

    const ticketEmail = (ticket.email || '').toLowerCase()
    if (!isAdmin && ticketEmail !== userEmail) {
      throw new Error('Not authorized to delete this ticket')
    }

    // Delete first, then decrement — if delete fails we don't want to
    // bump capacity back up against a row that's still there.
    const { error: delErr } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticket_id)
    if (delErr) throw delErr

    // Decrement counters (best-effort; main op is the delete itself)
    if (ticket.event_id) {
      const { data: ev } = await supabase
        .from('events')
        .select('tickets_sold')
        .eq('id', ticket.event_id)
        .maybeSingle()
      const next = Math.max(0, (ev?.tickets_sold || 0) - 1)
      await supabase.from('events').update({ tickets_sold: next }).eq('id', ticket.event_id)
    }
    if (ticket.tier_id) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('sold')
        .eq('id', ticket.tier_id)
        .maybeSingle()
      const next = Math.max(0, (tier?.sold || 0) - 1)
      await supabase.from('ticket_tiers').update({ sold: next }).eq('id', ticket.tier_id)
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('delete-ticket error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
