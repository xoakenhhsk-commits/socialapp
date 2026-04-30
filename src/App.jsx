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
        <div className="layout-wrapper">
          {/* Desktop Left Sidebar Navigation */}
          <aside className="sidebar left-sidebar desktop-only">
            <div className="sidebar-header">
              <h1 className="nav-logo" onClick={() => { setActiveTab('home'); setTargetProfileId(null); }}>SocialApp</h1>
            </div>
            <nav className="sidebar-nav">
              <button className={`side-nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setTargetProfileId(null); }}>
                <Home size={22} /> <span>Trang chủ</span>
              </button>
              <button className={`side-nav-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => { setActiveTab('friends'); setTargetProfileId(null); }}>
                <Users size={22} /> <span>Bạn bè</span>
                {pendingRequestsCount > 0 && <span className="side-badge">{pendingRequestsCount}</span>}
              </button>
              <button className={`side-nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => navigateToProfile(user.uid)}>
                <img src={user.photoURL} alt="" className="avatar-mini" /> <span>Trang cá nhân</span>
              </button>
              <button className={`side-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setTargetProfileId(null); }}>
                <SettingsIcon size={22} /> <span>Cài đặt</span>
              </button>
            </nav>
            <div className="sidebar-footer">
              <button onClick={() => signOut(auth)} className="logout-side-btn">
                <LogOut size={18} /> Đăng xuất
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="main-feed">
            {/* Mobile Header */}
            <header className="mobile-header mobile-only glass">
              <h1 className="nav-logo">SocialApp</h1>
              <div className="mobile-header-actions">
                <img src={user.photoURL} alt="" className="avatar-small" onClick={() => navigateToProfile(user.uid)} />
              </div>
            </header>

            <div className="feed-content">
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
            </div>
          </main>

          {/* Desktop Right Sidebar (Widgets) */}
          <aside className="sidebar right-sidebar desktop-only">
            <div className="widget-card glass">
              <h3>Gợi ý kết bạn</h3>
              {/* This could be a simplified version of FindFriends or just some user cards */}
              <p className="hint-text">Đang tìm kiếm những người bạn mới cho bạn...</p>
            </div>
            <div className="widget-card glass">
              <h3>Hoạt động gần đây</h3>
              <div className="empty-widget">Không có hoạt động mới</div>
            </div>
          </aside>

          {/* Mobile Bottom Navigation */}
          <nav className="mobile-nav mobile-only glass">
            <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setTargetProfileId(null); }}>
              <Home size={24} />
            </button>
            <button className={`nav-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => { setActiveTab('friends'); setTargetProfileId(null); }}>
              <Users size={24} />
              {pendingRequestsCount > 0 && <span className="notification-badge">{pendingRequestsCount}</span>}
            </button>
            <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => navigateToProfile(user.uid)}>
              <img src={user.photoURL} alt="" className="nav-avatar" />
            </button>
            <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setTargetProfileId(null); }}>
              <SettingsIcon size={24} />
            </button>
          </nav>
        </div>
      ) : (
        <Login />
      )}
    </div>
  );
}

export default App;
