import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MapPin, Users, Bell, Send, Settings, Phone, Map } from 'lucide-react'
import './index.css'

function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'artist' or 'fan'
  const [currentView, setCurrentView] = useState('auth'); // 'auth', 'dashboard', 'map', 'compose'
  const [authStep, setAuthStep] = useState('phone'); // 'phone', 'verify', 'profile'
  
  // Auth state
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

  // Phone Authentication Component
  const PhoneAuth = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">FKA BARD</h1>
          <p className="text-purple-200">Connect artists with their fans</p>
        </div>

        {authStep === 'phone' && (
          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>
            <button
              onClick={() => setAuthStep('verify')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              Send Verification Code
            </button>
          </div>
        )}

        {authStep === 'verify' && (
          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 text-center text-2xl tracking-widest"
                maxLength={6}
              />
            </div>
            <button
              onClick={() => setAuthStep('profile')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              Verify Code
            </button>
            <button
              onClick={() => setAuthStep('phone')}
              className="w-full text-purple-300 text-sm hover:text-white transition-colors"
            >
              ← Back to phone number
            </button>
          </div>
        )}

        {authStep === 'profile' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setProfileData({...profileData, userType: 'fan'})}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  profileData.userType === 'fan' 
                    ? 'border-purple-400 bg-purple-500/20 text-white' 
                    : 'border-white/30 text-purple-300 hover:border-purple-400'
                }`}
              >
                <Users className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold">Fan</div>
              </button>
              <button
                onClick={() => setProfileData({...profileData, userType: 'artist'})}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  profileData.userType === 'artist' 
                    ? 'border-purple-400 bg-purple-500/20 text-white' 
                    : 'border-white/30 text-purple-300 hover:border-purple-400'
                }`}
              >
                <MapPin className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold">Artist</div>
              </button>
            </div>
            
            <input
              type="text"
              value={profileData.displayName}
              onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
              placeholder="Display Name"
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
            />

            {profileData.userType === 'artist' && (
              <input
                type="text"
                value={profileData.artistName}
                onChange={(e) => setProfileData({...profileData, artistName: e.target.value})}
                placeholder="Artist/Band Name"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
              />
            )}

            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
              placeholder="Tell us about yourself..."
              rows={3}
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 resize-none"
            />

            <button
              onClick={() => {
                setUser({ phone: phoneNumber, ...profileData });
                setUserType(profileData.userType);
                setCurrentView('dashboard');
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              Complete Setup
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Fan Dashboard
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
    return <PhoneAuth />;
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
