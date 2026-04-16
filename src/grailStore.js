// ─── GRAIL SHARED STORE ────────────────────────────────────────────────────────
// Module-level store so GrailDoves and GrailAdmin can share live data
// without prop-drilling across separate route trees.
//
// In production: replace with Supabase realtime subscriptions on
//   grail_dove_transactions  (dove spend → bar revenue)
//   grail_bar_orders         (staff POS orders)
//
// Both tables write here; GrailAdmin settlement reads here.

const listeners = new Set()

function emit(event, payload) {
  window.dispatchEvent(new CustomEvent(`grail:${event}`, { detail: payload }))
}

export const grailStore = {
  // ── Dove transactions ──────────────────────────────────────────────────────
  doveTransactions: [],   // [{ id, userId, userName, item, mxn, doves, timestamp, eventId }]

  addDoveTransaction(tx) {
    grailStore.doveTransactions.push(tx)
    emit('dove-transaction', tx)
  },

  getDoveRevenue() {
    return grailStore.doveTransactions.reduce((s, t) => s + t.mxn, 0)
  },

  // ── Admitted count (door) ─────────────────────────────────────────────────
  admittedCount: 0,

  setAdmittedCount(n) {
    grailStore.admittedCount = n
    emit('admitted-update', { count: n })
  },

  // ── Subscribe to any grail event ──────────────────────────────────────────
  on(event, handler) {
    const wrapped = (e) => handler(e.detail)
    window.addEventListener(`grail:${event}`, wrapped)
    return () => window.removeEventListener(`grail:${event}`, wrapped)
  },
}
