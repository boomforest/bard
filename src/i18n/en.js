// English copy. Keys are flat with dot namespacing by surface.
// Add new keys to BOTH en.js and es.js when introducing a string.

export default {
  // ─── Common ──────────────────────────────────────────────────────────────
  'common.back':             '← Back',
  'common.close':            'Close',
  'common.loading':          'Loading…',
  'common.save':             'Save',
  'common.cancel':           'Cancel',
  'common.continue':         'Continue',
  'common.email':            'Email',
  'common.name':             'Name',
  'common.password':         'Password',
  'common.optional':         '(optional)',
  'common.poweredBy':        'Powered by GRAIL',
  'common.copy':             'Copy',
  'common.copied':           '✓ Copied',
  'common.processing':       'Processing…',

  // ─── EventPage ───────────────────────────────────────────────────────────
  'event.notFound.title':       'Event not found',
  'event.notFound.body':        "The link may be wrong, or this event isn't live yet.",
  'event.notFound.cta':         'Explore GRAIL →',
  'event.eyebrow.live':         'Live Now',
  'event.eyebrow.past':         'Past Event',
  'event.ended.title':          'This show has ended.',
  'event.ended.body':           'Thanks for being part of it.',
  'event.noTickets':            'No tickets available yet.',
  'event.tickets':              'Tickets',
  'event.add':                  'Add',
  'event.soldOut':              'Sold Out',
  'event.fewLeft':              '· {count} left',
  'event.checkout':             'Checkout →',
  'event.ticketCount.one':      '{count} ticket',
  'event.ticketCount.many':     '{count} tickets',

  // Waitlist
  'waitlist.eyebrow':           'Sold Out',
  'waitlist.title':             'Join the waitlist',
  'waitlist.body':              "Tickets sometimes free up before doors. Drop your email and we'll send you a buy link if any open back up.",
  'waitlist.namePh':            'Name (optional)',
  'waitlist.cta':                'Notify me if tickets open',
  'waitlist.adding':             'Adding…',
  'waitlist.invalidEmail':       'Enter a valid email.',
  'waitlist.done.title':         "You're on the waitlist.",
  'waitlist.done.body':          "If a ticket frees up before doors, we'll email you a link to grab it.",

  // Checkout modal
  'checkout.title':             'Checkout',
  'checkout.total':             'Total',
  'checkout.namePh':            'Your name',
  'checkout.emailRequired':     'Name and email required.',
  'checkout.emailInvalid':      'Enter a valid email.',
  'checkout.preparing':         'Preparing…',
  'checkout.continue':          'Continue to payment',
  'checkout.securedBy':         'Payments processed securely by Stripe.',
  'checkout.payNow':            'Pay now',
  'checkout.startError':        'Could not start checkout',
  'checkout.unexpectedStatus':  'Unexpected payment status: {status}',
  'checkout.savedFailed':       'Payment went through but tickets failed to save: {msg}. Save your confirmation: {pi}',

  // Purchase confirmation
  'purchase.eyebrow':           'Confirmed',
  'purchase.youreGoing':        "You're going to {event}.",
  'purchase.secured.one':       '{count} ticket secured. Confirmation email is on its way.',
  'purchase.secured.many':      '{count} tickets secured. Confirmation email is on its way.',
  'purchase.yourTicket.one':    'Your ticket',
  'purchase.yourTicket.many':   'Your tickets',
  'purchase.viewTicket':        '🎟  Ticket #{n}',
  'purchase.view':              'View →',
  'purchase.openTicket':        'Open ticket',

  // ─── EventBar ────────────────────────────────────────────────────────────
  'bar.menu':                   'Menu',
  'bar.balance':                'Balance',
  'bar.empty':                  'Menu coming soon.',
  'bar.yourTab':                'Your tab',
  'bar.yourName':               'Your name',
  'bar.startTab':               'Start a tab',
  'bar.addToTab':               'Add to tab',
  'bar.review':                 'Review →',
  'bar.checkout':               'Checkout →',
  'bar.orderPlaced':            'Order placed',
  'bar.preparing':              'Preparing…',
  'bar.ready':                  'Ready for pickup',
  'bar.received':               'Received',
  'bar.markReady':              'Mark Ready',
  'bar.markServed':             'Mark Served',
  'bar.refresh':                'Refresh',
  'bar.queue':                  'Queue',
  'bar.notes':                  'Notes (optional)',

  // ─── GrailDoves ──────────────────────────────────────────────────────────
  'doves.eyebrow':              'Bar Tab',
  'doves.title':                'Your Doves',
  'doves.balance':              'Balance',
  'doves.spent':                'Spent',
  'doves.loadMore':             'Load more',
  'doves.empty':                'No tab yet — load one to get started.',
  'doves.signIn':               'Sign in to see your tab',

  // ─── TicketView ──────────────────────────────────────────────────────────
  'ticket.eyebrow':             'Ticket',
  'ticket.presentAtDoor':       'Present this at the door',
  'ticket.admitted':            '✓ Admitted',
  'ticket.refunded':            'Refunded',
  'ticket.invalidLink':         'Ticket not found.',

  // ─── JoinPage ────────────────────────────────────────────────────────────
  'join.signIn':                'Sign in',
  'join.signUp':                'Sign up',
  'join.forgot':                'Forgot password?',
  'join.namePh':                'Your name',
  'join.emailPh':               'Email',
  'join.passwordPh':            'Password',
  'join.continueEmail':         'Continue with email',
  'join.haveAccount':           'Have an account? Sign in',
  'join.needAccount':           "New here? Sign up",

  // ─── ResetPassword ───────────────────────────────────────────────────────
  'reset.title':                'Reset password',
  'reset.body':                 'Pick a new password for your account.',
  'reset.newPasswordPh':        'New password',
  'reset.confirmPh':            'Confirm new password',
  'reset.submit':               'Update password',
  'reset.mismatch':             "Passwords don't match.",
  'reset.tooShort':             'Password must be at least 8 characters.',
  'reset.success':              'Password updated. Redirecting…',
  'reset.invalidLink':          'This reset link is invalid or expired. Request a new one.',

  // ─── TermsPage ───────────────────────────────────────────────────────────
  'terms.title':                'Terms of Service',

  // ─── GrailHome ───────────────────────────────────────────────────────────
  'home.tagline':               'Live ticketing for the venues that matter.',
  'home.cta.promoter':          "I'm a promoter →",
  'home.cta.buyer':             'Find a show →',

  // ─── Locale toggle ───────────────────────────────────────────────────────
  'locale.es':                  'ES',
  'locale.en':                  'EN',
}
