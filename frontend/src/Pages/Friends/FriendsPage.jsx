
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';


const EmptyStateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);


const FriendsPage = ({ socket, setHasNewFriendRequest }) => {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [groupInvites, setGroupInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('friends');
  const navigate = useNavigate();

  useEffect(() => {
    setHasNewFriendRequest(false);
  }, [setHasNewFriendRequest]);

  const fetchData = useCallback(async () => {

    try {
        const token = localStorage.getItem('token');
        const [friendsRes, requestsRes, invitesRes] = await Promise.all([
            fetch(`${SERVER_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${SERVER_URL}/api/friends/requests`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${SERVER_URL}/api/groups/invitations`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const friendsData = await friendsRes.json();
        const requestsData = await requestsRes.json();
        const invitesData = await invitesRes.json();

        setFriends(friendsData);
        setFriendRequests(requestsData);
        setGroupInvites(invitesData);

    } catch (error) {
        console.error("Failed to fetch data", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (!socket) return;


    const handleNewData = () => fetchData();
    socket.on('new friend request', handleNewData);
    socket.on('friend request accepted', handleNewData);
    socket.on('friend response success', handleNewData);
    socket.on('profile updated', handleNewData);

    return () => {
        socket.off('new friend request', handleNewData);
        socket.off('friend request accepted', handleNewData);
        socket.off('friend response success', handleNewData);
        socket.off('profile updated', handleNewData);
    };
  }, [fetchData, socket]);
  

  const handleFriendRequestResponse = (senderId, status) => {
      const respond = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${SERVER_URL}/api/friends/request/respond`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ senderId, status })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to respond to friend request');
          }
          if (socket) socket.emit('respond to friend request', { senderId, status });
          fetchData();
        } catch (error) {
          console.error('Failed to respond to friend request', error);
        }
      };
      respond();
  };

  const handleUnfriend = async (friendId) => {
      if (window.confirm("Are you sure you want to remove this friend?")) {
          try {
              const token = localStorage.getItem('token');
              await fetch(`${SERVER_URL}/api/friends/unfriend`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ friendId })
              });
              fetchData();
          } catch (error) {
              console.error("Failed to unfriend", error);
          }
      }
  };

  const handleGroupInviteResponse = async (groupId, response) => {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${SERVER_URL}/api/groups/invitations/respond`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ groupId, response })
        });
        fetchData();
      } catch (error) {
          console.error("Failed to respond to group invite", error);
      }
  };

  const queueAudioCall = (username) => {
    if (!username) return;
    localStorage.setItem('pendingCallUser', username);
    navigate(`/chat/${username}`);
  };


  const TabButton = ({ tabName, label, count }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
        activeTab === tabName
          ? 'bg-blue-500 text-white'
          : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );

  if (isLoading) return <p className="text-center mt-8">Loading...</p>;


  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 font-sans h-full flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Friends</h1>
      
      {}
      <div className="flex items-center gap-2 border-b mb-6">
        <TabButton tabName="friends" label="All Friends" count={0} />
        <TabButton tabName="requests" label="Pending Requests" count={friendRequests.length} />
        <TabButton tabName="invites" label="Group Invites" count={groupInvites.length} />
      </div>

      {}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' && (
          <div className="space-y-2">
            {friends.length > 0 ? friends.map(user => (
              <div key={user.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 transition-colors">
                <Link to={`/profile/${user.username}`} className="flex items-center gap-4 hover:underline">
                  <Avatar user={user} size="w-12 h-12" />
                  <span className="font-semibold text-gray-700">{user.username}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <button
                      onClick={() => queueAudioCall(user.username)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 text-sm rounded-md font-semibold"
                  >
                      Call
                  </button>
                  <Link to={`/chat/${user.username}`} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-md font-semibold">
                      Chat
                  </Link>
                  <button onClick={() => handleUnfriend(user.id)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 text-sm rounded-md font-semibold">
                      Unfriend
                  </button>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-gray-500">
                <EmptyStateIcon />
                <p className="mt-4">You don't have any friends yet.</p>
                <p className="text-sm">Use the search to find and add new friends!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-2">
            {friendRequests.length > 0 ? friendRequests.map(user => (
              <div key={user.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 transition-colors">
                <Link to={`/profile/${user.username}`} className="flex items-center gap-4 hover:underline">
                  <Avatar user={user} size="w-12 h-12" />
                  <span className="font-semibold text-gray-700">{user.username}</span>
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => handleFriendRequestResponse(user.id, 'accepted')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm rounded-md font-semibold">Accept</button>
                  <button onClick={() => handleFriendRequestResponse(user.id, 'rejected')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 text-sm rounded-md font-semibold">Decline</button>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-gray-500">
                <EmptyStateIcon />
                <p className="mt-4">No new friend requests.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-3">
            {groupInvites.length > 0 ? groupInvites.map(invite => (
              <div key={invite.id} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="mb-3 text-gray-700">
                  <span className="font-semibold">{invite.inviter}</span> invited you to join <span className="font-semibold">{invite.name}</span>
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => handleGroupInviteResponse(invite.id, 'accept')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm rounded-md font-semibold">Accept</button>
                  <button onClick={() => handleGroupInviteResponse(invite.id, 'reject')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 text-sm rounded-md font-semibold">Decline</button>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-gray-500">
                <EmptyStateIcon />
                <p className="mt-4">No new group invitations.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
