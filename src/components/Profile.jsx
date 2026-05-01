import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import Feed from './Feed';
import { UserPlus, UserCheck, MessageSquare, MapPin, Calendar, Briefcase, Camera, Check, X, Loader2, DollarSign, Users } from 'lucide-react';

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

  const handleFollow = async () => {
    if (!currentUser || isMyProfile) return;
    const isFollowing = profileData?.followers?.includes(currentUser.uid);
    try {
      const targetUserRef = doc(db, 'users', userId);
      if (isFollowing) {
        await updateDoc(targetUserRef, { followers: arrayRemove(currentUser.uid) });
        setProfileData(prev => ({ ...prev, followers: prev.followers.filter(id => id !== currentUser.uid) }));
      } else {
        await updateDoc(targetUserRef, { followers: arrayUnion(currentUser.uid) });
        setProfileData(prev => ({ ...prev, followers: [...(prev.followers || []), currentUser.uid] }));
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const toggleCreatorMode = async () => {
    if (!isMyProfile) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const newState = !profileData?.creatorModeEnabled;
      await updateDoc(userRef, { creatorModeEnabled: newState });
      setProfileData(prev => ({ ...prev, creatorModeEnabled: newState }));
      alert(newState ? "Đã bật chế độ Nhà sáng tạo!" : "Đã tắt chế độ Nhà sáng tạo.");
    } catch (error) {
      console.error("Error toggling creator mode:", error);
    }
    setIsSaving(false);
  };

  const claimCreatorReward = async () => {
    if (!isMyProfile || (profileData?.followers?.length || 0) < 10 || !profileData?.creatorModeEnabled) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const newBalance = (profileData.balance || 0) + 100000; // Reward 100k VND
      await updateDoc(userRef, { 
        balance: newBalance,
        isCreator: true,
        lastRewardClaimed: new Date()
      });
      setProfileData(prev => ({ ...prev, balance: newBalance, isCreator: true }));
      alert("Chúc mừng! Bạn đã nhận được 100,000 VND từ chương trình Nhà sáng tạo!");
    } catch (error) {
      console.error("Error claiming reward:", error);
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
            {!isMyProfile ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  className={`glass-btn ${profileData?.followers?.includes(currentUser.uid) ? 'secondary' : 'primary'}`} 
                  onClick={handleFollow}
                >
                  {profileData?.followers?.includes(currentUser.uid) ? 'Đang theo dõi' : 'Theo dõi'}
                </button>
                <button 
                  onClick={handleFriendAction} 
                  className={`glass-btn ${isFriend ? 'secondary' : 'primary'}`}
                >
                  {isFriend ? <><UserCheck size={18} /> Bạn bè</> : 
                   isRequestSent ? "Đã gửi lời mời" :
                   isRequestReceived ? "Chấp nhận" :
                   <><UserPlus size={18} /> Kết bạn</>}
                </button>
                <button className="glass-btn secondary" onClick={() => onProfileClick('chat', userId)}>
                  <MessageSquare size={18} /> Nhắn tin
                </button>
              </div>
            ) : (
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

          <div style={{ display: 'flex', gap: '24px', padding: '16px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginTop: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '800', fontSize: '1.2rem' }}>{profileData?.followers?.length || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Người theo dõi</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '800', fontSize: '1.2rem' }}>{profileData?.friends?.length || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bạn bè</div>
            </div>
            {isMyProfile && (
              <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
                <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#10b981' }}>
                  {(profileData?.balance || 0).toLocaleString()}đ
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số dư</div>
              </div>
            )}
          </div>

          {isMyProfile && (
            <div className="glass-panel" style={{ margin: '16px 24px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: profileData?.creatorModeEnabled ? '1px solid #10b981' : '1px solid var(--border)' }}>
              <div>
                <h4 style={{ margin: 0 }}>Chế độ Nhà sáng tạo</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {profileData?.creatorModeEnabled ? 'Đang hoạt động - Bạn có thể kiếm tiền từ followers' : 'Tắt - Hãy bật để bắt đầu kiếm tiền'}
                </p>
              </div>
              <button className={`glass-btn ${profileData?.creatorModeEnabled ? 'secondary' : 'primary'}`} onClick={toggleCreatorMode}>
                {profileData?.creatorModeEnabled ? 'Tắt' : 'Bật kiếm tiền'}
              </button>
            </div>
          )}

          {isMyProfile && profileData?.creatorModeEnabled && (profileData?.followers?.length || 0) >= 10 && !profileData?.isCreator && (
            <div className="glass-panel" style={{ margin: '16px 24px', padding: '16px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,165,0,0.1))', border: '1px solid gold' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'gold', padding: '8px', borderRadius: '50%', color: '#000' }}>
                  <DollarSign size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0 }}>Phần thưởng cột mốc!</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Bạn đã đạt 10 followers. Hãy nhận ngay phần thưởng khởi đầu!</p>
                </div>
                <button className="glass-btn primary" onClick={claimCreatorReward} disabled={isSaving}>
                  Nhận 100k
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-intro-card glass">
            <h3 className="intro-title">Giới thiệu</h3>
            <div className="intro-item">
              <Briefcase size={20} />
              <span>Làm việc tại <strong>AURANET</strong></span>
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
