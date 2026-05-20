// Email-template translations for customer-facing Resend HTML.
//
// CDMX-first: any caller that doesn't pass `lang` falls back to 'es'.
// Cron jobs (auto-close-bar) can't know the buyer's preference, so they
// hit the default. Client-driven flows pass the buyer's locale through.
//
// Subjects use {var} placeholders that t() interpolates.

const DICTS = {
  en: {
    // ─── Event ticket confirmation (send-event-confirmation) ─────────────
    'confirm.subject':         'Your tickets — {event}',
    'confirm.eyebrow':         'Confirmed',
    'confirm.greeting':        'Hi {name},',
    'confirm.body.one':        "Your ticket is secured. Open the link below on your phone at the door — staff scans the QR for entry.",
    'confirm.body.many':       "Your {count} tickets are secured. Open each link on your phone at the door — staff scans the QR for entry.",
    'confirm.linkOne':         '🎟  View & Present at the Door',
    'confirm.linkOf':          '🎟  Ticket {n} of {total}',
    'confirm.uniqueWarning':   "Each link is a unique ticket. Don't share publicly.",
    'confirm.poweredBy':       'Powered by GRAIL · grail.mx',

    // ─── Refund confirmation (send-refund-confirmation) ──────────────────
    'refund.subject':          'Your refund — {event}',
    'refund.eyebrow':          'Refunded',
    'refund.headline':         'Your unspent doves are back on your card.',
    'refund.fromLabel':        'From',
    'refund.amountLabel':      'Amount',
    'refund.thanks':           'Thanks for coming.',
    'refund.questions.prefix': 'Questions? Reply to this email or write ',
    'refund.eventFallback':    'the show',

    // ─── Waitlist blast (send-waitlist-email) ────────────────────────────
    'waitlist.subject':        'Tickets opened up — {event}',
    'waitlist.eyebrow':        'Tickets opened up',
    'waitlist.greeting':       'Hi {name},',
    'waitlist.cta':            'Grab a ticket →',
    'waitlist.footer':         "You're getting this because you joined the waitlist for this event.",

    // ─── New event from followed promoter (send-new-event-notification) ──
    'newEvent.subject':        '{promoter} just announced a new show',
    'newEvent.eyebrow':        'New Show',
    'newEvent.greeting':       'Hi {name},',
    'newEvent.body':           '{promoter} just announced a new event. Here are the details:',
    'newEvent.cta':            'See event & buy tickets →',
    'newEvent.footer':         "You're getting this because you subscribed to {promoter}'s announcements.",

    // ─── Promoter → attendee blast (send-attendee-message) ──────────────
    'attendeeMsg.subject':     '{event} — message from {promoter}',
    'attendeeMsg.eyebrow':     'Update from the promoter',
    'attendeeMsg.greeting':    'Hi {name},',
    'attendeeMsg.viewTicket':  'View your ticket →',
    'attendeeMsg.footer':      "You're getting this because you bought a ticket to {event}.",

    // ─── Artist greenlight broadcast (send-artist-greenlight-notification) ──
    'artistGreenlight.subject':  '{artist} just confirmed a show',
    'artistGreenlight.eyebrow':  'Just confirmed',
    'artistGreenlight.greeting': 'Hi {name},',
    'artistGreenlight.body':     '{artist} is playing {event}. Here are the details:',
    'artistGreenlight.cta':      'Get tickets →',
    'artistGreenlight.footer':   "You're getting this because you follow {artist} on GRAIL.",
  },
  es: {
    // ─── Event ticket confirmation ───────────────────────────────────────
    'confirm.subject':         'Tus boletos — {event}',
    'confirm.eyebrow':         'Confirmado',
    'confirm.greeting':        'Hola {name},',
    'confirm.body.one':        'Tu boleto está asegurado. Abre el enlace de abajo en tu celular en la entrada — el staff escanea el QR para dejarte pasar.',
    'confirm.body.many':       'Tus {count} boletos están asegurados. Abre cada enlace en tu celular en la entrada — el staff escanea el QR para dejarte pasar.',
    'confirm.linkOne':         '🎟  Ver y presentar en la entrada',
    'confirm.linkOf':          '🎟  Boleto {n} de {total}',
    'confirm.uniqueWarning':   'Cada enlace es un boleto único. No los compartas en público.',
    'confirm.poweredBy':       'Hecho con GRAIL · grail.mx',

    // ─── Refund confirmation ─────────────────────────────────────────────
    'refund.subject':          'Tu reembolso — {event}',
    'refund.eyebrow':          'Reembolsado',
    'refund.headline':         'Tus doves no gastados regresaron a tu tarjeta.',
    'refund.fromLabel':        'De',
    'refund.amountLabel':      'Monto',
    'refund.thanks':           'Gracias por venir.',
    'refund.questions.prefix': '¿Dudas? Responde este correo o escribe a ',
    'refund.eventFallback':    'el show',

    // ─── Waitlist blast ──────────────────────────────────────────────────
    'waitlist.subject':        'Se abrieron boletos — {event}',
    'waitlist.eyebrow':        'Se abrieron boletos',
    'waitlist.greeting':       'Hola {name},',
    'waitlist.cta':             'Conseguir boleto →',
    'waitlist.footer':         'Recibes esto porque te uniste a la lista de espera de este evento.',

    // ─── New event from followed promoter ────────────────────────────────
    'newEvent.subject':        '{promoter} anunció un nuevo show',
    'newEvent.eyebrow':        'Nuevo show',
    'newEvent.greeting':       'Hola {name},',
    'newEvent.body':           '{promoter} acaba de anunciar un nuevo evento. Aquí están los detalles:',
    'newEvent.cta':            'Ver evento y comprar boletos →',
    'newEvent.footer':         'Recibes esto porque te suscribiste a los avisos de {promoter}.',

    // ─── Promoter → attendee blast ───────────────────────────────────────
    'attendeeMsg.subject':     '{event} — mensaje de {promoter}',
    'attendeeMsg.eyebrow':     'Mensaje del promotor',
    'attendeeMsg.greeting':    'Hola {name},',
    'attendeeMsg.viewTicket':  'Ver tu boleto →',
    'attendeeMsg.footer':      'Recibes esto porque compraste un boleto para {event}.',

    // ─── Artist greenlight broadcast ─────────────────────────────────────
    'artistGreenlight.subject':  '{artist} acaba de confirmar un show',
    'artistGreenlight.eyebrow':  'Acaba de confirmar',
    'artistGreenlight.greeting': 'Hola {name},',
    'artistGreenlight.body':     '{artist} se presenta en {event}. Aquí están los detalles:',
    'artistGreenlight.cta':      'Conseguir boletos →',
    'artistGreenlight.footer':   'Recibes esto porque sigues a {artist} en GRAIL.',
  },
}

const pickLang = (lang) => (lang === 'en' ? 'en' : 'es')

const t = (lang, key, vars) => {
  const primary = DICTS[pickLang(lang)]
  let s = primary[key]
  if (s == null) s = DICTS.en[key]
  if (s == null) s = key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return s
}

const fmtDate = (iso, lang) => {
  if (!iso) return ''
  const tag = pickLang(lang) === 'es' ? 'es-MX' : 'en-US'
  return new Date(iso).toLocaleDateString(tag, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

module.exports = { t, pickLang, fmtDate }
