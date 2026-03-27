import React, { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'

function AuthApp() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [currentView, setCurrentView] = useState('auth');
  const [authStep, setAuthStep] = useState('login');

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const usernameRef = useRef(null);
  const artistNameRef = useRef(null);
  const zipRef = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  const phoneRef = useRef(null);
  const radiusRef = useRef(null);

  const [profileData, setProfileData] = useState({
    displayName: '',
    userType: '',
    artistName: '',
    bio: ''
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-login for dev testing — bypass auth entirely
    if (import.meta.env.DEV) {
      setUser({ id: 'dev', email: 'dev@test.com', username: 'DEV', user_type: 'fan', city: 'Condesa', state: 'CDMX' });
      setUserType('fan');
      setCurrentView('dashboard');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setCurrentView('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setUser(data);
      setUserType(data.user_type);
      setCurrentView('dashboard');
    } else {
      setCurrentView('profile');
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    const email = emailRef.current?.value || '';
    const password = passwordRef.current?.value || '';

    try {
      if (authStep === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Login successful!');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for verification link!');
      }
    } catch (error) {
      setMessage(`Auth failed: ${error.message}`);
    }
    setLoading(false);
  };

  const handleProfileSetup = async () => {
    const artistName = artistNameRef.current?.value || '';
    const session = await supabase.auth.getSession();

    if (session.data.session) {
      const { error } = await supabase.from('users').insert({
        id: session.data.session.user.id,
        email: session.data.session.user.email,
        username: session.data.session.user.email.split('@')[0].toUpperCase(),
        user_type: profileData.userType,
        artist_name: artistName
      });

      if (!error) {
        setUserType(profileData.userType);
        setCurrentView('location');
      } else {
        setMessage(`Profile setup failed: ${error.message}`);
      }
    }
  };

  const handleLocationSetup = async () => {
    const zipCode = zipRef.current?.value || '';
    const city = cityRef.current?.value || '';
    const state = stateRef.current?.value || '';
    const phone = phoneRef.current?.value || '';
    const radius = radiusRef.current?.value || '25';

    const session = await supabase.auth.getSession();

    if (session.data.session) {
      const { error } = await supabase.from('users').update({
        zip_code: zipCode,
        city: city,
        state: state,
        phone: phone,
        radius_miles: parseInt(radius)
      }).eq('id', session.data.session.user.id);

      if (!error) {
        loadUserProfile(session.data.session.user.id);
      } else {
        setMessage(`Location setup failed: ${error.message}`);
      }
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '15px',
    marginBottom: '1rem',
    boxSizing: 'border-box',
    fontSize: '1rem',
    outline: 'none'
  };

  const GrailAuth = () => (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '25px',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#d2691e' }}>
          FKA BARD
        </h1>
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0' }}>Artist-Fan Connection via GRAIL</p>

        <div style={{ display: 'flex', marginBottom: '1.5rem', borderRadius: '20px', overflow: 'hidden' }}>
          <button onClick={() => setAuthStep('login')} style={{
            flex: 1, padding: '1rem',
            backgroundColor: authStep === 'login' ? '#d2691e' : '#f0f0f0',
            color: authStep === 'login' ? 'white' : '#8b4513',
            border: 'none', cursor: 'pointer', fontWeight: '500'
          }}>Login</button>
          <button onClick={() => setAuthStep('register')} style={{
            flex: 1, padding: '1rem',
            backgroundColor: authStep === 'register' ? '#d2691e' : '#f0f0f0',
            color: authStep === 'register' ? 'white' : '#8b4513',
            border: 'none', cursor: 'pointer', fontWeight: '500'
          }}>Register</button>
        </div>

        {message && (
          <div style={{
            padding: '1rem', borderRadius: '15px', marginBottom: '1rem',
            backgroundColor: message.includes('successful') ? '#d4edda' :
              message.includes('failed') ? '#f8d7da' : '#fff3cd',
            color: message.includes('successful') ? '#155724' :
              message.includes('failed') ? '#721c24' : '#856404',
            fontSize: '0.9rem'
          }}>{message}</div>
        )}

        <input ref={emailRef} type="email" name="email" autoComplete="email" placeholder="Email" style={inputStyle} />
        <input ref={passwordRef} type="password" name="password" autoComplete="current-password" placeholder="Password" style={inputStyle} />

        <button onClick={handleAuth} disabled={loading} style={{
          width: '100%', padding: '1rem',
          background: 'linear-gradient(45deg, #d2691e, #cd853f)',
          color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer',
          fontWeight: '600', fontSize: '1rem', opacity: loading ? 0.5 : 1,
          boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
        }}>
          {loading ? 'Loading...' : (authStep === 'login' ? 'Login to GRAIL' : 'Register GRAIL Account')}
        </button>
      </div>
    </div>
  );

  const ProfileSetup = () => (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', borderRadius: '25px', padding: '2rem',
        width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#d2691e' }}>
          Welcome to BARD!
        </h1>
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>Are you an artist or fan?</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          {['fan', 'artist'].map(type => (
            <button key={type} onClick={() => setProfileData({ ...profileData, userType: type })} style={{
              padding: '1.5rem', borderRadius: '15px',
              border: profileData.userType === type ? '2px solid #d2691e' : '2px solid #e0e0e0',
              background: profileData.userType === type ? 'rgba(210,105,30,0.1)' : 'white',
              cursor: 'pointer', textAlign: 'center',
              color: profileData.userType === type ? '#d2691e' : '#8b4513'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{type === 'fan' ? '👥' : '🎵'}</div>
              <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{type === 'fan' ? 'Fan' : 'Artist'}</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{type === 'fan' ? 'Follow artists' : 'Notify fans'}</div>
            </button>
          ))}
        </div>

        {profileData.userType === 'artist' && (
          <input ref={artistNameRef} type="text" name="artistName" placeholder="Artist/Band Name" style={inputStyle} />
        )}

        <button onClick={handleProfileSetup} disabled={!profileData.userType} style={{
          width: '100%', padding: '1rem',
          background: !profileData.userType ? '#ccc' : 'linear-gradient(45deg, #d2691e, #cd853f)',
          color: 'white', border: 'none', borderRadius: '15px',
          cursor: !profileData.userType ? 'not-allowed' : 'pointer',
          fontWeight: '600', fontSize: '1rem', boxShadow: '0 4px 15px rgba(210,105,30,0.3)'
        }}>Continue to Location</button>
      </div>
    </div>
  );

  const LocationSetup = () => (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', borderRadius: '25px', padding: '2rem',
        width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#d2691e' }}>
          Set Your Location
        </h1>
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>Help artists find fans in your area</p>

        <input ref={zipRef} type="text" name="zip" autoComplete="postal-code" placeholder="Zip Code" style={inputStyle} />
        <input ref={cityRef} type="text" name="city" autoComplete="address-level2" placeholder="City" style={inputStyle} />
        <input ref={stateRef} type="text" name="state" autoComplete="address-level1" placeholder="State" style={inputStyle} />
        <input ref={phoneRef} type="tel" name="phone" autoComplete="tel" placeholder="Phone Number (for show alerts)" style={inputStyle} />

        {userType === 'fan' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#8b4513' }}>How far will you travel for shows?</label>
            <select ref={radiusRef} style={{ width: '100%', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '15px', fontSize: '1rem', outline: 'none' }}>
              <option value="10">10 miles</option>
              <option value="25" defaultValue>25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
            </select>
          </div>
        )}

        <button onClick={handleLocationSetup} style={{
          width: '100%', padding: '1rem',
          background: 'linear-gradient(45deg, #d2691e, #cd853f)',
          color: 'white', border: 'none', borderRadius: '15px',
          cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
          boxShadow: '0 4px 15px rgba(210,105,30,0.3)'
        }}>Enter BARD</button>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#d2691e', fontSize: '3rem', marginBottom: '1rem' }}>Welcome to BARD!</h1>
        <p style={{ color: '#8b4513', fontSize: '1.2rem' }}>
          {userType === 'artist' ? 'Connect with your fans!' : 'Follow your favorite artists!'}
        </p>
        <div style={{ marginTop: '2rem' }}>
          <p style={{ color: '#8b4513' }}>Type: {userType}</p>
          <p style={{ color: '#8b4513' }}>Location: {user?.city}, {user?.state} {user?.zip_code}</p>
          <p style={{ color: '#8b4513' }}>User: {user?.username}</p>
        </div>
      </div>
    </div>
  );

  if (!user || currentView === 'auth') return <GrailAuth />;
  if (currentView === 'profile') return <ProfileSetup />;
  if (currentView === 'location') return <LocationSetup />;
  return <Dashboard />;
}

export default AuthApp;
