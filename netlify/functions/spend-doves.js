const { createClient } = require('@supabase/supabase-js')

// Atomically debit a bar tab and create a paid bar order.
//
// POST body: { token, items: [{ menu_item_id, qty }], customer_name, order_id }
// Response:  { order, balance: { spent_cents, loaded_cents } }
//
// Server re-prices items from bar_menu_items so a buyer can't claim
// they ordered a $1 drink when it costs $10. If the new total would
// exceed the balance, the spend is rejected.
//
// SHOW/BAR ECONOMY — DO NOT WRITE to profiles.dov_balance from here.
// That column is the Casa de Copas Palomas wallet, a separate ledger.

function genOrderId() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return letters[Math.floor(Math.random() * letters.length)] + Math.floor(Math.random() * 9 + 1) +
         letters[Math.floor(Math.random() * letters.length)]
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { token, items, customer_name, order_id } = JSON.parse(event.body || '{}')
    if (!token) throw new Error('token required')
    if (!Array.isArray(items) || items.length === 0) throw new Error('items[] required')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: balance, error: bErr } = await supabase
      .from('bar_tabs')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (bErr || !balance) throw new Error('Balance not found')
    if (balance.status !== 'active') throw new Error(`Balance is ${balance.status}`)

    // Re-price from menu
    const itemIds = items.map(i => i.menu_item_id)
    const { data: menuRows, error: menuErr } = await supabase
      .from('bar_menu_items')
      .select('id, name, price_cents, emoji, active')
      .in('id', itemIds)
      .eq('event_id', balance.event_id)
    if (menuErr) throw menuErr

    let totalCents = 0
    const lineItems = []
    for (const item of items) {
      const menu = menuRows.find(m => m.id === item.menu_item_id)
      if (!menu) throw new Error(`Unknown menu item: ${item.menu_item_id}`)
      if (!menu.active) throw new Error(`${menu.name} is not available`)
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0))
      totalCents += menu.price_cents * qty
      lineItems.push({ id: menu.id, name: menu.name, emoji: menu.emoji, price: menu.price_cents / 100, qty })
    }
    if (totalCents <= 0) throw new Error('Cart total is zero')

    const remaining = balance.loaded_cents - balance.spent_cents
    if (totalCents > remaining) {
      throw new Error(`Not enough Doves. Need $${(totalCents / 100).toFixed(2)}, have $${(remaining / 100).toFixed(2)}.`)
    }

    // Optimistic concurrency: only update if spent_cents hasn't moved
    const { data: bumped, error: upErr } = await supabase
      .from('bar_tabs')
      .update({
        spent_cents: balance.spent_cents + totalCents,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', balance.id)
      .eq('spent_cents', balance.spent_cents)
      .select('*')
      .maybeSingle()
    if (upErr) throw upErr
    if (!bumped) throw new Error('Balance changed mid-flight, please retry')

    // Insert the bar order
    const id = order_id || genOrderId()
    const { data: order, error: oErr } = await supabase
      .from('bar_orders')
      .insert({
        id,
        event_id:        balance.event_id,
        customer_name:   customer_name || balance.customer_name || 'Guest',
        items:           lineItems,
        total:           totalCents / 100,
        subtotal_cents:  totalCents,
        status:          'pending',
        dove_balance_id: balance.id,
        paid_at:         new Date().toISOString(),
      })
      .select('*')
      .single()
    if (oErr) {
      // Roll back the spend if the order insert failed
      await supabase.from('bar_tabs').update({ spent_cents: balance.spent_cents }).eq('id', balance.id)
      throw oErr
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        order,
        balance: { ...bumped },
      }),
    }
  } catch (err) {
    console.error('spend-doves error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
