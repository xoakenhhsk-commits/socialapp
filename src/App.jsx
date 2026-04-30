import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import Feed from './components/Feed';
import Settings from './components/Settings';
import FindFriends from './components/FindFriends';
import { Home, Users, Settings as SettingsIcon, LogOut } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    let unsubscribeDbUser = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Setup real-time listener for the user document
          unsubscribeDbUser = onSnapshot(userRef, async (userSnap) => {
            if (!userSnap.exists()) {
              const newDbUser = {
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                email: currentUser.email,
                friends: [],
                friendRequestsReceived: [],
                friendRequestsSent: []
              };
              await setDoc(userRef, newDbUser);
              setDbUser(newDbUser);
            } else {
              setDbUser(userSnap.data());
            }
            setLoading(false);
          });
        } catch (error) {
          console.error("Error fetching/syncing user data from Firestore:", error);
          alert("Lỗi kết nối database: " + error.message);
          setLoading(false);
        }
      } else {
        if (unsubscribeDbUser) unsubscribeDbUser();
        setDbUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDbUser) unsubscribeDbUser();
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading Social App...</p>
      </div>
    );
  }

  // Calculate pending requests for badge
  const pendingRequestsCount = dbUser?.friendRequestsReceived?.length || 0;

  return (
    <div className="app-container">
      {user && dbUser ? (
        <>
          <nav className="nav-bar glass">
            <h1 className="nav-logo" onClick={() => setActiveTab('home')} style={{cursor: 'pointer'}}>SocialApp</h1>
            
            <div className="nav-links">
              <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                <Home size={20} />
              </button>
              <button className={`nav-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')} style={{position: 'relative'}}>
                <Users size={20} />
                {pendingRequestsCount > 0 && (
                  <span className="notification-badge">{pendingRequestsCount}</span>
                )}
              </button>
              <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                <SettingsIcon size={20} />
              </button>
            </div>

            <div className="user-profile">
              <span className="user-name" style={{fontWeight: 600, cursor: 'pointer'}} onClick={() => setActiveTab('profile')}>
                {user.displayName}
              </span>
              <img src={user.photoURL} alt="Profile" className="avatar" style={{cursor: 'pointer'}} onClick={() => setActiveTab('profile')}/>
              <button onClick={() => signOut(auth)} className="glass-btn secondary small-btn">
                <LogOut size={16} />
              </button>
            </div>
          </nav>
          
          <main className="main-content">
            {activeTab === 'home' && <Feed user={user} dbUser={dbUser} />}
            {activeTab === 'profile' && <Feed user={user} dbUser={dbUser} profileUserId={user.uid} />}
            {activeTab === 'friends' && <FindFriends user={user} dbUser={dbUser} />}
            {activeTab === 'settings' && <Settings user={user} dbUser={dbUser} />}
          </main>
        </>
      ) : (
        <Login />
      )}
    </div>
  );
}

export default App;
