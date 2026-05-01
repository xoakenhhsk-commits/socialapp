import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import Feed from './Feed';
import { UserPlus, UserCheck, MessageSquare, MapPin, Calendar, Briefcase, Camera, Check, X, Loader2 } from 'lucide-react';

export default function Profile({ userId, currentUser, dbUser, onProfileClick }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

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
          const data = docSnap.data();
          setProfileData(data);
          setEditName(data.displayName || '');
          setEditBio(data.bio || '');
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  const uploadImage = async (file) => {
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!apiKey) {
      alert("Lỗi: Thiếu VITE_IMGBB_API_KEY!");
      return null;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      return data.success ? data.data.url : null;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const handleImageChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSaving(true);
    const imageUrl = await uploadImage(file);
    
    if (imageUrl) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const updateData = type === 'avatar' ? { photoURL: imageUrl } : { coverURL: imageUrl };
        await updateDoc(userRef, updateData);
        setProfileData(prev => ({ ...prev, ...updateData }));
      } catch (error) {
        console.error("Error updating image:", error);
      }
    }
    setIsSaving(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName: editName,
        bio: editBio
      });
      setProfileData(prev => ({ ...prev, displayName: editName, bio: editBio }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
    setIsSaving(false);
  };

  const handleFriendAction = async () => {
    if (isMyProfile) return;
    try {
      const otherUserRef = doc(db, 'users', userId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      
      if (isRequestReceived) {
        await updateDoc(currentUserRef, {
          friends: arrayUnion(userId),
          friendRequestsReceived: arrayRemove(userId)
        });
        await updateDoc(otherUserRef, {
          friends: arrayUnion(currentUser.uid),
          friendRequestsSent: arrayRemove(currentUser.uid)
        });
      } else if (!isFriend && !isRequestSent) {
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
            <>
              <input 
                type="file" 
                accept="image/*" 
                hidden 
                ref={coverInputRef} 
                onChange={(e) => handleImageChange(e, 'cover')} 
              />
              <button 
                className="edit-cover-btn glass-btn small-btn"
                onClick={() => coverInputRef.current.click()}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />} Chỉnh sửa ảnh bìa
              </button>
            </>
          )}
        </div>
        
        <div className="profile-info-section">
          <div className="profile-avatar-wrapper">
            <img src={profileData.photoURL} alt={profileData.displayName} className="profile-avatar-large" />
            {isMyProfile && (
              <>
                <input 
                  type="file" 
                  accept="image/*" 
                  hidden 
                  ref={avatarInputRef} 
                  onChange={(e) => handleImageChange(e, 'avatar')} 
                />
                <button 
                  className="edit-avatar-btn"
                  onClick={() => avatarInputRef.current.click()}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Camera size={20} />}
                </button>
              </>
            )}
          </div>
          
          <div className="profile-name-bio">
            {isEditing ? (
              <>
                <input 
                  type="text" 
                  className="edit-name-input" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Họ và tên"
                />
                <textarea 
                  className="edit-bio-textarea" 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Thêm tiểu sử"
                  rows="2"
                />
              </>
            ) : (
              <>
                <h1 className="profile-real-name">{profileData.displayName}</h1>
                <p className="profile-bio-text">{profileData.bio || "Chưa có tiểu sử"}</p>
              </>
            )}
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
              isEditing ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="glass-btn primary" onClick={handleSaveProfile} disabled={isSaving}>
                    <Check size={18} /> Lưu thay đổi
                  </button>
                  <button className="glass-btn secondary" onClick={() => { setIsEditing(false); setEditName(profileData.displayName); setEditBio(profileData.bio); }}>
                    <X size={18} /> Hủy
                  </button>
                </div>
              ) : (
                <button className="glass-btn secondary" onClick={() => setIsEditing(true)}>
                  Chỉnh sửa trang cá nhân
                </button>
              )
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
