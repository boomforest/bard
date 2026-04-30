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
  'bar.eventNotFound':          'Event not found',
  'bar.checkLink':              'Check the link and try again.',
  'bar.headerSpending':         'Spending doves · order in one tap',
  'bar.headerLoad':             'Load doves to start ordering',
  'bar.inCart':                 '{count} in cart',
  'bar.loadDoves':              '+ Load Doves',
  'bar.add':                    'ADD',
  'bar.namePh':                 'Your name (so the bartender can call you)',
  'bar.placing':                'Placing…',
  'bar.placeOrder':             'Place Order',
  'bar.loadDovesToOrder':       'Load doves to order',
  'bar.received':               'Received',
  'bar.confirming':             'Confirming…',
  'bar.readyForPickup':         'Ready for pickup',
  'bar.refreshStatus':          '↻ Refresh status',
  'bar.refreshing':             'Refreshing…',
  'bar.makingTitle':            'Bartender is making it',
  'bar.receivedTitle':          'Order received',
  'bar.makingBody':             "You're next in line. Hold tight.",
  'bar.receivedBody':           "The bartender has your order. We'll call you when it's ready.",
  'bar.orderHash':              'Order #{n}',
  'bar.orderAgain':             'Order again',
  'bar.itemCount.one':          '{count} item',
  'bar.itemCount.many':         '{count} items',

  // Categories
  'bar.cat.all':                'All',
  'bar.cat.spirits':            'Spirits',
  'bar.cat.beer':               'Beer',
  'bar.cat.cocktail':           'Cocktails',
  'bar.cat.na':                 'No Alc',
  'bar.cat.snacks':             'Snacks',

  // Errors
  'bar.err.needName':           'Add your name so the bartender can call you.',
  'bar.err.needBalance':        'Load a doves balance first to place an order.',
  'bar.err.insufficient':       'Need ${need}, balance has ${have}. Top up or remove items.',
  'bar.err.orderFailed':        'Order failed',

  // Load Doves modal
  'load.title':                 'Load Doves',
  'load.pay':                   'Pay',
  'load.body':                  "Card is charged once now. Whatever you don't spend gets refunded after the show closes — no card prompt per drink. Refunds usually arrive instantly when the bar closes out, but Stripe can take up to 7 days in rare cases.",
  'load.amountPh':              'Custom amount',
  'load.emailPh':               'Email — for refund receipt',
  'load.loading':               'Loading…',
  'load.continue':              'Continue — load ${amt}',
  'load.refundNote':            'Unspent doves refunded to your card when the bar closes out — usually instant, up to 7 days in rare cases.',
  'load.invalidEmail':          'Valid email required.',
  'load.minimum':               'Minimum load is $5.',
  'load.startError':            'Could not start load',
  'load.saveError':             'Could not save balance',
  'load.saveFailed':            'Charge succeeded but balance failed to save: {msg}. Save this PI: {pi}',
  'load.stripeMissing':         'Stripe not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.',

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
