// Featured drinks template — auto-prefilled when a promoter sets up a new bar.
//
// Picked for hydration-forward dancefloor energy (vs. "get shitfaced" shots),
// so people stay out longer and dance more.
//
// Promoters can:
//   - Edit the price on any featured drink
//   - Remove a featured drink they don't want to serve
//   - Add custom items on top (no image, no emoji, fully promoter-named/priced)
//
// The consumer dove menu (GrailDoves.jsx) and bar (EventBar.jsx) match
// bar_menu_items.name against FEATURED_DRINKS to render the photo card;
// unmatched items render as plain text.
//
// Image files live in /public/drinks/ and are served at /drinks/{file}.
// Match the demo (GrailDemo.jsx, AlleycatDemo.jsx) so the live experience
// finally looks as polished as the pitch.

export const FEATURED_DRINKS = [
  {
    slug: 'suero',
    name: 'Suero',
    emoji: '🥤',
    img:  '/drinks/suero.jpg',
    desc: 'The morning after, before it starts',
    defaultPrice: 50,
    category: 'Non-Alcoholic',
  },
  {
    slug: 'suero-mezcal',
    name: 'Suero con Mezcal',
    emoji: '🍹',
    img:  '/drinks/sueroconmezcal.jpg',
    desc: 'Smoke in the remedy',
    defaultPrice: 100,
    category: 'Drinks',
  },
  {
    slug: 'cerveza',
    name: 'Cerveza',
    emoji: '🍺',
    img:  '/drinks/cerveza.jpg',
    desc: 'Fría. Siempre fría.',
    defaultPrice: 50,
    category: 'Beer',
  },
  {
    slug: 'michelada',
    name: 'Michelada',
    emoji: '🍻',
    img:  '/drinks/michelada.jpg',
    desc: 'Limón, sal, chamoy, fuego',
    defaultPrice: 80,
    category: 'Drinks',
  },
]

const byNameLower = (name) => {
  const n = (name || '').trim().toLowerCase()
  return FEATURED_DRINKS.find(d => d.name.toLowerCase() === n) || null
}

export function isFeaturedName(name) {
  return !!byNameLower(name)
}

export function emojiFor(name) {
  return byNameLower(name)?.emoji || null
}

export function imageFor(name) {
  return byNameLower(name)?.img || null
}

export function descFor(name) {
  return byNameLower(name)?.desc || null
}
