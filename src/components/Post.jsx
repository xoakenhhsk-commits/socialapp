import { useState } from 'react';
import { Heart, MessageCircle, Share2, UserPlus, UserCheck, Globe, Users, Lock, X, Download } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

export default function Post({ post, currentUser, dbUser }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const isLiked = post.likes?.includes(currentUser.uid);
  const isMyPost = post.authorId === currentUser.uid;
  const isFriend = dbUser?.friends?.includes(post.authorId);
  const isRequestSent = dbUser?.friendRequestsSent?.includes(post.authorId);

  const handleLike = async () => {
    const postRef = doc(db, 'posts', post.id);
    try {
      if (isLiked) {
        await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const postRef = doc(db, 'posts', post.id);
    const commentObj = {
      id: Date.now().toString(),
      authorId: currentUser.uid,
      authorName: currentUser.displayName,
      authorPhoto: currentUser.photoURL,
      text: newComment,
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(postRef, {
        comments: arrayUnion(commentObj)
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}?post=${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Đã copy link bài viết!");
    }).catch(() => {
      alert("Không thể copy link.");
    });
  };

  const handleSendRequest = async () => {
    if (isFriend || isMyPost || isRequestSent) return;
    try {
      const otherUserRef = doc(db, 'users', post.authorId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(otherUserRef, {
        friendRequestsReceived: arrayUnion(currentUser.uid)
      });
      await updateDoc(currentUserRef, {
        friendRequestsSent: arrayUnion(post.authorId)
      });
      
      alert(`Đã gửi lời mời kết bạn đến ${post.authorName}!`);
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  const handleDownloadImage = async (e) => {
    e.stopPropagation();
    try {
      // Fetch the image as a Blob to force download instead of opening in a new tab
      const response = await fetch(post.mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `social-app-image-${post.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Không thể tải ảnh xuống. Vui lòng thử lại.');
    }
  };

  const formattedTime = post.createdAt?.toDate ? 
    new Intl.DateTimeFormat('vi-VN', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
    }).format(post.createdAt.toDate()) : 'Vừa xong';

  const PrivacyIcon = () => {
    if (post.privacy === 'public') return <Globe size={14} />;
    if (post.privacy === 'friends') return <Users size={14} />;
    if (post.privacy === 'private') return <Lock size={14} />;
    return <Globe size={14} />;
  };

  return (
    <div className="post-card glass">
      <div className="post-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={post.authorPhoto || "https://via.placeholder.com/40"} alt={post.authorName} className="avatar" />
          <div>
            <h3 className="post-author" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              {post.authorName}
              {!isMyPost && (
                isFriend ? 
                  <span className="friend-badge"><UserCheck size={14}/> Bạn bè</span> :
                isRequestSent ?
                  <span className="friend-badge" style={{background: 'rgba(255,255,255,0.1)'}}>Đã gửi lời mời</span> :
                  <button onClick={handleSendRequest} className="add-friend-btn"><UserPlus size={14}/> Kết bạn</button>
              )}
            </h3>
            <p className="post-time" style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
              {formattedTime} • <PrivacyIcon />
            </p>
          </div>
        </div>
      </div>
      
      <div className="post-content">
        {post.content}
      </div>

      {post.mediaUrl && (
        <div className="post-media" onClick={() => post.mediaType !== 'video' && setIsImageModalOpen(true)}>
          {post.mediaType === 'video' ? (
            post.mediaUrl.includes('dailymotion.com') ? (
              <div className="video-embed-wrapper" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px' }}>
                <iframe
                  src={`${post.mediaUrl}${post.mediaUrl.includes('?') ? '&' : '?'}queue-enable=0&queue-autoplay-next=0&sharing-enable=0&ui-logo=0&ui-start-screen-info=0`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="Dailymotion Video"
                />
              </div>
            ) : (
              <video src={post.mediaUrl} controls className="media-preview" style={{ width: '100%', borderRadius: '12px' }} onClick={(e) => e.stopPropagation()} />
            )
          ) : (
            <img src={post.mediaUrl} alt="Post Attachment" className="media-preview" />
          )}
        </div>
      )}

      {isImageModalOpen && post.mediaType !== 'video' && (
        <div className="image-modal-overlay" onClick={() => setIsImageModalOpen(false)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-actions">
              <button className="image-modal-btn" onClick={handleDownloadImage} title="Tải xuống">
                <Download size={20} />
              </button>
              <button className="image-modal-btn" onClick={() => setIsImageModalOpen(false)} title="Đóng">
                <X size={20} />
              </button>
            </div>
            <img src={post.mediaUrl} alt="Fullscreen Attachment" className="image-modal-img" />
          </div>
        </div>
      )}

      <div className="post-stats">
        <span>{post.likes?.length || 0} Likes</span>
        <span>{post.comments?.length || 0} Comments</span>
      </div>

      <div className="post-actions">
        <button 
          onClick={handleLike} 
          className={`action-btn ${isLiked ? 'liked' : ''}`}
        >
          <Heart size={20} className={isLiked ? 'filled-heart' : ''} />
          Like
        </button>
        <button className="action-btn" onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={20} />
          Comment
        </button>
        <button className="action-btn" onClick={handleShare}>
          <Share2 size={20} />
          Share
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {(post.comments || []).map(comment => (
              <div key={comment.id} className="comment-item">
                <img src={comment.authorPhoto} alt="" className="avatar-small" />
                <div className="comment-bubble">
                  <strong>{comment.authorName}</strong>
                  <p>{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleAddComment} className="comment-composer">
            <img src={currentUser.photoURL} alt="" className="avatar-small" />
            <input 
              type="text" 
              className="glass-input comment-input" 
              placeholder="Write a comment..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit" className="glass-btn small-btn" disabled={!newComment.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
