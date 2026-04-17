import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND, C, PAGE, FONT, SECONDARY_BTN, LogoMark } from './theme'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ color: BRAND.pink, fontWeight: '700', fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
      {title}
    </div>
    <div style={{ color: C.textMid, fontSize: '0.9rem', lineHeight: '1.7' }}>
      {children}
    </div>
  </div>
)

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div style={{ ...PAGE, padding: '2.5rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
          <div style={LogoMark({ size: 40 })}>GRAIL</div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.01em' }}>GRAIL</div>
        </div>

        <div style={{ color: C.text, fontWeight: '900', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Terms of Service
        </div>
        <div style={{ color: C.textDim, fontSize: '0.82rem', marginBottom: '3rem' }}>
          Last updated: April 2026
        </div>

        <Section title="What Grail Is">
          Grail is a software platform that provides ticketing, entry management, and bar-tab tooling
          to event promoters. Grail charges a flat fee for access to these tools. Grail is not an
          event promoter, co-host, co-organizer, or partner in any event produced using this platform.
        </Section>

        <Section title="Promoter Responsibilities">
          By creating an account and using Grail to produce an event, you ("Promoter") agree that you
          are solely responsible for:
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>All permits, licenses, and regulatory compliance required to produce your event, including but not limited to venue permits, alcohol licenses, fire codes, and occupancy limits</li>
            <li>The safety and wellbeing of all attendees</li>
            <li>Issuing refunds to ticket buyers in the event of cancellation, postponement, or any other circumstance — refunds are issued from the Promoter's own Stripe account; Grail's 2% platform fee is non-refundable</li>
            <li>Accurate representation of your event, including date, venue, lineup, and capacity</li>
          </ul>
        </Section>

        <Section title="Grail Is Not Liable For">
          To the fullest extent permitted by law, Grail shall not be liable for:
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Event cancellations, postponements, or changes made by the Promoter</li>
            <li>Failure of the Promoter to issue refunds</li>
            <li>Any incident arising from alcohol service at a Promoter's event</li>
            <li>Any regulatory violation, fine, or legal action resulting from a Promoter's event</li>
            <li>Loss of revenue, attendee disputes, or any indirect or consequential damages</li>
          </ul>
        </Section>

        <Section title="Payments">
          Grail charges a 2% platform fee on ticket sales, collected at the time of purchase via
          Stripe. This fee covers payment processing and platform access for ticketing only.
          Access to bar management and fast-pass entry features is charged as a separate flat fee.
          <br /><br />
          All ticket revenue beyond the 2% platform fee flows directly to the Promoter's connected
          Stripe account. Grail does not hold Promoter funds and is not responsible for any
          transaction between a Promoter and their customers. The Promoter is solely responsible
          for issuing refunds from their own account.
        </Section>

        <Section title="Account Termination">
          Grail reserves the right to suspend or terminate accounts that violate these terms,
          engage in fraudulent activity, or create legal exposure for the platform. Promoters found
          to have misrepresented events or failed to issue lawfully required refunds may be
          permanently banned.
        </Section>

        <Section title="Privacy">
          Grail collects the email addresses and basic profile information of registered users.
          This data is used solely to operate the platform and is not sold to third parties.
          Users in Mexico are protected under the Ley Federal de Protección de Datos Personales
          en Posesión de los Particulares (LFPDPPP). To request deletion of your data, contact
          us through the platform.
        </Section>

        <Section title="Governing Law">
          These terms are governed by the laws of Mexico. Disputes shall be resolved in the
          courts of Mexico City, CDMX.
        </Section>

        <button
          onClick={() => navigate(-1)}
          style={{ ...SECONDARY_BTN, marginTop: '1rem' }}
        >
          ← Back
        </button>

      </div>
    </div>
  )
}
