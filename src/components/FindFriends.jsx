import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { UserPlus, UserCheck, Clock, Check, X } from 'lucide-react';

export default function FindFriends({ user, dbUser }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Keep a real-time list of all users to easily resolve names/photos
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.uid !== user.uid);
      setUsersList(allUsers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleSendRequest = async (otherUserId) => {
    try {
      const otherUserRef = doc(db, 'users', otherUserId);
      const currentUserRef = doc(db, 'users', user.uid);
      
      await updateDoc(otherUserRef, {
        friendRequestsReceived: arrayUnion(user.uid)
      });
      await updateDoc(currentUserRef, {
        friendRequestsSent: arrayUnion(otherUserId)
      });
    } catch (error) {
      console.error("Error sending friend request:", error);
      alert("Lỗi khi gửi lời mời.");
    }
  };

  const handleAcceptRequest = async (otherUserId) => {
    try {
      const otherUserRef = doc(db, 'users', otherUserId);
      const currentUserRef = doc(db, 'users', user.uid);
      
      await updateDoc(otherUserRef, {
        friendRequestsSent: arrayRemove(user.uid),
        friends: arrayUnion(user.uid)
      });
      await updateDoc(currentUserRef, {
        friendRequestsReceived: arrayRemove(otherUserId),
        friends: arrayUnion(otherUserId)
      });
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleDeclineRequest = async (otherUserId) => {
    try {
      const otherUserRef = doc(db, 'users', otherUserId);
      const currentUserRef = doc(db, 'users', user.uid);
      
      await updateDoc(otherUserRef, {
        friendRequestsSent: arrayRemove(user.uid)
      });
      await updateDoc(currentUserRef, {
        friendRequestsReceived: arrayRemove(otherUserId)
      });
    } catch (error) {
      console.error("Error declining request:", error);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const friends = dbUser?.friends || [];
  const sentRequests = dbUser?.friendRequestsSent || [];
  const receivedRequests = dbUser?.friendRequestsReceived || [];

  // Filter users based on search
  const filteredSearchUsers = usersList.filter(u => 
    searchQuery.trim() !== '' && 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get users who sent me a request
  const pendingRequestUsers = usersList.filter(u => receivedRequests.includes(u.uid));

  return (
    <div className="find-friends-container">
      
      {pendingRequestUsers.length > 0 && (
        <div className="requests-section" style={{ marginBottom: '32px' }}>
          <h2>Lời mời kết bạn ({pendingRequestUsers.length})</h2>
          <div className="users-grid">
            {pendingRequestUsers.map(otherUser => (
              <div key={otherUser.uid} className="user-card glass-panel" style={{ border: '2px solid rgba(129, 140, 248, 0.3)' }}>
                <img 
                  src={otherUser.photoURL || "https://via.placeholder.com/60"} 
                  alt={otherUser.displayName} 
                  className="avatar-large" 
                  style={{cursor: 'pointer'}} 
                  onClick={() => onProfileClick && onProfileClick(otherUser.uid)}
                />
                <h3 
                  style={{cursor: 'pointer'}} 
                  onClick={() => onProfileClick && onProfileClick(otherUser.uid)}
                >
                  {otherUser.displayName}
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="glass-btn" style={{ background: 'rgba(74, 222, 128, 0.2)' }} onClick={() => handleAcceptRequest(otherUser.uid)}>
                    <Check size={18} /> Nhận
                  </button>
                  <button className="glass-btn secondary" onClick={() => handleDeclineRequest(otherUser.uid)}>
                    <X size={18} /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Tìm bạn bè mới</h2>
      <div style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          className="glass-input" 
          placeholder="Nhập tên người dùng cần tìm..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchQuery.trim() === '' ? (
        <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '40px' }}>
          Hãy nhập tên để tìm kiếm người dùng.
        </p>
      ) : (
        <div className="users-grid">
          {filteredSearchUsers.map(otherUser => {
            const isFriend = friends.includes(otherUser.uid);
            const isSent = sentRequests.includes(otherUser.uid);
            const isReceived = receivedRequests.includes(otherUser.uid);
            
            return (
              <div key={otherUser.uid} className="user-card glass-panel">
                <img 
                  src={otherUser.photoURL || "https://via.placeholder.com/60"} 
                  alt={otherUser.displayName} 
                  className="avatar-large" 
                  style={{cursor: 'pointer'}} 
                  onClick={() => onProfileClick && onProfileClick(otherUser.uid)}
                />
                <h3 
                  style={{cursor: 'pointer'}} 
                  onClick={() => onProfileClick && onProfileClick(otherUser.uid)}
                >
                  {otherUser.displayName}
                </h3>
                
                {isFriend ? (
                  <button className="glass-btn secondary" disabled>
                    <UserCheck size={18} /> Bạn bè
                  </button>
                ) : isReceived ? (
                  <button className="glass-btn" style={{ background: 'rgba(74, 222, 128, 0.2)' }} onClick={() => handleAcceptRequest(otherUser.uid)}>
                    <Check size={18} /> Chấp nhận
                  </button>
                ) : isSent ? (
                  <button className="glass-btn secondary" disabled>
                    <Clock size={18} /> Đã gửi lời mời
                  </button>
                ) : (
                  <button className="glass-btn" onClick={() => handleSendRequest(otherUser.uid)}>
                    <UserPlus size={18} /> Kết bạn
                  </button>
                )}
              </div>
            );
          })}
          {filteredSearchUsers.length === 0 && <p>Không tìm thấy người dùng nào khớp với "{searchQuery}".</p>}
        </div>
      )}
    </div>
  );
}
