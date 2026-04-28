// Featured drinks template — auto-prefilled when a promoter sets up a new bar.
//
// Picked for hydration-forward dancefloor energy (vs. "get shitfaced" shots),
// so people stay out longer and dance more.
//
// Promoters can:
//   - Edit the price on any featured drink
//   - Remove a featured drink they don't want to serve
//   - Add custom items on top (no emoji, fully promoter-named/priced)
//
// The consumer dove menu (GrailDoves.jsx) matches bar_menu_items.name against
// FEATURED_DRINKS to render the emoji card; unmatched items render as text-only.

export const FEATURED_DRINKS = [
  { slug: 'suero',         name: 'Suero',            emoji: '🥤', defaultPrice: 50, category: 'Non-Alcoholic' },
  { slug: 'suero-mezcal',  name: 'Suero con Mezcal', emoji: '🍹', defaultPrice: 100, category: 'Drinks' },
  { slug: 'cerveza',       name: 'Cerveza',          emoji: '🍺', defaultPrice: 50, category: 'Beer' },
  { slug: 'michelada',     name: 'Michelada',        emoji: '🍻', defaultPrice: 80, category: 'Drinks' },
]

export function isFeaturedName(name) {
  const n = (name || '').trim().toLowerCase()
  return FEATURED_DRINKS.some(d => d.name.toLowerCase() === n)
}

export function emojiFor(name) {
  const n = (name || '').trim().toLowerCase()
  return FEATURED_DRINKS.find(d => d.name.toLowerCase() === n)?.emoji || null
}
