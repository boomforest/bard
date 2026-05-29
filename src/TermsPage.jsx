import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND, C, PAGE, FONT, SECONDARY_BTN, LogoMark } from './theme'
import { useT } from './i18n'
import LocaleToggle from './LocaleToggle'

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
  const t = useT()
  const navigate = useNavigate()

  return (
    <div style={{ ...PAGE, padding: '2.5rem 1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={LogoMark({ size: 40 })}>GRAIL</div>
            <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.01em' }}>GRAIL</div>
          </div>
          <LocaleToggle />
        </div>

        <div style={{ color: C.text, fontWeight: '900', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          {t('terms.title')}
        </div>
        <div style={{ color: C.textDim, fontSize: '0.82rem', marginBottom: '3rem' }}>
          {t('terms.lastUpdated')}
        </div>

        <Section title={t('terms.section.what.title')}>
          {t('terms.section.what.body')}
        </Section>

        <Section title={t('terms.section.resp.title')}>
          {t('terms.section.resp.intro')}
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>{t('terms.section.resp.item1')}</li>
            <li>{t('terms.section.resp.item2')}</li>
            <li>{t('terms.section.resp.item3')}</li>
            <li>{t('terms.section.resp.item4')}</li>
          </ul>
        </Section>

        <Section title={t('terms.section.notLiable.title')}>
          {t('terms.section.notLiable.intro')}
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>{t('terms.section.notLiable.item1')}</li>
            <li>{t('terms.section.notLiable.item2')}</li>
            <li>{t('terms.section.notLiable.item3')}</li>
            <li>{t('terms.section.notLiable.item4')}</li>
            <li>{t('terms.section.notLiable.item5')}</li>
          </ul>
        </Section>

        <Section title={t('terms.section.payments.title')}>
          {t('terms.section.payments.body1')}
          <br /><br />
          {t('terms.section.payments.body2')}
          <br /><br />
          {t('terms.section.payments.body3')}
        </Section>

        <Section title={t('terms.section.term.title')}>
          {t('terms.section.term.body')}
        </Section>

        <Section title={t('terms.section.privacy.title')}>
          {t('terms.section.privacy.body')}
        </Section>

        <Section title={t('terms.section.law.title')}>
          {t('terms.section.law.body')}
        </Section>

        <button
          onClick={() => navigate(-1)}
          style={{ ...SECONDARY_BTN, marginTop: '1rem' }}
        >
          {t('common.back')}
        </button>

      </div>
    </div>
  )
}
