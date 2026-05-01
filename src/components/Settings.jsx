import { useState } from 'react';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogOut, User, Save } from 'lucide-react';

export default function Settings({ user, dbUser }) {
  const [newName, setNewName] = useState(user.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName === user.displayName) return;

    setIsUpdating(true);
    try {
      await updateProfile(user, { displayName: newName });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { displayName: newName });
      alert("Cập nhật tên thành công!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Lỗi khi cập nhật thông tin.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  };

  return (
    <div className="settings-container">
      <div className="composer-card glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <User size={24} color="#60a5fa" />
          <h2 style={{ margin: 0 }}>Cài đặt tài khoản</h2>
        </div>

        <form onSubmit={handleUpdate} className="settings-form">
          <div className="form-group">
            <label>Tên hiển thị:</label>
            <input 
              type="text" 
              className="glass-input" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isUpdating}
            />
          </div>
          <button type="submit" className="glass-btn primary" disabled={isUpdating || !newName.trim() || newName === user.displayName}>
            {isUpdating ? "Đang lưu..." : <><Save size={18} /> Lưu thay đổi</>}
          </button>
        </form>

        <div className="menu-divider" style={{ margin: '32px 0' }}></div>

        <div className="account-danger-zone">
          <h3 style={{ color: '#f87171', fontSize: '1.1rem', marginBottom: '16px' }}>Hành động tài khoản</h3>
          <button onClick={handleLogout} className="logout-side-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <LogOut size={18} /> Đăng xuất khỏi thiết bị
          </button>
        </div>
      </div>
    </div>
  );
}
