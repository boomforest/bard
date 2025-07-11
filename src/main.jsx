import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { MapPin, Users, Bell, Send, Settings, Phone, Map } from 'lucide-react'
import './index.css'

function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [currentView, setCurrentView] = useState('auth');
  const [authStep, setAuthStep] = useState('login');
  
  // Use refs for form inputs to avoid re-render issues
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const usernameRef = useRef(null);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [profileData, setProfileData] = useState({
    displayName: '',
    userType: '',
    artistName: '',
    bio: ''
  });

  const [location, setLocation] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [fanLocations, setFanLocations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // GRAIL Login Component - Using refs to avoid re-render issues
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
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          margin: '0 0 0.5rem 0',
          color: '#d2691e'
        }}>
          FKA BARD
        </h1>
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0' }}>Artist-Fan Connection via GRAIL</p>

        <div style={{ display: 'flex', marginBottom: '1.5rem', borderRadius: '20px', overflow: 'hidden' }}>
          <button
            onClick={() => setAuthStep('login')}
            style={{
              flex: 1,
              padding: '1rem',
              backgroundColor: authStep === 'login' ? '#d2691e' : '#f0f0f0',
              color: authStep === 'login' ? 'white' : '#8b4513',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Login
          </button>
          <button
            onClick={() => setAuthStep('register')}
            style={{
              flex: 1,
              padding: '1rem',
              backgroundColor: authStep === 'register' ? '#d2691e' : '#f0f0f0',
              color: authStep === 'register' ? 'white' : '#8b4513',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Register
          </button>
        </div>

        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '15px',
            marginBottom: '1rem',
            backgroundColor: message.includes('successful') ? '#d4edda' : 
                           message.includes('failed') ? '#f8d7da' : '#fff3cd',
            color: message.includes('successful') ? '#155724' : 
                   message.includes('failed') ? '#721c24' : '#856404',
            fontSize: '0.9rem'
          }}>
            {message}
          </div>
        )}

        <input
          ref={emailRef}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Email"
          style={{
            width: '100%',
            padding: '1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '15px',
            marginBottom: '1rem',
            boxSizing: 'border-box',
            fontSize: '1rem',
            outline: 'none'
          }}
        />

        <input
          ref={passwordRef}
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          style={{
            width: '100%',
            padding: '1rem',
            border: '2px solid #e0e0e0',
            borderRadius: '15px',
            marginBottom: '1rem',
            boxSizing: 'border-box',
            fontSize: '1rem',
            outline: 'none'
          }}
        />

        {authStep === 'register' && (
          <input
            ref={usernameRef}
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Username (JPR333)"
            maxLength={6}
            style={{
              width: '100%',
              padding: '1rem',
              border: '2px solid #e0e0e0',
              borderRadius: '15px',
              marginBottom: '1rem',
              boxSizing: 'border-box',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        )}

        <button 
          onClick={() => {
            const email = emailRef.current?.value || '';
            const password = passwordRef.current?.value || '';
            const username = usernameRef.current?.value || '';
            
            const displayUsername = username || email.split('@')[0].toUpperCase();
            setUser({ email: email, username: displayUsername });
            setMessage('Login successful! Now let\'s set up BARD...');
            setTimeout(() => setCurrentView('profile'), 1000);
          }}
          disabled={loading}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'linear-gradient(45deg, #d2691e, #cd853f)',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            opacity: loading ? 0.5 : 1,
            boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
          }}
        >
          {loading ? 'Loading...' : (authStep === 'login' ? 'Login to GRAIL' : 'Register GRAIL Account')}
        </button>
      </div>
    </div>
  );

  // Profile Setup Component
  const ProfileSetup = () => (
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
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          margin: '0 0 0.5rem 0',
          color: '#d2691e'
        }}>
          Welcome to BARD!
        </h1>
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>
          Hi {user?.username}! Are you an artist or fan?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setProfileData({...profileData, userType: 'fan'})}
            style={{
              padding: '1.5rem',
              borderRadius: '15px',
              border: profileData.userType === 'fan' ? '2px solid #d2691e' : '2px solid #e0e0e0',
              background: profileData.userType === 'fan' ? 'rgba(210, 105, 30, 0.1)' : 'white',
              cursor: 'pointer',
              textAlign: 'center',
              color: profileData.userType === 'fan' ? '#d2691e' : '#8b4513'
            }}
          >
            <Users style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 0.5rem auto', display: 'block' }} />
            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>Fan</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Follow artists</div>
          </button>
          <button
            onClick={() => setProfileData({...profileData, userType: 'artist'})}
            style={{
              padding: '1.5rem',
              borderRadius: '15px',
              border: profileData.userType === 'artist' ? '2px solid #d2691e' : '2px solid #e0e0e0',
              background: profileData.userType === 'artist' ? 'rgba(210, 105, 30, 0.1)' : 'white',
              cursor: 'pointer',
              textAlign: 'center',
              color: profileData.userType === 'artist' ? '#d2691e' : '#8b4513'
            }}
          >
            <MapPin style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 0.5rem auto', display: 'block' }} />
            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>Artist</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Notify fans</div>
          </button>
        </div>
        
        {profileData.userType === 'artist' && (
          <input
            type="text"
            value={profileData.artistName}
            onChange={(e) => setProfileData({...profileData, artistName: e.target.value})}
            placeholder="Artist/Band Name"
            style={{
              width: '100%',
              padding: '1rem',
              border: '2px solid #e0e0e0',
              borderRadius: '15px',
              marginBottom: '1rem',
              boxSizing: 'border-box',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        )}

        <button
          onClick={() => {
            setUserType(profileData.userType);
            setCurrentView('phone');
          }}
          disabled={!profileData.userType}
          style={{
            width: '100%',
            padding: '1rem',
            background: !profileData.userType ? '#ccc' : 'linear-gradient(45deg, #d2691e, #cd853f)',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            cursor: !profileData.userType ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
          }}
        >
          Continue to Phone Setup
        </button>
      </div>
    </div>
  );

  // Phone Setup Component
  const PhoneSetup = () => {
    const [phoneStep, setPhoneStep] = useState('enter');

    return (
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
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0',
            color: '#d2691e'
          }}>
            Phone Verification
          </h1>
          <p style={{ color: '#8b4513', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>
            We need your phone for push notifications
          </p>

          {phoneStep === 'enter' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone Number"
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '15px',
                  marginBottom: '1rem',
                  boxSizing: 'border-box',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <button 
                onClick={() => setPhoneStep('verify')}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
                }}
              >
                Send Verification Code
              </button>
            </div>
          )}

          {phoneStep === 'verify' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '15px',
                  marginBottom: '1rem',
                  boxSizing: 'border-box',
                  fontSize: '1.2rem',
                  textAlign: 'center',
                  outline: 'none',
                  letterSpacing: '0.2em'
                }}
              />
              <button 
                onClick={() => setCurrentView('location')}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
                }}
              >
                Verify Code
              </button>
              <button
                onClick={() => setPhoneStep('enter')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#8b4513',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ← Back to phone number
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Location Setup Component
  const LocationSetup = () => {
    const [zipCode, setZipCode] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');

    return (
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
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0',
            color: '#d2691e'
          }}>
            Set Your Location
          </h1>
          <p style={{ color: '#8b4513', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>
            Help artists find fans in your area
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="Zip Code"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '15px',
                marginBottom: '1rem',
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none'
              }}
            />

            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '15px',
                marginBottom: '1rem',
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none'
              }}
            />

            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '15px',
                marginBottom: '1rem',
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none'
              }}
            />

            <div style={{
              backgroundColor: '#f0f8ff',
              padding: '1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              border: '1px solid #e0e6ed'
            }}>
              <p style={{
                margin: '0',
                fontSize: '0.8rem',
                color: '#4a5568',
                lineHeight: '1.4'
              }}>
                🔒 We don't collect or sell your information. We need your phone because BARD only works with push notifications. You will only ever receive notifications from artists you follow.
              </p>
            </div>

            <button
              onClick={() => {
                setUser({...user, zipCode, city, state});
                setCurrentView('dashboard');
              }}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                boxShadow: '0 4px 15px rgba(210, 105, 30, 0.3)'
              }}
            >
              Continue to BARD
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Simple Dashboard
  const Dashboard = () => (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#d2691e', fontSize: '3rem', marginBottom: '1rem' }}>
          Welcome to BARD! 🎵
        </h1>
        <p style={{ color: '#8b4513', fontSize: '1.2rem' }}>
          {userType === 'artist' ? 'Start connecting with your fans!' : 'Start following your favorite artists!'}
        </p>
        <div style={{ marginTop: '2rem' }}>
          <p style={{ color: '#8b4513' }}>Phone: {phoneNumber}</p>
          <p style={{ color: '#8b4513' }}>Location: {user?.city}, {user?.state} {user?.zipCode}</p>
          <p style={{ color: '#8b4513' }}>User Type: {userType}</p>
        </div>
      </div>
    </div>
  );

  // Main render logic
  if (!user || currentView === 'auth') {
    return <GrailAuth />;
  }

  if (currentView === 'profile') {
    return <ProfileSetup />;
  }

  if (currentView === 'phone') {
    return <PhoneSetup />;
  }

  if (currentView === 'location') {
    return <LocationSetup />;
  }

  return <Dashboard />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
