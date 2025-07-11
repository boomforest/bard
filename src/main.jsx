import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MapPin, Users, Bell, Send, Settings, Phone, Map } from 'lucide-react'
import './index.css'

function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'artist' or 'fan'
  const [currentView, setCurrentView] = useState('auth'); // 'auth', 'phone', 'location', 'dashboard', 'map', 'compose'
  const [authStep, setAuthStep] = useState('login'); // 'login', 'register'
  
  // Auth state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: ''
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [profileData, setProfileData] = useState({
    displayName: '',
    userType: '',
    artistName: '',
    bio: ''
  });

  // App state
  const [location, setLocation] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [fanLocations, setFanLocations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation && user) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location error:', error)
      );
    }
  }, [user]);

  // GRAIL Login Component
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
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase() })}
            placeholder="Username (ABC123)"
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
            // Simulate login success
            setUser({ email: formData.email, username: formData.username || 'USER123' });
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
  // Profile Setup Component (Artist/Fan choice)
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
        
        <input
          type="text"
          value={profileData.displayName}
          onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
          placeholder="Display Name"
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
          disabled={!profileData.userType || !profileData.displayName}
          style={{
            width: '100%',
            padding: '1rem',
            background: (!profileData.userType || !profileData.displayName) ? '#ccc' : 'linear-gradient(45deg, #d2691e, #cd853f)',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            cursor: (!profileData.userType || !profileData.displayName) ? 'not-allowed' : 'pointer',
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
        <p style={{ color: '#8b4513', margin: '0 0 2rem 0' }}>Artist-Fan Connection</p>

        {authStep === 'phone' && (
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
              onClick={() => setAuthStep('verify')}
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

        {authStep === 'verify' && (
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
              onClick={() => setAuthStep('profile')}
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
              onClick={() => setAuthStep('phone')}
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

        {authStep === 'profile' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setProfileData({...profileData, userType: 'fan'})}
                style={{
                  padding: '1rem',
                  borderRadius: '15px',
                  border: profileData.userType === 'fan' ? '2px solid #d2691e' : '2px solid #e0e0e0',
                  background: profileData.userType === 'fan' ? 'rgba(210, 105, 30, 0.1)' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: profileData.userType === 'fan' ? '#d2691e' : '#8b4513'
                }}
              >
                <Users style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem auto', display: 'block' }} />
                <div style={{ fontWeight: '600' }}>Fan</div>
              </button>
              <button
                onClick={() => setProfileData({...profileData, userType: 'artist'})}
                style={{
                  padding: '1rem',
                  borderRadius: '15px',
                  border: profileData.userType === 'artist' ? '2px solid #d2691e' : '2px solid #e0e0e0',
                  background: profileData.userType === 'artist' ? 'rgba(210, 105, 30, 0.1)' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: profileData.userType === 'artist' ? '#d2691e' : '#8b4513'
                }}
              >
                <MapPin style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem auto', display: 'block' }} />
                <div style={{ fontWeight: '600' }}>Artist</div>
              </button>
            </div>
            
            <input
              type="text"
              value={profileData.displayName}
              onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
              placeholder="Display Name"
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
                setUser({ phone: phoneNumber, ...profileData });
                setUserType(profileData.userType);
                setCurrentView('location');
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
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Phone Setup Component
  const PhoneSetup = () => {
    const [phoneStep, setPhoneStep] = useState('enter'); // 'enter' or 'verify'

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
                // Save location data
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
  const FanDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hey {user.displayName}! 👋</h1>
            <p className="text-sm text-gray-600">Following {followedArtists.length} artists</p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg bg-gray-100 text-gray-600">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Location Status */}
      <div className="px-4 py-3 bg-blue-50 border-b">
        <div className="flex items-center text-blue-700">
          <MapPin className="w-4 h-4 mr-2" />
          <span className="text-sm">
            {location ? `Location: ${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : 'Location not available'}
          </span>
        </div>
      </div>

      {/* Following Artists */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Following</h2>
        
        {followedArtists.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">You're not following any artists yet</p>
            <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Discover Artists
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {followedArtists.map((artist) => (
              <div key={artist.id} className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{artist.name}</h3>
                    <p className="text-sm text-gray-600">{artist.genre}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-purple-600 font-medium">{artist.radius}km radius</div>
                    <button className="text-xs text-gray-500 hover:text-gray-700">Edit</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      <div className="px-4 py-6 border-t bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h2>
        
        {notifications.length === 0 ? (
          <p className="text-gray-600 text-center py-6">No notifications yet</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div key={notif.id} className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded-r-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{notif.title}</p>
                    <p className="text-sm text-gray-700 mt-1">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-2">{notif.distance}km away • {notif.time}</p>
                  </div>
                  {notif.hasLinks && (
                    <button className="text-purple-600 text-sm font-medium">View</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Artist Dashboard
  const ArtistDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{user.artistName || user.displayName}</h1>
            <p className="text-sm text-gray-600">{fanLocations.length} fans following</p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setCurrentView('map')}
              className="p-2 rounded-lg bg-blue-100 text-blue-600"
            >
              <Map className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentView('compose')}
              className="p-2 rounded-lg bg-purple-100 text-purple-600"
            >
              <Send className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg bg-gray-100 text-gray-600">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-purple-600">{fanLocations.length}</div>
            <div className="text-sm text-gray-600">Total Fans</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600">23</div>
            <div className="text-sm text-gray-600">Notifications Sent</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">89%</div>
            <div className="text-sm text-gray-600">Delivery Rate</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <button 
            onClick={() => setCurrentView('compose')}
            className="w-full bg-purple-600 text-white p-4 rounded-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
          >
            <Send className="w-5 h-5 mr-2" />
            Send Notification to Fans
          </button>
          <button 
            onClick={() => setCurrentView('map')}
            className="w-full bg-blue-600 text-white p-4 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <Map className="w-5 h-5 mr-2" />
            View Fan Map
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 py-6 border-t bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">New fan in Los Angeles</p>
              <p className="text-sm text-gray-600">2 hours ago</p>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Notification delivered to 47 fans</p>
              <p className="text-sm text-gray-600">5 hours ago</p>
            </div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Notification Composer
  const NotificationComposer = () => {
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [radius, setRadius] = useState(50);
    const [ticketLink, setTicketLink] = useState('');
    const [merchLink, setMerchLink] = useState('');
    const [meetGreetLink, setMeetGreetLink] = useState('');

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="px-4 py-4 flex items-center">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="mr-4 p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900">Compose Notification</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hey fans! I'm in your area..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share what you're up to, where you are, or what's coming up..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            <div className="text-right text-sm text-gray-500 mt-1">{message.length}/280</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Radius: {radius}km
            </label>
            <input
              type="range"
              min="1"
              max="200"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1km</span>
              <span>200km</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Optional Links</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Link</label>
              <input
                type="url"
                value={ticketLink}
                onChange={(e) => setTicketLink(e.target.value)}
                placeholder="https://tickets.example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Merch Link</label>
              <input
                type="url"
                value={merchLink}
                onChange={(e) => setMerchLink(e.target.value)}
                placeholder="https://merch.example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Meet & Greet Link</label>
              <input
                type="url"
                value={meetGreetLink}
                onChange={(e) => setMeetGreetLink(e.target.value)}
                placeholder="https://meetandgreet.example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700">
              This notification will be sent to fans within {radius}km of your current location.
              Estimated reach: <strong>23 fans</strong>
            </p>
          </div>

          <button
            onClick={() => {
              // Handle send notification
              setCurrentView('dashboard');
            }}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Send Notification
          </button>
        </div>
      </div>
    );
  };

  // Fan Map View
  const FanMapView = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="mr-4 p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-gray-900">Fan Map</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="bg-gray-200 h-96 rounded-lg flex items-center justify-center mb-6">
          <div className="text-center">
            <Map className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Interactive map will be integrated here</p>
            <p className="text-sm text-gray-500">Red pins show fan locations by city</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Fan Locations</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Los Angeles</p>
                  <p className="text-sm text-gray-600">California, USA</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">12</div>
                  <div className="text-xs text-gray-500">fans</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New York</p>
                  <p className="text-sm text-gray-600">New York, USA</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">8</div>
                  <div className="text-xs text-gray-500">fans</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Chicago</p>
                  <p className="text-sm text-gray-600">Illinois, USA</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">5</div>
                  <div className="text-xs text-gray-500">fans</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Austin</p>
                  <p className="text-sm text-gray-600">Texas, USA</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">3</div>
                  <div className="text-xs text-gray-500">fans</div>
                </div>
              </div>
            </div>
          </div>
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

  if (currentView === 'compose' && userType === 'artist') {
    return <NotificationComposer />;
  }

  if (currentView === 'map' && userType === 'artist') {
    return <FanMapView />;
  }

  if (userType === 'artist') {
    return <ArtistDashboard />;
  }

  return <FanDashboard />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
