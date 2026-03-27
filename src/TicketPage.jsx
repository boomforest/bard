import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { loadStripe } from '@stripe/stripe-js'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

// TODO: Add VITE_STRIPE_SECRET_KEY to env for real payment processing
// For now, mock success flow is used so the rest of the app is testable.

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

// Mexico City timezone offset: UTC-6
const CDMX_OFFSET_HOURS = -6;
const EARLY_BIRD_ENDS = new Date('2026-04-07T06:00:00Z'); // April 7 midnight CDMX

function getNowCDMX() {
  return new Date(new Date().getTime() + CDMX_OFFSET_HOURS * 60 * 60 * 1000);
}

function isEarlyBird() {
  return new Date() < EARLY_BIRD_ENDS;
}

export default function TicketPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [followNonlinear, setFollowNonlinear] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'error' | 'success'
  const [eventData, setEventData] = useState(null);
  const [earlyBird, setEarlyBird] = useState(isEarlyBird());

  useEffect(() => {
    fetchEvent();
    // Re-check pricing every minute
    const interval = setInterval(() => setEarlyBird(isEarlyBird()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('artist_name', 'Nonlinear')
      .single();
    if (data) setEventData(data);
    if (error) console.error('Could not load event:', error.message);
  };

  const pricePerTicket = 0; // TEST MODE — set to earlyBird ? 400 : 500 before go-live
  const totalPrice = pricePerTicket * quantity;

  // ---------------------------------------------------------------
  // Stub email confirmation — replace with Resend / SendGrid later
  // ---------------------------------------------------------------
  const sendConfirmationEmail = async (ticketIds, purchaserName, purchaserEmail, qty) => {
    try {
      await fetch('/.netlify/functions/send-ticket-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: purchaserEmail,
          name: purchaserName,
          ticketIds,
          quantity: qty,
          origin: window.location.origin
        })
      })
    } catch (err) {
      console.error('Email send failed:', err)
    }
  };

  // ---------------------------------------------------------------
  // Write tickets to Supabase after payment succeeds
  // ---------------------------------------------------------------
  const createTicketsInSupabase = async (paymentIntentId) => {
    if (!eventData) throw new Error('Event data not loaded');

    // Get current tickets_sold to assign sequential numbers
    const { data: freshEvent } = await supabase
      .from('events')
      .select('tickets_sold, capacity')
      .eq('id', eventData.id)
      .single();

    const currentSold = freshEvent?.tickets_sold || 0;

    if (currentSold + quantity > (freshEvent?.capacity || 250)) {
      throw new Error('Sorry, not enough tickets remaining!');
    }

    // Create one ticket row per ticket in the order
    const ticketRows = Array.from({ length: quantity }, (_, i) => ({
      event_id: eventData.id,
      email,
      name,
      quantity: 1,
      ticket_number: currentSold + i + 1,
      stripe_payment_intent_id: paymentIntentId,
      follow_nonlinear: followNonlinear,
    }));

    const { data: insertedTickets, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketRows)
      .select('id, ticket_number');

    if (insertError) throw insertError;

    // Update tickets_sold count on event
    await supabase
      .from('events')
      .update({ tickets_sold: currentSold + quantity })
      .eq('id', eventData.id);

    // Optionally add to followers
    if (followNonlinear) {
      await supabase.from('followers').insert({
        email,
        name,
        city: 'Condesa/Roma, CDMX',
        radius_miles: 10,
        artist_id: 'nonlinear',
      });
    }

    return insertedTickets;
  };

  // ---------------------------------------------------------------
  // Handle purchase
  // MOCK FLOW: Real Stripe charge is stubbed. Replace the mock block
  // below with actual Stripe Checkout Session creation once
  // VITE_STRIPE_SECRET_KEY is added to environment.
  // ---------------------------------------------------------------
  const handlePurchase = async () => {
    if (!name.trim() || !email.trim()) {
      setMessage('Please enter your name and email.');
      setMessageType('error');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Please enter a valid email address.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // ---- MOCK PAYMENT FLOW (replace with real Stripe when key is added) ----
      const mockPaymentIntentId = `mock_pi_${Date.now()}`;
      console.log('MOCK PAYMENT: Would charge', totalPrice, 'MXN via Stripe');

      const tickets = await createTicketsInSupabase(mockPaymentIntentId);
      const ticketIds = tickets.map(t => t.id);

      sendConfirmationEmail(ticketIds, name, email, quantity);

      setMessage(`You're in! Check your email for your ticket link${quantity > 1 ? 's' : ''}.`);
      setMessageType('success');

      // In production with Stripe key, redirect to Stripe Checkout like:
      // const stripe = await stripePromise;
      // const response = await fetch('/api/create-checkout-session', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ quantity, email, name, followNonlinear, eventId: eventData.id }),
      // });
      // const session = await response.json();
      // await stripe.redirectToCheckout({ sessionId: session.id });
      // -------------------------------------------------------------------------

    } catch (err) {
      setMessage(`Purchase failed: ${err.message}`);
      setMessageType('error');
    }

    setLoading(false);
  };

  const ticketsSoldCount = eventData?.tickets_sold || 0;
  const capacity = eventData?.capacity || 250;
  const remaining = capacity - ticketsSoldCount;
  const soldOut = remaining <= 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0a00 50%, #0d0d0d 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Poster header */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0800 0%, #2d1200 100%)',
          border: '1px solid #4a2800',
          borderRadius: '20px 20px 0 0',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.25em', color: '#cd853f', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Secret Show
          </div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: '#fff',
            margin: '0 0 0.25rem 0',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            NONLINEAR
          </h1>
          <div style={{ width: '60px', height: '2px', background: '#d2691e', margin: '1rem auto' }} />
          <div style={{ color: '#e8d5b0', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            April 11, 2026
          </div>
          <div style={{ color: '#cd853f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            10PM — Sunrise
          </div>
          <div style={{
            display: 'inline-block',
            background: 'rgba(210, 105, 30, 0.15)',
            border: '1px solid rgba(210, 105, 30, 0.4)',
            borderRadius: '20px',
            padding: '0.4rem 1rem',
            color: '#e8d5b0',
            fontSize: '0.85rem',
            marginTop: '0.5rem',
          }}>
            Less than 10 minutes from Condesa/Roma
          </div>
          {remaining < 30 && remaining > 0 && (
            <div style={{ color: '#ff6b35', fontSize: '0.85rem', marginTop: '1rem', fontWeight: '600' }}>
              Only {remaining} tickets left
            </div>
          )}
        </div>

        {/* Purchase form */}
        <div style={{
          background: '#111',
          border: '1px solid #2a1500',
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          padding: '2rem',
        }}>

          {soldOut ? (
            <div style={{ textAlign: 'center', color: '#cd853f', padding: '2rem 0' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>SOLD OUT</div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>All {capacity} tickets have been claimed.</div>
            </div>
          ) : (
            <>
              {/* Pricing badge */}
              <div style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: earlyBird ? 'rgba(34, 100, 34, 0.2)' : 'rgba(100, 60, 10, 0.2)',
                border: `1px solid ${earlyBird ? 'rgba(34, 150, 34, 0.4)' : 'rgba(150, 100, 20, 0.4)'}`,
                borderRadius: '12px',
              }}>
                <div style={{ color: earlyBird ? '#4caf50' : '#cd853f', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
                  {earlyBird ? 'Early Bird Pricing' : 'Week-Of Pricing'}
                </div>
                <div style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '800' }}>
                  ${pricePerTicket} <span style={{ fontSize: '1rem', fontWeight: '400', color: '#999' }}>MXN / ticket</span>
                </div>
                {earlyBird && (
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Price goes to $500 MXN on April 7
                  </div>
                )}
              </div>

              {/* Form fields */}
              {[
                { label: 'Name', value: name, setter: setName, type: 'text', placeholder: 'Your name', autoComplete: 'name' },
                { label: 'Email', value: email, setter: setEmail, type: 'email', placeholder: 'your@email.com', autoComplete: 'email' },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#999', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '1rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}

              {/* Quantity */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Tickets
                </label>
                <select
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '1rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: Math.min(10, remaining) }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''} — ${n * pricePerTicket} MXN</option>
                  ))}
                </select>
              </div>

              {/* Follow checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                cursor: 'pointer',
              }}>
                <div
                  onClick={() => setFollowNonlinear(!followNonlinear)}
                  style={{
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    marginTop: '1px',
                    background: followNonlinear ? '#d2691e' : '#1a1a1a',
                    border: `2px solid ${followNonlinear ? '#d2691e' : '#444'}`,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {followNonlinear && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.4 }}>
                  Keep me posted on secret shows and exclusive presales from Nonlinear
                </span>
              </label>

              {/* Message */}
              {message && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  marginBottom: '1rem',
                  background: messageType === 'error' ? 'rgba(200, 50, 50, 0.15)' :
                    messageType === 'success' ? 'rgba(50, 150, 50, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                  border: `1px solid ${messageType === 'error' ? 'rgba(200,50,50,0.4)' :
                    messageType === 'success' ? 'rgba(50,150,50,0.4)' : 'rgba(100,100,100,0.4)'}`,
                  color: messageType === 'error' ? '#ff8080' :
                    messageType === 'success' ? '#80ff80' : '#ccc',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  {message}
                </div>
              )}

              {/* Buy button — Stripe mock */}
              <button
                onClick={handlePurchase}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  background: loading ? '#333' : 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                  letterSpacing: '0.02em',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(210, 105, 30, 0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? 'Processing...' : `Get ${quantity} Ticket${quantity > 1 ? 's' : ''} — FREE (Test Mode)`}
              </button>

              {/* PayPal divider + button */}
              {import.meta.env.VITE_PAYPAL_CLIENT_ID && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    margin: '1.25rem 0',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
                    <span style={{ color: '#555', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      — or pay with —
                    </span>
                    <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
                  </div>

                  <PayPalScriptProvider options={{
                    'client-id': import.meta.env.VITE_PAYPAL_CLIENT_ID,
                    currency: 'MXN',
                  }}>
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                      disabled={!name.trim() || !email.trim() || loading}
                      createOrder={(_data, actions) => {
                        if (!name.trim() || !email.trim()) {
                          setMessage('Please enter your name and email before paying with PayPal.');
                          setMessageType('error');
                          return Promise.reject(new Error('Missing name or email'));
                        }
                        if (!/^\S+@\S+\.\S+$/.test(email)) {
                          setMessage('Please enter a valid email address.');
                          setMessageType('error');
                          return Promise.reject(new Error('Invalid email'));
                        }
                        const customId = JSON.stringify({
                          email,
                          name,
                          quantity,
                          follow_nonlinear: followNonlinear,
                          event_id: eventData?.id,
                        });
                        return actions.order.create({
                          purchase_units: [{
                            amount: {
                              value: String(totalPrice),
                              currency_code: 'MXN',
                            },
                            custom_id: customId,
                            description: `Nonlinear — ${quantity} ticket${quantity > 1 ? 's' : ''} (April 11, 2026)`,
                          }],
                        });
                      }}
                      onApprove={async (_data, actions) => {
                        setLoading(true);
                        setMessage('');
                        try {
                          const order = await actions.order.capture();
                          const paypalOrderId = order.id;
                          // Mirror the mock Stripe success flow: write tickets to Supabase client-side
                          // (webhook also handles this server-side as the durable fallback)
                          const tickets = await createTicketsInSupabase(paypalOrderId);
                          const ticketIds = tickets.map(t => t.id);
                          sendConfirmationEmail(ticketIds, name, email, quantity);
                          setMessage(`Payment successful via PayPal! Check your console for ticket links.`);
                          setMessageType('success');
                        } catch (err) {
                          setMessage(`PayPal payment failed: ${err.message}`);
                          setMessageType('error');
                        }
                        setLoading(false);
                      }}
                      onError={(err) => {
                        console.error('PayPal button error:', err);
                        setMessage('PayPal encountered an error. Please try again or use the button above.');
                        setMessageType('error');
                      }}
                      onCancel={() => {
                        setMessage('PayPal payment cancelled.');
                        setMessageType('info');
                      }}
                    />
                  </PayPalScriptProvider>
                </>
              )}

              <div style={{ textAlign: 'center', color: '#555', fontSize: '0.75rem', marginTop: '1rem' }}>
                Each ticket gets its own unique link. Tickets are non-refundable.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#333', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Powered by BARD
        </div>
      </div>
    </div>
  );
}
