import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, doc, getDoc, updateDoc, arrayUnion, limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Send, Users, User, Plus, Search, ChevronLeft, 
  MoreHorizontal, MessageSquare, Check, X, Bell 
} from 'lucide-react';

export default function Chat({ user, dbUser }) {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSidebarActive, setIsSidebarActive] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const messagesEndRef = useRef(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [notificationSound, setNotificationSound] = useState(localStorage.getItem('aura_notif_sound') || 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  const lastMsgIdRef = useRef(null);
  const audioRef = useRef(null);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in-memory to avoid Index requirements
      convos.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setConversations(convos);
    }, (err) => {
      console.error("Conversations snapshot error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeChat) return;

    const q = query(
      collection(db, `conversations/${activeChat.id}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data({ serverTimestamps: 'estimate' }) 
      }));
      
      // Notification Sound Logic
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsgIdRef.current && lastMsg.id !== lastMsgIdRef.current && lastMsg.senderId !== user.uid) {
          audioRef.current?.play().catch(e => console.log("Sound play blocked by browser"));
        }
        lastMsgIdRef.current = lastMsg.id;
      }

      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    }, (err) => {
      console.error("Messages snapshot error:", err);
    });

    return () => unsubscribe();
  }, [activeChat, user.uid]);

  // Fetch friends for group creation
  useEffect(() => {
    if (!dbUser?.friends || dbUser.friends.length === 0) {
      setFriendsList([]);
      return;
    }

    const fetchFriends = async () => {
      const friendsData = [];
      for (const friendId of dbUser.friends) {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          friendsData.push({ uid: friendId, ...friendDoc.data() });
        }
      }
      setFriendsList(friendsData);
    };

    fetchFriends();
  }, [dbUser]);

  // Mark as read when active chat changes OR new messages arrive
  useEffect(() => {
    if (activeChat && user && messages.length > 0) {
      const markAsRead = async () => {
        try {
          const convoRef = doc(db, 'conversations', activeChat.id);
          const convoSnap = await getDoc(convoRef);
          if (convoSnap.exists() && !convoSnap.data().readBy?.includes(user.uid)) {
            await updateDoc(convoRef, {
              readBy: arrayUnion(user.uid)
            });
          }
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      };
      markAsRead();
    }
  }, [activeChat, user, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const msg = newMessage;
    setNewMessage('');

    try {
      const convoRef = doc(db, 'conversations', activeChat.id);
      await addDoc(collection(db, `conversations/${activeChat.id}/messages`), {
        text: msg,
        senderId: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      });

      await updateDoc(convoRef, {
        lastMessage: msg,
        updatedAt: serverTimestamp(),
        readBy: [user.uid] // Reset read status for others
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const createDirectChat = async (friend) => {
    const existing = conversations.find(c => 
      !c.isGroup && c.participants.includes(friend.uid)
    );

    if (existing) {
      setActiveChat(existing);
      setIsSidebarActive(false);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'conversations'), {
        participants: [user.uid, friend.uid],
        isGroup: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        readBy: [user.uid],
        participantDetails: {
          [user.uid]: { name: user.displayName, photo: user.photoURL },
          [friend.uid]: { name: friend.displayName, photo: friend.photoURL }
        }
      });
      setActiveChat({ id: docRef.id, participants: [user.uid, friend.uid], isGroup: false });
      setIsSidebarActive(false);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;

    try {
      const participants = [user.uid, ...selectedFriends];
      const participantDetails = {
        [user.uid]: { name: user.displayName, photo: user.photoURL }
      };
      
      friendsList.forEach(f => {
        if (selectedFriends.includes(f.uid)) {
          participantDetails[f.uid] = { name: f.displayName, photo: f.photoURL };
        }
      });

      await addDoc(collection(db, 'conversations'), {
        name: groupName,
        isGroup: true,
        participants,
        participantDetails,
        readBy: [user.uid],
        adminId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Nhóm đã được tạo'
      });

      setShowCreateGroup(false);
      setGroupName('');
      setSelectedFriends([]);
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleAddMember = async (friend) => {
    if (!activeChat || activeChat.participants.includes(friend.uid)) return;

    try {
      const convoRef = doc(db, 'conversations', activeChat.id);
      await updateDoc(convoRef, {
        participants: arrayUnion(friend.uid),
        [`participantDetails.${friend.uid}`]: { name: friend.displayName, photo: friend.photoURL },
        lastMessage: `${user.displayName} đã thêm ${friend.displayName} vào nhóm`,
        updatedAt: serverTimestamp(),
        readBy: [user.uid]
      });
      setShowAddMember(false);
    } catch (error) {
      console.error("Error adding member:", error);
    }
  };

  const toggleFriendSelection = (uid) => {
    setSelectedFriends(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const getChatName = (convo) => {
    if (convo.isGroup) return convo.name;
    const otherId = convo.participants.find(id => id !== user.uid);
    return convo.participantDetails?.[otherId]?.name || "Người dùng AURANET";
  };

  const getChatPhoto = (convo) => {
    if (convo.isGroup) return null;
    const otherId = convo.participants.find(id => id !== user.uid);
    return convo.participantDetails?.[otherId]?.photo;
  };

  const handleSoundUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        setNotificationSound(base64);
        localStorage.setItem('aura_notif_sound', base64);
        alert("Đã cập nhật nhạc chuông!");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="chat-container">
      <audio ref={audioRef} src={notificationSound} />
      
      {/* Sidebar */}
      <div className={`chat-sidebar ${isSidebarActive ? 'active' : ''}`}>
        <div className="chat-sidebar-header" style={{ paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>messenger</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <label className="create-group-icon-btn" style={{ cursor: 'pointer' }} title="Cài đặt nhạc chuông">
              <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleSoundUpload} />
              <Bell size={20} />
            </label>
            <button className="create-group-icon-btn" onClick={() => setShowCreateGroup(true)}>
              <Plus size={22} />
            </button>
          </div>
        </div>

        <div className="chat-search-container">
          <input type="text" className="chat-search" placeholder="Ask Meta AI or Search" />
        </div>

        {/* Messenger-like Active Bar */}
        {friendsList.length > 0 && (
          <div className="active-bar">
            <div className="active-user-item">
              <div style={{ position: 'relative' }}>
                <img src={user.photoURL} alt="" className="active-avatar-large" style={{ opacity: 0.6 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center' }}>
                  Post a note
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>Create note</span>
            </div>
            {friendsList.map(f => (
              <div key={f.uid} className="active-user-item" onClick={() => createDirectChat(f)} style={{ cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <img src={f.photoURL} alt="" className="active-avatar-large" />
                  <div className="online-status"></div>
                </div>
                <span style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>{f.displayName.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="chat-list">
          {conversations.map(convo => {
            const isUnread = !convo.readBy?.includes(user.uid);
            return (
              <div 
                key={convo.id} 
                className={`chat-item ${activeChat?.id === convo.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                onClick={() => { setActiveChat(convo); setIsSidebarActive(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}
              >
                <div style={{ position: 'relative' }}>
                  {convo.isGroup ? (
                    <div className="avatar-small" style={{ background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050505' }}>
                      <Users size={20} />
                    </div>
                  ) : (
                    <>
                      <img src={getChatPhoto(convo)} alt="" className="avatar-small" />
                      <div className="online-status"></div>
                    </>
                  )}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-text">
                    <div className="chat-item-name">{getChatName(convo)}</div>
                    <p className="chat-item-last-msg" style={{ margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {convo.lastMessage || "Bắt đầu trò chuyện"}
                    </p>
                  </div>
                  {isUnread && <div className="unread-dot"></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`chat-main ${!isSidebarActive ? 'active' : ''}`}>
        {activeChat ? (
          <>
            <div className="chat-header">
              <button className="glass-btn small-btn" onClick={() => setIsSidebarActive(true)} style={{ padding: '8px', border: 'none', background: 'none' }}>
                <ChevronLeft size={24} color="#0084ff" />
              </button>
              {activeChat.isGroup ? (
                <div className="avatar-small" style={{ background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050505' }}>
                  <Users size={20} />
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <img src={getChatPhoto(activeChat)} alt="" className="avatar-small" />
                  <div className="online-status"></div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>{getChatName(activeChat)}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeChat.isGroup ? `${activeChat.participants.length} thành viên` : 'Đang hoạt động'}
                </p>
              </div>
              {activeChat.isGroup && (
                <button className="add-member-btn" onClick={() => setShowAddMember(true)}>
                  <Plus size={16} /> <span className="desktop-only">Thêm</span>
                </button>
              )}
            </div>

            <div className="messages-area">
              {messages.map((msg, idx) => {
                const isMine = msg.senderId === user.uid;
                const showAuthor = activeChat.isGroup && !isMine && (idx === 0 || messages[idx-1].senderId !== msg.senderId);
                
                return (
                  <div key={msg.id} className={`message-bubble ${isMine ? 'message-sent' : 'message-received'}`}>
                    {showAuthor && <span className="message-author">{msg.senderName}</span>}
                    {msg.text}
                    <span className="message-info">
                      {msg.timestamp?.toDate ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : ''}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={sendMessage}>
              <button type="button" className="send-btn" style={{ color: '#94a3b8' }}>
                <Plus size={22} />
              </button>
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Aa" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="send-btn">
                <Send size={22} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div className="glass" style={{ padding: '32px', borderRadius: '50%', marginBottom: '24px' }}>
              <MessageSquare size={64} style={{ color: 'var(--primary)' }} />
            </div>
            <h2>Chọn một cuộc trò chuyện</h2>
            <p>Bắt đầu kết nối với bạn bè của bạn.</p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Tạo nhóm mới</h2>
            
            <div className="form-group">
              <label>Tên nhóm:</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="Ví dụ: Hội bạn thân..." 
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label>Thêm thành viên ({selectedFriends.length}):</label>
              <div className="friends-selection-list">
                {friendsList.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Bạn chưa có bạn bè để tạo nhóm.</p>}
                {friendsList.map(f => (
                  <div 
                    key={f.uid} 
                    className={`friend-select-item ${selectedFriends.includes(f.uid) ? 'selected' : ''}`}
                    onClick={() => toggleFriendSelection(f.uid)}
                  >
                    <img src={f.photoURL} alt="" className="avatar-small" />
                    <span style={{ flex: 1 }}>{f.displayName}</span>
                    {selectedFriends.includes(f.uid) ? <Check size={18} color="var(--primary)" /> : <Plus size={18} />}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="glass-btn primary" 
                style={{ flex: 1 }}
                disabled={!groupName.trim() || selectedFriends.length === 0}
                onClick={handleCreateGroup}
              >
                Tạo nhóm
              </button>
              <button className="glass-btn secondary" style={{ flex: 1 }} onClick={() => setShowCreateGroup(false)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Thêm thành viên</h2>
            <div className="friends-selection-list">
              {friendsList.filter(f => !activeChat.participants.includes(f.uid)).map(f => (
                <div key={f.uid} className="friend-select-item" onClick={() => handleAddMember(f)}>
                  <img src={f.photoURL} alt="" className="avatar-small" />
                  <span style={{ flex: 1 }}>{f.displayName}</span>
                  <Plus size={18} color="#0084ff" />
                </div>
              ))}
              {friendsList.filter(f => !activeChat.participants.includes(f.uid)).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tất cả bạn bè đã ở trong nhóm này.</p>
              )}
            </div>
            <button className="glass-btn secondary" style={{ width: '100%', marginTop: '12px' }} onClick={() => setShowAddMember(false)}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
