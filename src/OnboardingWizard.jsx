import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { BRAND, C, FONT } from './theme'

// Three-step onboarding checklist for first-time promoters. Hides itself
// once all three are done. Steps:
//   1. Connect Stripe (so ticket money has somewhere to land)
//   2. Create your first event
//   3. Share the link (auto-completes when any of their events has a sale)

export default function OnboardingWizard({ promoterId, stripeReady, onConnectStripe, onCreateEvent }) {
  const [firstEvent, setFirstEvent] = useState(null) // {slug, has_sold, name} | null | undefined (loading)

  useEffect(() => {
    if (!promoterId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('id, slug, name, tickets_sold')
        .eq('promoter_id', promoterId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      setFirstEvent(data || null)
    }
    load()
    return () => { cancelled = true }
  }, [promoterId])

  // Wait for both signals before deciding to render anything.
  if (stripeReady === null || firstEvent === undefined) return null

  const step1 = !!stripeReady
  const step2 = !!firstEvent
  const step3 = !!(firstEvent && firstEvent.tickets_sold > 0)

  if (step1 && step2 && step3) return null  // all done — disappear

  const shareUrl = firstEvent?.slug ? `${window.location.origin}/e/${firstEvent.slug}` : null

  return (
    <div style={{ padding: '1rem 1.5rem 0' }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '14px', overflow: 'hidden',
      }}>
        <div style={{ padding: '0.85rem 1.1rem 0.7rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '0.66rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.2rem' }}>
            Get your first show live
          </div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '0.95rem' }}>
            {step1 && step2 ? 'One thing left' : step1 ? 'Two things left' : 'Three quick steps'}
          </div>
        </div>

        <Step n={1} done={step1} label="Connect your Stripe account">
          {step1 ? (
            <SubText>Money from ticket sales lands in your Stripe balance directly.</SubText>
          ) : (
            <>
              <SubText>Ticket revenue routes straight to your account. Setup takes ~3 minutes.</SubText>
              <Button onClick={onConnectStripe} variant="primary">Connect with Stripe →</Button>
            </>
          )}
        </Step>

        <Step n={2} done={step2} label="Create your first event">
          {step2 ? (
            <SubText>{firstEvent.name || 'Event'} created — keep going.</SubText>
          ) : step1 ? (
            <>
              <SubText>Set the date, venue, ticket tiers. Takes about 5 minutes.</SubText>
              <Button onClick={onCreateEvent} variant="primary">Create event →</Button>
            </>
          ) : (
            <SubText>Connect Stripe first — your event needs somewhere to send the money.</SubText>
          )}
        </Step>

        <Step n={3} done={step3} label="Share your event link">
          {step3 ? (
            <SubText>Tickets are selling. You're live.</SubText>
          ) : step2 && shareUrl ? (
            <>
              <SubText>Send this link to your audience. Step 3 ticks itself once anyone buys a ticket.</SubText>
              <ShareLink url={shareUrl} />
            </>
          ) : (
            <SubText>Once your event is live, the link to share will appear here.</SubText>
          )}
        </Step>
      </div>
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────

function Step({ n, done, label, children }) {
  return (
    <div style={{
      display: 'flex', gap: '0.9rem', padding: '0.85rem 1.1rem',
      borderBottom: `1px solid ${C.border}`,
      opacity: done ? 0.7 : 1,
    }}>
      <div style={{
        flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
        background: done ? BRAND.neon : 'transparent',
        border: `1.5px solid ${done ? BRAND.neon : C.border}`,
        color: done ? '#000' : C.textMid,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.78rem', fontWeight: '800', fontFamily: FONT,
      }}>
        {done ? '✓' : n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: done ? C.textMid : C.text,
          fontWeight: '700', fontSize: '0.92rem',
          textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: C.textDim,
          marginBottom: '0.2rem',
        }}>
          {label}
        </div>
        {children}
      </div>
    </div>
  )
}

function SubText({ children }) {
  return <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>{children}</div>
}

function Button({ onClick, children, variant }) {
  const isPrimary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        background: isPrimary ? BRAND.gradient : 'transparent',
        color: isPrimary ? '#000' : C.text,
        border: isPrimary ? 'none' : `1px solid ${C.border}`,
        borderRadius: '8px', padding: '0.5rem 1rem',
        fontSize: '0.85rem', fontWeight: '800', fontFamily: FONT,
        cursor: 'pointer', marginTop: '0.2rem',
      }}
    >
      {children}
    </button>
  )
}

function ShareLink({ url }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
      padding: '0.4rem 0.5rem 0.4rem 0.85rem', marginTop: '0.2rem',
    }}>
      <span style={{
        flex: 1, minWidth: 0, color: BRAND.neon, fontSize: '0.78rem',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{url}</span>
      <button onClick={copy} type="button" style={{
        background: copied ? BRAND.neon : 'transparent',
        color: copied ? '#000' : C.textMid,
        border: `1px solid ${copied ? BRAND.neon : C.border}`, borderRadius: '6px',
        padding: '0.25rem 0.7rem', fontSize: '0.75rem', fontWeight: '700',
        cursor: 'pointer', fontFamily: FONT, flexShrink: 0,
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}
