import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'
import { useT } from './i18n'
import LocaleToggle from './LocaleToggle'

const RADII = ['10', '25', '50', '100']

export default function JoinPage() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const inviteToken     = searchParams.get('invite')
  const coInviteToken   = searchParams.get('co_invite')

  const [step, setStep]         = useState('auth') // auth | role | fan-setup
  const [authMode, setAuthMode] = useState((inviteToken || coInviteToken) ? 'signup' : 'login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [session, setSession]   = useState(null)
  const [zip, setZip]           = useState('')
  const [radius, setRadius]     = useState('25')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [invite, setInvite]     = useState(null)   // resolved invite row, or null
  const [coInvite, setCoInvite] = useState(null)   // resolved event_producers row + event_slug
  const [inviteErr, setInviteErr] = useState('')
  const navigate = useNavigate()

  // Resolve the promoter invite token (if any) and pre-fill email
  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('promoter_invites')
        .select('*')
        .eq('token', inviteToken)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setInviteErr(t('join.inviteInvalid'))
        return
      }
      if (data.redeemed_by) {
        setInviteErr(t('join.inviteUsed'))
        return
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInviteErr(t('join.inviteExpired'))
        return
      }
      setInvite(data)
      if (data.email && !email) setEmail(data.email)
    }
    load()
    return () => { cancelled = true }
  }, [inviteToken])

  // Resolve the co-producer invite token (if any). Joins to events for the
  // post-signup redirect to /promoter/event/:slug.
  useEffect(() => {
    if (!coInviteToken) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('event_producers')
        .select('id, name, role, split_pct, email, user_id, invite_token, events!inner(slug, name)')
        .eq('invite_token', coInviteToken)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setInviteErr(t('join.inviteInvalid'))
        return
      }
      if (data.user_id) {
        setInviteErr(t('join.inviteUsed'))
        return
      }
      setCoInvite(data)
      if (data.email && !email) setEmail(data.email)
    }
    load()
    return () => { cancelled = true }
  }, [coInviteToken])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkProfile(session)
    })
  }, [])

  const checkProfile = async (s) => {
    // Co-producer invite path: link event_producers.user_id via the
    // security-definer redeem_co_invite RPC (the standard RLS policy only
    // lets the event's promoter update producer rows; this caller is a
    // co-producer, not the promoter).
    if (coInvite) {
      await supabase.from('users').upsert({
        id:        s.user.id,
        email:     s.user.email,
        username:  s.user.email.split('@')[0].toUpperCase(),
        user_type: 'promoter',
      })
      const { data: redeemed } = await supabase.rpc('redeem_co_invite', { p_token: coInviteToken })
      const slug = redeemed?.[0]?.event_slug || coInvite.events?.slug
      navigate(slug ? `/promoter/event/${slug}` : '/promoter')
      return
    }

    // Promoter invite path: skip the role picker, mark user as promoter, redeem invite
    if (invite) {
      await supabase.from('users').upsert({
        id:        s.user.id,
        email:     s.user.email,
        username:  s.user.email.split('@')[0].toUpperCase(),
        user_type: 'promoter',
      })
      await supabase
        .from('promoter_invites')
        .update({ redeemed_by: s.user.id, redeemed_at: new Date().toISOString() })
        .eq('id', invite.id)
      if (invite.request_id) {
        await supabase
          .from('promoter_requests')
          .update({ status: 'redeemed' })
          .eq('id', invite.request_id)
      }
      navigate('/promoter')
      return
    }
    const { data } = await supabase.from('users').select('user_type').eq('id', s.user.id).single()
    if (data?.user_type === 'promoter') navigate('/promoter')
    else if (data?.user_type === 'fan')  navigate('/me')
    else { setSession(s); setStep('role') }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = authMode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
      const { data, error } = await fn
      if (error) throw error
      if (data.session) {
        setSession(data.session)
        await checkProfile(data.session)
      } else {
        setError(t('join.confirmEmail'))
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const selectRole = async (role) => {
    setLoading(true)
    if (role === 'promoter') {
      await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email,
        username: session.user.email.split('@')[0].toUpperCase(),
        user_type: 'promoter',
      })
      navigate('/promoter')
    } else {
      setStep('fan-setup')
      setLoading(false)
    }
  }

  const handleFanSetup = async (e) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('users').upsert({
      id: session.user.id,
      email: session.user.email,
      username: session.user.email.split('@')[0].toUpperCase(),
      user_type: 'fan',
      zip_code: zip,
      radius_miles: parseInt(radius),
    })
    navigate('/me')
  }

  const wrap = (children) => (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '500px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />
      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <div style={LogoMark({ size: 56 })}>GRAIL</div>
          <LocaleToggle />
        </div>
        {children}
      </div>
    </div>
  )

  if (step === 'auth') return wrap(
    <div>
      {inviteErr && (
        <div style={{ background: 'rgba(240,112,32,0.08)', border: `1px solid ${BRAND.orange}55`, borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1rem', color: BRAND.orange, fontSize: '0.85rem', textAlign: 'center' }}>
          {inviteErr}
        </div>
      )}
      {invite && !inviteErr && (
        <div style={{ background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`, borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: BRAND.neon, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.2rem' }}>
            {t('join.inviteAccepted')}
          </div>
          <div style={{ color: C.text, fontSize: '0.85rem' }}>
            {t('join.inviteAcceptedBody')}
          </div>
        </div>
      )}
      {coInvite && !inviteErr && (
        <div style={{ background: 'rgba(221,34,170,0.07)', border: `1px solid ${BRAND.pink}55`, borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.2rem' }}>
            Co-producer invite
          </div>
          <div style={{ color: C.text, fontSize: '0.85rem' }}>
            {coInvite.events?.name
              ? `Sign up to review the contract for ${coInvite.events.name}.`
              : 'Sign up to review your contract.'}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '0.25rem' }}>
        {['login', 'signup'].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{
            flex: 1, padding: '0.55rem', borderRadius: '7px', border: 'none',
            background: authMode === m ? BRAND.gradient : 'transparent',
            color: authMode === m ? '#000' : C.textMid,
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
            fontFamily: FONT, transition: 'all 0.2s',
          }}>
            {m === 'login' ? t('join.signIn') : t('join.signUp')}
          </button>
        ))}
      </div>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <input style={INPUT} type="email" placeholder={t('common.email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input style={INPUT} type="password" placeholder={t('common.password')} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <div style={{ color: C.red, fontSize: '0.82rem' }}>{error}</div>}
        {authMode === 'signup' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              style={{ marginTop: '2px', accentColor: BRAND.pink, flexShrink: 0 }}
            />
            <span style={{ color: C.textMid, fontSize: '0.78rem', lineHeight: '1.5' }}>
              {t('join.terms.prefix')}
              <Link to="/terms" target="_blank" style={{ color: BRAND.pink, textDecoration: 'underline' }}>
                {t('join.terms.linkText')}
              </Link>
              {t('join.terms.suffix')}
            </span>
          </label>
        )}
        <button type="submit" disabled={loading || (authMode === 'signup' && !termsAccepted)} style={{
          ...PRIMARY_BTN,
          marginTop: '0.25rem',
          opacity: (authMode === 'signup' && !termsAccepted) ? 0.4 : 1,
          cursor: (loading || (authMode === 'signup' && !termsAccepted)) ? 'not-allowed' : 'pointer',
        }}>
          {loading ? '…' : authMode === 'login' ? t('join.signIn') : t('join.signUp')}
        </button>
        {authMode === 'login' && (
          <button
            type="button"
            onClick={async () => {
              if (!email.trim()) { setError(t('join.enterEmailFirst')); return }
              setError('')
              const { error: rErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
              })
              setError(rErr ? rErr.message : t('join.resetSent'))
            }}
            style={{
              background: 'transparent', border: 'none', color: C.textMid,
              fontSize: '0.78rem', cursor: 'pointer', padding: '0.2rem 0',
              fontFamily: FONT,
            }}
          >
            {t('join.forgotPassword')}
          </button>
        )}
      </form>
      <button onClick={() => navigate('/')} style={{ display: 'block', margin: '1.5rem auto 0', background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: '0.82rem', fontFamily: FONT }}>
        {t('common.back')}
      </button>
    </div>
  )

  if (step === 'role') return wrap(
    <div>
      <button onClick={() => navigate('/')} style={{
        background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer',
        fontSize: '0.82rem', marginBottom: '1rem', padding: 0, fontFamily: FONT,
      }}>
        {t('common.back')}
      </button>
      <div style={eyebrowStyle()}>{t('join.welcome')}</div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.5rem', marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>{t('join.whoAreYou')}</div>
      <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '2rem' }}>{t('join.chooseRole')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button onClick={() => selectRole('promoter')} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
          padding: '1.4rem 1.5rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          fontFamily: FONT,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.background = C.cardHov }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card }}
        >
          <div style={{ fontSize: '0.68rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.4rem' }}>{t('join.role.promoter')}</div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1.05rem', marginBottom: '0.3rem' }}>{t('join.role.promoterTitle')}</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.5 }}>{t('join.role.promoterBody')}</div>
        </button>
        <button onClick={() => selectRole('fan')} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px',
          padding: '1.4rem 1.5rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          fontFamily: FONT,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.purple; e.currentTarget.style.background = C.cardHov }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card }}
        >
          <div style={{ fontSize: '0.68rem', color: BRAND.purple, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '0.4rem' }}>{t('join.role.fan')}</div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1.05rem', marginBottom: '0.3rem' }}>{t('join.role.fanTitle')}</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.5 }}>{t('join.role.fanBody')}</div>
        </button>
      </div>
    </div>
  )

  if (step === 'fan-setup') return wrap(
    <div>
      <button onClick={() => setStep('role')} style={{
        background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer',
        fontSize: '0.82rem', marginBottom: '1rem', padding: 0, fontFamily: FONT,
      }}>
        {t('common.back')}
      </button>
      <div style={eyebrowStyle(BRAND.purple)}>{t('join.fanSetup')}</div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>{t('join.whereShows')}</div>
      <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '2rem' }}>{t('join.surfaceShows')}</div>
      <form onSubmit={handleFanSetup} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <input style={INPUT} type="text" placeholder={t('join.zip')} value={zip} onChange={e => setZip(e.target.value)} required inputMode="numeric" />
        <div>
          <div style={{ color: C.textMid, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', marginBottom: '0.5rem' }}>{t('join.howFar')}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {RADII.map(r => (
              <button key={r} type="button" onClick={() => setRadius(r)} style={{
                flex: 1, padding: '0.65rem 0', borderRadius: '8px',
                border: `1px solid ${radius === r ? BRAND.purple : C.border}`,
                background: radius === r ? 'rgba(181,123,255,0.1)' : 'transparent',
                color: radius === r ? BRAND.purple : C.textMid,
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700',
                fontFamily: FONT,
              }}>
                {r}mi
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading || !zip} style={{
          background: `linear-gradient(135deg, ${BRAND.purple}, #7a4dd8)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.95rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.5rem',
          opacity: !zip ? 0.5 : 1, fontFamily: FONT,
        }}>
          {loading ? '…' : t('join.enterGrail')}
        </button>
      </form>
    </div>
  )

  return null
}
