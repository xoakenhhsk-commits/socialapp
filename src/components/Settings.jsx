import { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Settings({ user, dbUser }) {
  const [newName, setNewName] = useState(user.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName === user.displayName) return;

    setIsUpdating(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: newName
      });

      // Update Firestore user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: newName
      });

      alert("Cập nhật tên thành công!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Lỗi khi cập nhật thông tin.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="composer-card glass-panel">
        <h2>Cài đặt tài khoản</h2>
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
          <button type="submit" className="glass-btn" disabled={isUpdating || !newName.trim() || newName === user.displayName}>
            {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      </div>
    </div>
  );
}
