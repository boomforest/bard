import React, { useState, useEffect, useRef } from 'react'
import { t } from './translations'
import { supabase } from './supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCheckoutForm({ onSuccess, onCancel, loading, setLoading, setMessage, setMessageType, T }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setMessage('');
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      setMessage(error.message);
      setMessageType('error');
    } else if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      await onSuccess(paymentIntent.id);
    } else {
      setMessage(`Unexpected payment status: ${paymentIntent?.status}. Contact jp@casadecopas.com with your payment confirmation.`);
      setMessageType('error');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs', wallets: { link: 'never' } }} />
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: '100%', marginTop: '1.25rem', padding: '1.1rem',
          background: loading ? '#333' : 'linear-gradient(45deg, #d2691e, #cd853f)',
          color: 'white', border: 'none', borderRadius: '12px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: '700', fontSize: '1.1rem',
          boxShadow: loading ? 'none' : '0 4px 20px rgba(210,105,30,0.4)',
        }}
      >
        {loading ? T.processing : T.payStripe}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          width: '100%', marginTop: '0.5rem', padding: '0.75rem',
          background: 'transparent', color: '#666',
          border: '1px solid #333', borderRadius: '12px',
          cursor: 'pointer', fontSize: '0.9rem',
        }}
      >
        {T.cancel}
      </button>
    </form>
  );
}

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
  const [lang, setLang] = useState('en');
  const T = t[lang];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [followNonlinear, setFollowNonlinear] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'error' | 'success'
  const [eventData, setEventData] = useState(null);
  const eventDataRef = useRef(null);
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
    if (data) { setEventData(data); eventDataRef.current = data; }
    if (error) console.error('Could not load event:', error.message);
  };

  const pricePerTicket = earlyBird ? 400 : 500;
  const totalPrice = pricePerTicket * quantity;

  // ---------------------------------------------------------------
  // Stub email confirmation — replace with Resend / SendGrid later
  // ---------------------------------------------------------------
  const sendConfirmationEmail = async (ticketIds, purchaserName, purchaserEmail, qty) => {
    const res = await fetch('/.netlify/functions/send-ticket-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: purchaserEmail,
        name: purchaserName,
        ticketIds,
        quantity: qty,
        origin: window.location.origin,
        lang,
      })
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Email function error ${res.status}: ${body}`)
    }
  };

  // ---------------------------------------------------------------
  // Write tickets to Supabase after payment succeeds
  // ---------------------------------------------------------------
  const createTicketsInSupabase = async (paymentIntentId) => {
    const event = eventDataRef.current;
    if (!event) throw new Error('Event data not loaded');

    // Get current tickets_sold to assign sequential numbers
    const { data: freshEvent } = await supabase
      .from('events')
      .select('tickets_sold, capacity')
      .eq('id', event.id)
      .single();

    if ((freshEvent?.tickets_sold || 0) + quantity > (freshEvent?.capacity || 250)) {
      throw new Error('Sorry, not enough tickets remaining!');
    }

    // Insert tickets one at a time to avoid number conflicts
    const insertedTickets = [];
    for (let i = 0; i < quantity; i++) {
      const { data: countData } = await supabase
        .from('tickets')
        .select('ticket_number')
        .eq('event_id', event.id)
        .order('ticket_number', { ascending: false })
        .limit(1);

      const nextNumber = (countData?.[0]?.ticket_number || 0) + 1;

      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          event_id: event.id,
          email,
          name,
          quantity: 1,
          ticket_number: nextNumber,
          stripe_payment_intent_id: paymentIntentId,
          follow_nonlinear: followNonlinear,
        })
        .select('id, ticket_number')
        .single();

      if (insertError) throw insertError;
      insertedTickets.push(ticket);
    }

    // Update tickets_sold count on event
    await supabase
      .from('events')
      .update({ tickets_sold: (freshEvent?.tickets_sold || 0) + quantity })
      .eq('id', event.id);

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
  const [clientSecret, setClientSecret] = useState(null);

  const handlePreparePayment = async () => {
    if (!name.trim() || !email.trim()) {
      setMessage(T.errNameEmail);
      setMessageType('error');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage(T.errEmail);
      setMessageType('error');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalPrice, currency: 'mxn' }),
      });
      const { clientSecret: cs, error } = await res.json();
      if (error) throw new Error(error);
      setClientSecret(cs);
    } catch (err) {
      setMessage(T.errPayment(err.message));
      setMessageType('error');
    }
    setLoading(false);
  };

  const handleStripeSuccess = async (paymentIntentId) => {
    try {
      const tickets = await createTicketsInSupabase(paymentIntentId);
      const ticketIds = tickets.map(t => t.id);
      await sendConfirmationEmail(ticketIds, name, email, quantity);
      setClientSecret(null);
      setMessage(T.success(quantity));
      setMessageType('success');
    } catch (err) {
      setMessage(`Payment succeeded but ticket creation failed: ${err.message}. Contact jp@casadecopas.com immediately with your payment confirmation.`);
      setMessageType('error');
    }
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

        {/* Language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', background: '#1a0a00', border: '1px solid #2a1500', borderRadius: '8px', overflow: 'hidden' }}>
            {['en', 'es'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '0.35rem 0.75rem',
                background: lang === l ? 'linear-gradient(45deg, #d2691e, #cd853f)' : 'transparent',
                color: lang === l ? '#fff' : '#666',
                border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Poster header */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0800 0%, #2d1200 100%)',
          border: '1px solid #4a2800',
          borderRadius: '20px 20px 0 0',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.25em', color: '#cd853f', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            {T.secretShow}
          </div>
          <img
            src="https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nonlinear%20outline.svg"
            alt="Nonlinear"
            style={{ width: '100%', display: 'block', margin: '0 auto 0.25rem auto', filter: 'brightness(0) invert(1)' }}
          />
          <div style={{ width: '60px', height: '2px', background: '#d2691e', margin: '1rem auto' }} />
          <div style={{ color: '#e8d5b0', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            {T.date}
          </div>
          <div style={{ color: '#cd853f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            {T.time}
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
            {T.location}
          </div>
          {remaining < 30 && remaining > 0 && (
            <div style={{ color: '#ff6b35', fontSize: '0.85rem', marginTop: '1rem', fontWeight: '600' }}>
              {T.onlyLeft(remaining)}
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
              <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>{T.soldOut}</div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>{T.soldOutMsg(capacity)}</div>
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
                  {earlyBird ? T.earlyBird : T.weekOf}
                </div>
                <div style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '800' }}>
                  ${pricePerTicket} <span style={{ fontSize: '1rem', fontWeight: '400', color: '#999' }}>{T.perTicket}</span>
                </div>
                {earlyBird && (
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {T.priceRises}
                  </div>
                )}
              </div>

              {/* Form fields */}
              {[
                { label: T.name, value: name, setter: setName, type: 'text', placeholder: T.namePlaceholder, autoComplete: 'name' },
                { label: T.email, value: email, setter: setEmail, type: 'email', placeholder: T.emailPlaceholder, autoComplete: 'email' },
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
                  {T.tickets}
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
                    <option key={n} value={n}>{T.ticketOption(n, pricePerTicket)}</option>
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
                  {T.followLabel}
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

              {/* Stripe payment */}
              {clientSecret && stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                  <StripeCheckoutForm
                    onSuccess={handleStripeSuccess}
                    onCancel={() => setClientSecret(null)}
                    loading={loading}
                    setLoading={setLoading}
                    setMessage={setMessage}
                    setMessageType={setMessageType}
                    T={T}
                  />
                </Elements>
              ) : (
                <button
                  onClick={handlePreparePayment}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '1.1rem',
                    background: loading ? '#333' : 'linear-gradient(45deg, #d2691e, #cd853f)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '700', fontSize: '1.1rem', letterSpacing: '0.02em',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(210,105,30,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? T.loading : T.getTickets(quantity, totalPrice)}
                </button>
              )}

              <div style={{ textAlign: 'center', color: '#555', fontSize: '0.75rem', marginTop: '1rem' }}>
                {T.disclaimer}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#333', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Powered by Grail
        </div>
      </div>
    </div>
  );
}
