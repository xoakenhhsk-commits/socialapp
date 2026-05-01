import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, doc, getDoc, updateDoc, arrayUnion, limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Send, Users, User, Plus, Search, ChevronLeft, 
  MoreHorizontal, MessageSquare, Check, X 
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

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConversations(convos);
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    });

    return () => unsubscribe();
  }, [activeChat]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const msg = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, `conversations/${activeChat.id}/messages`), {
        text: msg,
        senderId: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'conversations', activeChat.id), {
        lastMessage: msg,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const createDirectChat = async (friend) => {
    // Check if direct chat already exists
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

      const docRef = await addDoc(collection(db, 'conversations'), {
        name: groupName,
        isGroup: true,
        participants,
        participantDetails,
        adminId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Nhóm đã được tạo'
      });

      setShowCreateGroup(false);
      setGroupName('');
      setSelectedFriends([]);
      // Selection will happen via onSnapshot
    } catch (error) {
      console.error("Error creating group:", error);
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
    if (convo.isGroup) return null; // Use icon
    const otherId = convo.participants.find(id => id !== user.uid);
    return convo.participantDetails?.[otherId]?.photo;
  };

  return (
    <div className="chat-container glass">
      {/* Sidebar */}
      <div className={`chat-sidebar ${isSidebarActive ? 'active' : ''}`}>
        <div className="chat-sidebar-header">
          <h2 style={{ margin: 0 }}>Tin nhắn</h2>
          <button className="glass-btn small-btn" onClick={() => setShowCreateGroup(true)}>
            <Plus size={20} />
          </button>
        </div>
        
        <div className="chat-list">
          {conversations.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>Chưa có cuộc trò chuyện nào. Hãy kết bạn để bắt đầu chat!</p>
            </div>
          )}
          {conversations.map(convo => (
            <div 
              key={convo.id} 
              className={`chat-item ${activeChat?.id === convo.id ? 'active' : ''}`}
              onClick={() => { setActiveChat(convo); setIsSidebarActive(false); }}
            >
              <div style={{ position: 'relative' }}>
                {convo.isGroup ? (
                  <div className="avatar-small" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <Users size={18} />
                  </div>
                ) : (
                  <img src={getChatPhoto(convo)} alt="" className="avatar-small" />
                )}
              </div>
              <div className="chat-item-info">
                <span className="chat-item-name">
                  {getChatName(convo)}
                  {convo.isGroup && <span className="group-badge">Group</span>}
                </span>
                <p className="chat-item-last-msg">{convo.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Start Chat with Friend List (Shortcut) */}
        {friendsList.length > 0 && conversations.length < 5 && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Gợi ý bạn bè:</p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {friendsList.map(f => (
                <img 
                  key={f.uid} 
                  src={f.photoURL} 
                  title={f.displayName} 
                  className="avatar-small" 
                  style={{ cursor: 'pointer', border: '2px solid transparent' }}
                  onClick={() => createDirectChat(f)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className={`chat-main ${!isSidebarActive ? 'active' : ''}`}>
        {activeChat ? (
          <>
            <div className="chat-header">
              <button className="glass-btn small-btn" onClick={() => setIsSidebarActive(true)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={20} /> <span className="mobile-only">Quay lại</span>
              </button>
              {activeChat.isGroup ? (
                <div className="avatar-small" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Users size={18} />
                </div>
              ) : (
                <img src={getChatPhoto(activeChat)} alt="" className="avatar-small" />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{getChatName(activeChat)}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeChat.isGroup ? `${activeChat.participants.length} thành viên` : 'Đang hoạt động'}
                </p>
              </div>
              <button className="glass-btn small-btn">
                <MoreHorizontal size={20} />
              </button>
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
              <input 
                type="text" 
                className="glass-input chat-input" 
                placeholder="Nhập tin nhắn..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="glass-btn primary" style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}>
                <Send size={20} />
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
    </div>
  );
}
