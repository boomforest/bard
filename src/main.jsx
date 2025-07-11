import React, { useState, useRef } from 'react'
import { MapPin, Users, Bell, Send, Settings, Map } from 'lucide-react'

function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [currentView, setCurrentView] = useState('auth');
  const [authStep, setAuthStep] = useState('login');
  
  // Use refs for all form inputs throughout the app
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const usernameRef = useRef(null);
  const artistNameRef = useRef(null);
  const zipRef = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  
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
            ref={artistNameRef}
            type="text"
            name="artistName"
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
            const artistName = artistNameRef.current?.value || '';
            setProfileData({...profileData, artistName});
            setUserType(profileData.userType);
            setCurrentView('location');
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
          Continue to Location
        </button>
      </div>
    </div>
  );

  // Location Setup Component
  const LocationSetup = () => {
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
              ref={zipRef}
              type="text"
              name="zip"
              autoComplete="postal-code"
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
              ref={cityRef}
              type="text"
              name="city"
              autoComplete="address-level2"
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
              ref={stateRef}
              type="text"
              name="state"
              autoComplete="address-level1"
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
                🔒 We don't collect or sell your information. Location helps artists connect with local fans and plan tour stops.
              </p>
            </div>

            <button
              onClick={() => {
                const zipCode = zipRef.current?.value || '';
                const city = cityRef.current?.value || '';
                const state = stateRef.current?.value || '';
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
              Enter BARD
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Dashboard Component - This is where you can wireframe new features
  const Dashboard = () => (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5dc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#d2691e', fontSize: '1.5rem', margin: 0 }}>
          FKA BARD
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Bell style={{ width: '1.5rem', height: '1.5rem', color: '#8b4513', cursor: 'pointer' }} />
          <Settings style={{ width: '1.5rem', height: '1.5rem', color: '#8b4513', cursor: 'pointer' }} />
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ color: '#d2691e', fontSize: '2rem', marginBottom: '1rem' }}>
            Welcome to BARD! 🎵
          </h2>
          <p style={{ color: '#8b4513', fontSize: '1.1rem' }}>
            {userType === 'artist' ? 'Connect with your fans and notify them about shows!' : 'Follow your favorite artists and get notified about local shows!'}
          </p>
        </div>

        {/* Feature Cards - Perfect for wireframing */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {userType === 'artist' ? (
            <>
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '15px',
                padding: '2rem',
                textAlign: 'center',
                border: '2px solid #e0e0e0'
              }}>
                <MapPin style={{ width: '3rem', height: '3rem', color: '#d2691e', margin: '0 auto 1rem auto', display: 'block' }} />
                <h3 style={{ color: '#d2691e', marginBottom: '1rem' }}>Show Locations</h3>
                <p style={{ color: '#8b4513', marginBottom: '1.5rem' }}>Find where your fans are and plan tour stops</p>
                <button style={{
                  padding: '0.8rem 1.5rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}>
                  View Fan Map
                </button>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '15px',
                padding: '2rem',
                textAlign: 'center',
                border: '2px solid #e0e0e0'
              }}>
                <Send style={{ width: '3rem', height: '3rem', color: '#d2691e', margin: '0 auto 1rem auto', display: 'block' }} />
                <h3 style={{ color: '#d2691e', marginBottom: '1rem' }}>Notify Fans</h3>
                <p style={{ color: '#8b4513', marginBottom: '1.5rem' }}>Send push notifications about shows and updates</p>
                <button style={{
                  padding: '0.8rem 1.5rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}>
                  Send Notification
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '15px',
                padding: '2rem',
                textAlign: 'center',
                border: '2px solid #e0e0e0'
              }}>
                <Users style={{ width: '3rem', height: '3rem', color: '#d2691e', margin: '0 auto 1rem auto', display: 'block' }} />
                <h3 style={{ color: '#d2691e', marginBottom: '1rem' }}>Follow Artists</h3>
                <p style={{ color: '#8b4513', marginBottom: '1.5rem' }}>Discover and follow your favorite artists</p>
                <button style={{
                  padding: '0.8rem 1.5rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}>
                  Browse Artists
                </button>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '15px',
                padding: '2rem',
                textAlign: 'center',
                border: '2px solid #e0e0e0'
              }}>
                <Bell style={{ width: '3rem', height: '3rem', color: '#d2691e', margin: '0 auto 1rem auto', display: 'block' }} />
                <h3 style={{ color: '#d2691e', marginBottom: '1rem' }}>Local Shows</h3>
                <p style={{ color: '#8b4513', marginBottom: '1.5rem' }}>Get notified about shows in your area</p>
                <button style={{
                  padding: '0.8rem 1.5rem',
                  background: 'linear-gradient(45deg, #d2691e, #cd853f)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}>
                  View Upcoming Shows
                </button>
              </div>
            </>
          )}
        </div>

        {/* User Info Section */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '15px',
          maxWidth: '600px',
          margin: '3rem auto 0 auto'
        }}>
          <h3 style={{ color: '#d2691e', marginBottom: '1rem' }}>Your Profile</h3>
          <p style={{ color: '#8b4513', margin: '0.5rem 0' }}>Type: {userType === 'artist' ? `Artist (${profileData.artistName || 'No name set'})` : 'Fan'}</p>
          <p style={{ color: '#8b4513', margin: '0.5rem 0' }}>Location: {user?.city}, {user?.state} {user?.zipCode}</p>
          <p style={{ color: '#8b4513', margin: '0.5rem 0' }}>Email: {user?.email}</p>
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

  if (currentView === 'location') {
    return <LocationSetup />;
  }

  return <Dashboard />;
}
