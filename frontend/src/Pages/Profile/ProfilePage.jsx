import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';
import { getRoleMeta } from '../../utils/roleLabels';

const ProfilePage = ({ currentUser, socket }) => {
  const { username } = useParams(); 
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [postContent, setPostContent] = useState('');

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${SERVER_URL}/api/users/profile/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'User not found');
      }
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
    
    if (!socket) return;
    
    const handleRequestSent = () => fetchProfile();
    const handleRequestAccepted = () => fetchProfile();

    socket.on('friend request sent', handleRequestSent);
    socket.on('friend request accepted', handleRequestAccepted);

    return () => {
        socket.off('friend request sent', handleRequestSent);
        socket.off('friend request accepted', handleRequestAccepted);
    }
  }, [fetchProfile, socket]);

  const handleFriendAction = async (action, targetUserId) => {
    if (action === 'add') {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${SERVER_URL}/api/friends/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ receiverId: targetUserId })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to send friend request');
          }
          if (socket) socket.emit('send friend request', { receiverId: targetUserId });
          fetchProfile();
        } catch (error) {
          console.error('Failed to send friend request', error);
          setError(error.message || 'Failed to send friend request');
        }
        return;
    }

    let url = '';
    let method = 'POST';
    let body = {};
    let confirmMessage = '';

    switch (action) {
        case 'unfriend':
        case 'unblock':
            url = `${SERVER_URL}/api/friends/unfriend`;
            body = { friendId: targetUserId };
            confirmMessage = action === 'unfriend' 
                ? "Are you sure you want to remove this friend?"
                : "Are you sure you want to unblock this user?";
            break;
        default: return;
    }

    if (confirmMessage && !window.confirm(confirmMessage)) return;

    try {
        const token = localStorage.getItem('token');
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        fetchProfile();
    } catch (error) {
        console.error(`Failed to ${action} user`, error);
    }
  }

  const handlePostSubmit = async (e) => {
      e.preventDefault();
      if(!postContent.trim()) return;
      try {
          const token = localStorage.getItem('token');
          await fetch(`${SERVER_URL}/api/posts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ content: postContent })
          });
          setPostContent('');
          fetchProfile();
      } catch (error) {
          console.error("Failed to create post", error);
      }
  }

  const renderFriendButtons = () => {
    if (!profile) return null;
    const { friendship, user: profileUser } = profile;
    
    if (friendship && friendship.status === 'blocked') {
        if (friendship.action_user_id === currentUser.id) {
            return (
                <div className='text-right'>
                    <span className="text-red-500 font-medium block mb-2">You blocked this user.</span>
                    <button onClick={() => handleFriendAction('unblock', profileUser.id)} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md">Unblock</button>
                </div>
            );
        }
        return <span className="text-red-500 font-medium">This user has blocked you.</span>;
    }

    if (friendship && friendship.status === 'accepted') {
        return (
            <div className="flex items-center gap-2">
                <Link to={`/chat/${profileUser.username}`} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md">Message</Link>
                <button onClick={() => handleFriendAction('unfriend', profileUser.id)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md">Unfriend</button>
            </div>
        );
    }
    
    if (friendship && friendship.status === 'pending') {
        return <span className="text-gray-500 font-medium px-4 py-2">Request Sent</span>;
    }

    return (
        <button onClick={() => handleFriendAction('add', profileUser.id)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">Add Friend</button>
    );
  }

  if (isLoading) return <p className="text-center mt-8">Loading profile...</p>;
  if (error) return <p className="text-center mt-8 text-red-500">{error}</p>;
  if (!profile) return null;
  
  const profileUser = profile.user;
  const isMyProfile = currentUser?.username === profileUser.username;
  const roleMeta = getRoleMeta(profileUser.role || currentUser?.role || 'user');
  const nickname = profile.friendship?.nickname || null;
  const displayName = profileUser.display_name || profileUser.username;
  const primaryName = isMyProfile
    ? (currentUser?.display_name || currentUser?.username || displayName)
    : (nickname || displayName);

  const secondarySegments = [];
  if (!isMyProfile && nickname) {
    if (profileUser.display_name && profileUser.display_name !== nickname) {
      secondarySegments.push(profileUser.display_name);
    }
  } else if (profileUser.display_name && profileUser.display_name !== profileUser.username) {
    secondarySegments.push(profileUser.display_name);
  }
  secondarySegments.push(`@${profileUser.username}`);
  const secondaryLine = secondarySegments.filter(Boolean).join(' \u2022 ');



  return (
    <div className="max-w-3xl mx-auto p-4 font-sans">
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex items-center gap-6">
              <div className="relative">
                  <Avatar user={isMyProfile ? currentUser : profileUser} size="w-24 h-24" />
                  {isMyProfile && (
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500">
                      </span>
                  )}
              </div>
              <div className="flex-1">
                  <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                              <h1 className="text-3xl font-bold">{primaryName}</h1>
                              {!isMyProfile && nickname && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                      Your nickname
                                  </span>
                              )}
                          </div>
                          {secondaryLine && (
                              <p className="text-sm text-gray-500">{secondaryLine}</p>
                          )}
                          {roleMeta && (
                              <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${roleMeta.classes}`}>
                                  {roleMeta.label}
                              </span>
                          )}
                      </div>
                      {!isMyProfile && renderFriendButtons()}
                  </div>
              </div>
          </div>
      </div>
      
      {isMyProfile && (
         <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold">Create a new post</h2>
                {roleMeta && (
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${roleMeta.classes}`}>
                        {roleMeta.label}
                    </span>
                )}
            </div>
            {roleMeta && (
                <p className="text-xs text-blue-600 mb-3"></p>
            )}
            <form onSubmit={handlePostSubmit}>
                <textarea 
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="What's on your mind?"
                />
                <button type="submit" className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Post</button>
            </form>
         </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Posts</h2>
        {profile.posts.length > 0 ? (
          profile.posts.map(post => (
            <div key={post.id} className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-800">{post.content}</p>
              <p className="text-xs text-gray-400 mt-2 text-right">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-gray-500">This user has no posts yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;




