
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import { encryptGroupKey, pemToDer } from '../../utils/keyManager';

const GroupSettingsModal = ({ groupInfo, onClose, onDataChanged, groupKey, keyPair, currentUser, canManageGroup = false }) => {
    const [groupName, setGroupName] = useState(groupInfo.name);
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState(new Set());
    const navigate = useNavigate();
    
    const creator = groupInfo.members.find(m => m.id === groupInfo.creator_id);
    const creatorName = creator ? creator.username : 'Unknown';

    useEffect(() => {
        if (!canManageGroup) {
            setFriends([]);
            return;
        }
        const fetchFriends = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${SERVER_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` }});
            const allFriends = await res.json();
            const currentMemberIds = new Set(groupInfo.members.map(m => m.id));
            const friendsToInvite = allFriends.filter(f => !currentMemberIds.has(f.id));
            setFriends(friendsToInvite);
        };
        fetchFriends();
    }, [groupInfo.members, canManageGroup]);

    const handleSelectFriend = (friendId) => {
        const newSelection = new Set(selectedFriends);
        if (newSelection.has(friendId)) newSelection.delete(friendId);
        else newSelection.add(friendId);
        setSelectedFriends(newSelection);
    };

    const handleNameChange = async () => {
        if (!canManageGroup) return;
        if (groupName.trim() === groupInfo.name || !groupName.trim()) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${SERVER_URL}/api/groups/${groupInfo.id}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: groupName })
            });
            onDataChanged();
        } catch (error) { console.error("Failed to change name", error); }
    };
    
    const handleInviteMembers = async () => {
        if (!canManageGroup) {
            alert('You do not have permission to invite members.');
            return;
        }
        if (selectedFriends.size === 0) return;
        if (!groupKey || !keyPair?.privateKey) {
            alert("Cannot invite new members: Encryption keys are not available.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const friendIdsToInvite = Array.from(selectedFriends);

            const keyPromises = friendIdsToInvite.map(id => 
                fetch(`${SERVER_URL}/api/keys/public/by-id/${id}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch key for user ${id}`);
                    return res.json();
                })
            );
            const publicKeysData = await Promise.all(keyPromises);

            const membersWithKeys = await Promise.all(publicKeysData.map(async (keyData) => {
                const importedPublicKey = await window.crypto.subtle.importKey('spki', pemToDer(keyData.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
                const encryptedKey = await encryptGroupKey(groupKey, importedPublicKey, keyPair.privateKey);
                return { userId: keyData.userId, encryptedKey };
            }));

            await fetch(`${SERVER_URL}/api/groups/${groupInfo.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ members: membersWithKeys })
            });

            alert('Invitations sent successfully!');
            onDataChanged();
            setSelectedFriends(new Set());

        } catch (error) {
            console.error("Failed to invite members", error);
            alert(`Error inviting members: ${error.message}`);
        }
    };

    const handleLeaveGroup = async () => {
        if (window.confirm("Are you sure you want to leave this group?")) {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${SERVER_URL}/api/groups/${groupInfo.id}/leave`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                navigate('/chats');
            } catch (error) {
                console.error("Failed to leave group", error);
            }
        }
    };

    const handleDisbandGroup = async () => {
        if (!canManageGroup) return;
        if (window.confirm("Are you sure you want to disband this group? This action cannot be undone.")) {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${SERVER_URL}/api/groups/${groupInfo.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                navigate('/chats');
            } catch (error) {
                console.error("Failed to disband group", error);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Group Settings</h2>
                
                <div className="mb-4">
                    <label className="font-semibold block mb-1">Group Name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className={`flex-1 p-2 border rounded ${canManageGroup ? '' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                            disabled={!canManageGroup}
                        />
                        {canManageGroup && (
                            <button onClick={handleNameChange} className="bg-blue-500 text-white px-3 rounded">Save</button>
                        )}
                    </div>
                    {!canManageGroup && (
                        <p className="text-xs text-gray-500 mt-1">Only group administrators can rename the group.</p>
                    )}
                </div>

                <div className="mb-4">
                    <label className="font-semibold block mb-1">Current Members ({groupInfo.members.length})</label>
                    <div className="text-sm text-gray-600">
                        {groupInfo.members.map(m => m.username).join(', ')}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Group Admin: <span className="font-medium text-gray-700">{creatorName}</span>
                    </p>
                </div>

                {canManageGroup ? (
                    friends.length > 0 ? (
                        <div className="mb-4">
                            <label className="font-semibold block mb-1">Invite More Friends</label>
                            <div className="max-h-32 overflow-y-auto border rounded p-2">
                                {friends.map(friend => (
                                    <div key={friend.id} className="flex items-center gap-2 p-1">
                                        <input type="checkbox" id={`add-${friend.id}`} checked={selectedFriends.has(friend.id)} onChange={() => handleSelectFriend(friend.id)} />
                                        <label htmlFor={`add-${friend.id}`}>{friend.username}</label>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleInviteMembers} className="bg-green-500 text-white px-3 py-1 rounded mt-2">Invite Selected</button>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mt-4">All of your friends are already in this group.</p>
                    )
                ) : (
                    <p className="text-sm text-gray-500 mt-4">You do not have permission to invite new members.</p>
                )}
                
                <div className="mt-6 pt-4 border-t">
                    {canManageGroup ? (
                        <button onClick={handleDisbandGroup} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Disband Group</button>
                    ) : (
                        <button onClick={handleLeaveGroup} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Leave Group</button>
                    )}
                </div>

                <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Close</button>
                </div>
            </div>
        </div>
    );
};

export default GroupSettingsModal;
