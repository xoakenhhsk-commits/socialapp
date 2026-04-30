import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import Feed from './Feed';
import { UserPlus, UserCheck, MessageSquare, MapPin, Calendar, Briefcase, Camera } from 'lucide-react';

export default function Profile({ userId, currentUser, dbUser, onProfileClick }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isMyProfile = userId === currentUser.uid;
  const isFriend = dbUser?.friends?.includes(userId);
  const isRequestSent = dbUser?.friendRequestsSent?.includes(userId);
  const isRequestReceived = dbUser?.friendRequestsReceived?.includes(userId);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  const handleFriendAction = async () => {
    if (isMyProfile) return;
    try {
      const otherUserRef = doc(db, 'users', userId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      
      if (isRequestReceived) {
        // Accept request
        await updateDoc(currentUserRef, {
          friends: arrayUnion(userId),
          friendRequestsReceived: arrayRemove(userId)
        });
        await updateDoc(otherUserRef, {
          friends: arrayUnion(currentUser.uid),
          friendRequestsSent: arrayRemove(currentUser.uid)
        });
      } else if (!isFriend && !isRequestSent) {
        // Send request
        await updateDoc(otherUserRef, {
          friendRequestsReceived: arrayUnion(currentUser.uid)
        });
        await updateDoc(currentUserRef, {
          friendRequestsSent: arrayUnion(userId)
        });
      }
    } catch (error) {
      console.error("Error with friend action:", error);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  if (!profileData) {
    return <div className="error-container">Không tìm thấy người dùng.</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header-card glass">
        <div className="profile-cover">
          {profileData.coverURL ? (
            <img src={profileData.coverURL} alt="Cover" className="cover-img" />
          ) : (
            <div className="cover-placeholder"></div>
          )}
          {isMyProfile && (
            <button className="edit-cover-btn glass-btn small-btn">
              <Camera size={16} /> Chỉnh sửa ảnh bìa
            </button>
          )}
        </div>
        
        <div className="profile-info-section">
          <div className="profile-avatar-wrapper">
            <img src={profileData.photoURL} alt={profileData.displayName} className="profile-avatar-large" />
            {isMyProfile && (
              <button className="edit-avatar-btn">
                <Camera size={20} />
              </button>
            )}
          </div>
          
          <div className="profile-name-bio">
            <h1 className="profile-real-name">{profileData.displayName}</h1>
            <p className="profile-bio-text">{profileData.bio || "Chưa có tiểu sử"}</p>
          </div>
          
          <div className="profile-actions">
            {!isMyProfile && (
              <>
                <button 
                  onClick={handleFriendAction} 
                  className={`glass-btn ${isFriend ? 'secondary' : 'primary'}`}
                >
                  {isFriend ? <><UserCheck size={18} /> Bạn bè</> : 
                   isRequestSent ? "Đã gửi lời mời" :
                   isRequestReceived ? "Chấp nhận kết bạn" :
                   <><UserPlus size={18} /> Thêm bạn bè</>}
                </button>
                <button className="glass-btn secondary">
                  <MessageSquare size={18} /> Nhắn tin
                </button>
              </>
            )}
            {isMyProfile && (
              <button className="glass-btn secondary">
                Chỉnh sửa trang cá nhân
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-intro-card glass">
            <h3 className="intro-title">Giới thiệu</h3>
            <div className="intro-item">
              <Briefcase size={20} />
              <span>Làm việc tại <strong>Social App</strong></span>
            </div>
            <div className="intro-item">
              <MapPin size={20} />
              <span>Sống tại <strong>Việt Nam</strong></span>
            </div>
            <div className="intro-item">
              <Calendar size={20} />
              <span>Tham gia tháng 4, 2024</span>
            </div>
          </div>

          <div className="profile-friends-card glass">
            <h3 className="intro-title">Bạn bè</h3>
            <p style={{color: 'rgba(255,255,255,0.6)'}}>{profileData.friends?.length || 0} người bạn</p>
            {/* Friends grid could go here */}
          </div>
        </aside>

        <section className="profile-feed">
          <Feed 
            user={currentUser} 
            dbUser={dbUser} 
            profileUserId={userId} 
            onProfileClick={onProfileClick}
          />
        </section>
      </div>
    </div>
  );
}
