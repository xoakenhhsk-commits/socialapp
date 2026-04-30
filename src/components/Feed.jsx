import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from '../firebase';
import Post from './Post';
import { Image, Video, Globe, Users, Lock, X } from 'lucide-react';

export default function Feed({ user, dbUser, profileUserId }) {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const filteredPosts = allPosts.filter(post => {
        // If viewing a profile, ONLY show posts from that user
        if (profileUserId && post.authorId !== profileUserId) return false;

        // I can always see my own posts
        if (post.authorId === user.uid) return true;
        
        // Everyone can see public posts
        if (post.privacy === 'public') return true;
        
        // Only friends can see 'friends' posts
        if (post.privacy === 'friends') {
          return dbUser.friends?.includes(post.authorId);
        }
        
        return false;
      });

      setPosts(filteredPosts);
    });
    return () => unsubscribe();
  }, [user.uid, dbUser.friends, profileUserId]);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && !mediaFile) return;

    setIsUploading(true);
    let mediaUrl = '';
    let mediaType = '';

    try {
      if (mediaFile) {
        if (mediaFile.type.startsWith('image/')) {
          // ========== IMAGE UPLOAD via ImgBB ==========
          mediaType = 'image';
          
          const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
          if (!apiKey) {
            alert("Lỗi: Bạn chưa thêm VITE_IMGBB_API_KEY vào file .env!");
            setIsUploading(false);
            return;
          }

          const formData = new FormData();
          formData.append('image', mediaFile);

          setUploadProgress(50);

          const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
          });

          const data = await response.json();
          
          if (data.success) {
            mediaUrl = data.data.url;
            setUploadProgress(100);
          } else {
            throw new Error(data.error?.message || "Image upload failed");
          }

        } else if (mediaFile.type.startsWith('video/')) {
          // ========== VIDEO UPLOAD via Dailymotion ==========
          mediaType = 'video';

          // Check video file size (Dailymotion max ~2GB, but we limit to 100MB for UX)
          const maxSizeMB = 100;
          if (mediaFile.size > maxSizeMB * 1024 * 1024) {
            alert(`Video quá lớn! Kích thước tối đa cho phép là ${maxSizeMB}MB.`);
            setIsUploading(false);
            return;
          }

          // Step 1: Get Dailymotion token + upload URL from our API
          setUploadProgress(5);
          const tokenRes = await fetch('/api/dailymotion-token', { method: 'POST' });
          const tokenData = await tokenRes.json();

          if (!tokenData.upload_url) {
            throw new Error(tokenData.error || tokenData.details || 'Không thể kết nối Dailymotion. Kiểm tra cấu hình API.');
          }

          // Step 2: Upload video file directly to Dailymotion's upload URL
          setUploadProgress(15);
          const uploadForm = new FormData();
          uploadForm.append('file', mediaFile);

          // Use XMLHttpRequest to track real upload progress
          const uploadData = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', tokenData.upload_url);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round(15 + (event.loaded / event.total) * 60);
                setUploadProgress(percent);
              }
            };

            xhr.onload = () => {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch {
                reject(new Error('Invalid response from Dailymotion upload'));
              }
            };

            xhr.onerror = () => reject(new Error('Upload failed - network error'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            xhr.timeout = 300000; // 5 minutes

            xhr.send(uploadForm);
          });

          if (!uploadData.url) {
            throw new Error('Dailymotion upload did not return a valid URL');
          }

          // Step 3: Publish the video on Dailymotion
          setUploadProgress(80);
          const publishRes = await fetch('/api/dailymotion-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: tokenData.access_token,
              uploaded_url: uploadData.url,
              title: newPostContent || `Video - ${new Date().toLocaleDateString('vi-VN')}`
            })
          });
          const publishData = await publishRes.json();

          if (publishData.id) {
            mediaUrl = `https://www.dailymotion.com/embed/video/${publishData.id}`;
            setUploadProgress(100);
          } else {
            throw new Error(publishData.error || publishData.details || 'Failed to publish video');
          }
        }
      }

      await addDoc(collection(db, 'posts'), {
        content: newPostContent,
        authorId: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        likes: [],
        comments: [],
        privacy: privacy,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        createdAt: serverTimestamp()
      });

      setNewPostContent('');
      removeMedia();
      setUploadProgress(0);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Lỗi khi đăng bài: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="feed-container">
      <div className="composer-card glass-panel">
        <div className="composer-header">
          <img src={user.photoURL || "https://via.placeholder.com/40"} alt="User" className="avatar" />
          <h3 style={{margin: 0}}>What's on your mind, {user.displayName?.split(' ')[0]}?</h3>
        </div>
        <form onSubmit={handleCreatePost}>
          <textarea 
            className="glass-input" 
            placeholder="Type your post here..." 
            rows="3"
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            disabled={isUploading}
          />
          
          {mediaPreview && (
            <div className="media-preview-container">
              <button type="button" onClick={removeMedia} className="remove-media-btn">
                <X size={16} />
              </button>
              {mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} controls className="media-preview" />
              ) : (
                <img src={mediaPreview} alt="Preview" className="media-preview" />
              )}
            </div>
          )}

          {isUploading && uploadProgress > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}

          <div className="composer-actions-row">
            <div className="composer-tools">
              <label className="action-btn">
                <Image size={20} color="#34d399" />
                <span>Photo</span>
                <input type="file" accept="image/*" onChange={handleMediaChange} hidden disabled={isUploading}/>
              </label>
              <label className="action-btn">
                <Video size={20} color="#60a5fa" />
                <span>Video</span>
                <input type="file" accept="video/*" onChange={handleMediaChange} hidden disabled={isUploading}/>
              </label>
              
              <div className="privacy-selector">
                <select 
                  value={privacy} 
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="glass-select"
                  disabled={isUploading}
                >
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends</option>
                  <option value="private">🔒 Only Me</option>
                </select>
              </div>
            </div>

            <button type="submit" className="glass-btn" disabled={(!newPostContent.trim() && !mediaFile) || isUploading}>
              {isUploading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      <div className="posts-list">
        {posts.map(post => (
          <Post key={post.id} post={post} currentUser={user} dbUser={dbUser} />
        ))}
        {posts.length === 0 && (
          <div className="empty-state">
            <p>No posts to show. Share something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
