import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Settings from './components/Settings';
import FindFriends from './components/FindFriends';
import { Home, Users, Settings as SettingsIcon, LogOut } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [targetProfileId, setTargetProfileId] = useState(null);

  const navigateToProfile = (uid) => {
    setTargetProfileId(uid);
    setActiveTab('profile');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    let unsubscribeDbUser = null;

    // Timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("Kết nối quá chậm. Vui lòng kiểm tra mạng hoặc cấu hình Firebase.");
      }
    }, 10000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          unsubscribeDbUser = onSnapshot(userRef, (userSnap) => {
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
              setDoc(userRef, newDbUser).catch(err => {
                console.error("Error creating user:", err);
                setError("Không thể tạo profile người dùng.");
              });
              setDbUser(newDbUser);
            } else {
              setDbUser(userSnap.data());
            }
            clearTimeout(loadingTimeout);
            setLoading(false);
          }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError("Lỗi đồng bộ dữ liệu: " + err.message);
            setLoading(false);
          });
        } catch (error) {
          console.error("Auth process error:", error);
          setError("Lỗi đăng nhập: " + error.message);
          setLoading(false);
        }
      } else {
        if (unsubscribeDbUser) unsubscribeDbUser();
        setDbUser(null);
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDbUser) unsubscribeDbUser();
      clearTimeout(loadingTimeout);
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="glass-card loading-card">
          <div className="spinner-orbit">
            <div className="orbit-dot"></div>
          </div>
          <h2>Social App</h2>
          <p>Đang chuẩn bị không gian cho bạn...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="loading-screen">
        <div className="glass-card error-card">
          <h2>Oops! Đã có lỗi</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="glass-btn primary">Thử lại</button>
        </div>
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
            <h1 className="nav-logo" onClick={() => { setActiveTab('home'); setTargetProfileId(null); }} style={{cursor: 'pointer'}}>SocialApp</h1>
            
            <div className="nav-links">
              <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setTargetProfileId(null); }}>
                <Home size={20} />
              </button>
              <button className={`nav-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => { setActiveTab('friends'); setTargetProfileId(null); }} style={{position: 'relative'}}>
                <Users size={20} />
                {pendingRequestsCount > 0 && (
                  <span className="notification-badge">{pendingRequestsCount}</span>
                )}
              </button>
              <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setTargetProfileId(null); }}>
                <SettingsIcon size={20} />
              </button>
            </div>

            <div className="user-profile">
              <span className="user-name" style={{fontWeight: 600, cursor: 'pointer'}} onClick={() => navigateToProfile(user.uid)}>
                {user.displayName}
              </span>
              <img src={user.photoURL} alt="Profile" className="avatar" style={{cursor: 'pointer'}} onClick={() => navigateToProfile(user.uid)}/>
              <button onClick={() => signOut(auth)} className="glass-btn secondary small-btn">
                <LogOut size={16} />
              </button>
            </div>
          </nav>
          
          <main className="main-content">
            {activeTab === 'home' && <Feed user={user} dbUser={dbUser} onProfileClick={navigateToProfile} />}
            {activeTab === 'profile' && (
              <Profile 
                userId={targetProfileId || user.uid} 
                currentUser={user} 
                dbUser={dbUser} 
                onProfileClick={navigateToProfile}
              />
            )}
            {activeTab === 'friends' && <FindFriends user={user} dbUser={dbUser} onProfileClick={navigateToProfile} />}
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
