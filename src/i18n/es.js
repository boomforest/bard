// Spanish copy. Mexico City register — clear, direct, friendly.
// Add new keys to BOTH en.js and es.js when introducing a string.

export default {
  // ─── Common ──────────────────────────────────────────────────────────────
  'common.back':             '← Atrás',
  'common.close':            'Cerrar',
  'common.loading':          'Cargando…',
  'common.save':             'Guardar',
  'common.cancel':           'Cancelar',
  'common.continue':         'Continuar',
  'common.email':            'Correo',
  'common.name':             'Nombre',
  'common.password':         'Contraseña',
  'common.optional':         '(opcional)',
  'common.poweredBy':        'Hecho con GRAIL',
  'common.copy':             'Copiar',
  'common.copied':           '✓ Copiado',
  'common.processing':       'Procesando…',

  // ─── EventPage ───────────────────────────────────────────────────────────
  'event.notFound.title':       'Evento no encontrado',
  'event.notFound.body':        'El enlace puede estar mal, o este evento aún no está activo.',
  'event.notFound.cta':         'Explorar GRAIL →',
  'event.eyebrow.live':         'En vivo',
  'event.eyebrow.past':         'Evento pasado',
  'event.ended.title':          'Este show ya terminó.',
  'event.ended.body':           'Gracias por ser parte.',
  'event.noTickets':            'Aún no hay boletos disponibles.',
  'event.tickets':              'Boletos',
  'event.add':                  'Agregar',
  'event.soldOut':              'Agotado',
  'event.fewLeft':              '· quedan {count}',
  'event.checkout':             'Pagar →',
  'event.ticketCount.one':      '{count} boleto',
  'event.ticketCount.many':     '{count} boletos',

  // Waitlist
  'waitlist.eyebrow':           'Agotado',
  'waitlist.title':             'Únete a la lista de espera',
  'waitlist.body':              'A veces se liberan boletos antes de la entrada. Déjanos tu correo y te enviamos un enlace si se abren lugares.',
  'waitlist.namePh':            'Nombre (opcional)',
  'waitlist.cta':               'Avísame si se abren boletos',
  'waitlist.adding':            'Agregando…',
  'waitlist.invalidEmail':      'Ingresa un correo válido.',
  'waitlist.done.title':        'Estás en la lista de espera.',
  'waitlist.done.body':         'Si se libera un boleto antes del show, te mandamos un enlace por correo.',

  // Checkout modal
  'checkout.title':             'Pagar',
  'checkout.total':             'Total',
  'checkout.namePh':            'Tu nombre',
  'checkout.emailRequired':     'Nombre y correo requeridos.',
  'checkout.emailInvalid':      'Ingresa un correo válido.',
  'checkout.preparing':         'Preparando…',
  'checkout.continue':          'Continuar al pago',
  'checkout.securedBy':         'Pagos procesados de forma segura por Stripe.',
  'checkout.payNow':            'Pagar ahora',
  'checkout.startError':        'No se pudo iniciar el pago',
  'checkout.unexpectedStatus':  'Estado de pago inesperado: {status}',
  'checkout.savedFailed':       'Pago realizado pero los boletos no se guardaron: {msg}. Guarda esta confirmación: {pi}',

  // Purchase confirmation
  'purchase.eyebrow':           'Confirmado',
  'purchase.youreGoing':        'Vas a {event}.',
  'purchase.secured.one':       '{count} boleto asegurado. Tu correo de confirmación va en camino.',
  'purchase.secured.many':      '{count} boletos asegurados. Tu correo de confirmación va en camino.',
  'purchase.yourTicket.one':    'Tu boleto',
  'purchase.yourTicket.many':   'Tus boletos',
  'purchase.viewTicket':        '🎟  Boleto #{n}',
  'purchase.view':              'Ver →',
  'purchase.openTicket':        'Abrir boleto',

  // ─── EventBar ────────────────────────────────────────────────────────────
  'bar.menu':                   'Menú',
  'bar.balance':                'Saldo',
  'bar.empty':                  'Menú próximamente.',
  'bar.yourTab':                'Tu cuenta',
  'bar.yourName':               'Tu nombre',
  'bar.startTab':               'Abrir cuenta',
  'bar.addToTab':               'Agregar a cuenta',
  'bar.review':                 'Revisar →',
  'bar.checkout':               'Pagar →',
  'bar.orderPlaced':            'Orden recibida',
  'bar.preparing':              'Preparando…',
  'bar.ready':                  'Lista para recoger',
  'bar.received':               'Recibida',
  'bar.markReady':              'Marcar lista',
  'bar.markServed':             'Marcar servida',
  'bar.refresh':                'Actualizar',
  'bar.queue':                  'Fila',
  'bar.notes':                  'Notas (opcional)',

  // ─── GrailDoves ──────────────────────────────────────────────────────────
  'doves.eyebrow':              'Cuenta del bar',
  'doves.title':                'Tus Doves',
  'doves.balance':              'Saldo',
  'doves.spent':                'Gastado',
  'doves.loadMore':             'Cargar más',
  'doves.empty':                'Aún no tienes cuenta — carga una para empezar.',
  'doves.signIn':               'Inicia sesión para ver tu cuenta',

  // ─── TicketView ──────────────────────────────────────────────────────────
  'ticket.eyebrow':             'Boleto',
  'ticket.presentAtDoor':       'Muestra esto en la entrada',
  'ticket.admitted':            '✓ Admitido',
  'ticket.refunded':            'Reembolsado',
  'ticket.invalidLink':         'Boleto no encontrado.',

  // ─── JoinPage ────────────────────────────────────────────────────────────
  'join.signIn':                'Iniciar sesión',
  'join.signUp':                'Crear cuenta',
  'join.forgot':                '¿Olvidaste tu contraseña?',
  'join.namePh':                'Tu nombre',
  'join.emailPh':               'Correo',
  'join.passwordPh':            'Contraseña',
  'join.continueEmail':         'Continuar con correo',
  'join.haveAccount':           '¿Ya tienes cuenta? Inicia sesión',
  'join.needAccount':           '¿Nuevo aquí? Crea una cuenta',

  // ─── ResetPassword ───────────────────────────────────────────────────────
  'reset.title':                'Restablecer contraseña',
  'reset.body':                 'Elige una nueva contraseña para tu cuenta.',
  'reset.newPasswordPh':        'Nueva contraseña',
  'reset.confirmPh':            'Confirmar nueva contraseña',
  'reset.submit':               'Actualizar contraseña',
  'reset.mismatch':             'Las contraseñas no coinciden.',
  'reset.tooShort':             'La contraseña debe tener al menos 8 caracteres.',
  'reset.success':              'Contraseña actualizada. Redirigiendo…',
  'reset.invalidLink':          'Este enlace ya no es válido. Solicita uno nuevo.',

  // ─── TermsPage ───────────────────────────────────────────────────────────
  'terms.title':                'Términos de servicio',

  // ─── GrailHome ───────────────────────────────────────────────────────────
  'home.tagline':               'Boletaje en vivo para los lugares que importan.',
  'home.cta.promoter':          'Soy promotor →',
  'home.cta.buyer':             'Buscar un show →',

  // ─── Locale toggle ───────────────────────────────────────────────────────
  'locale.es':                  'ES',
  'locale.en':                  'EN',
}
