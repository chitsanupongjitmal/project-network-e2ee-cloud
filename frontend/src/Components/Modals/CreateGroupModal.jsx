
import React, { useState, useEffect } from 'react';
import { SERVER_URL } from '../../config';
import { createGroupKey, encryptGroupKey, pemToDer } from '../../utils/keyManager';

const ALLOWED_ROLES = new Set(['group-admin', 'super-admin']);

const CreateGroupModal = ({ onClose, onGroupCreated, keyPair, currentUser }) => {
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState(new Set());
    const [groupName, setGroupName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const canManageGroups = currentUser
        ? (ALLOWED_ROLES.has(currentUser.role) || !!currentUser.can_create_group)
        : false;
    
    useEffect(() => {
        if (!canManageGroups) {
            setFriends([]);
            return;
        }
        const fetchFriends = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${SERVER_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            setFriends(data);
        };
        fetchFriends();
    }, [canManageGroups]);

    const handleSelectFriend = (friendId) => {
        if (!canManageGroups) return;
        const newSelection = new Set(selectedFriends);
        if (newSelection.has(friendId)) {
            newSelection.delete(friendId);
        } else {
            newSelection.add(friendId);
        }
        setSelectedFriends(newSelection);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!canManageGroups) {
            alert("You do not have permission to create groups.");
            return;
        }
        if (!groupName.trim()) {
            alert("Please provide a group name.");
            return;
        }
        if (!keyPair || !keyPair.privateKey) {
            alert("Your encryption keys are not available. Please log in again.");
            return;
        }
        try {
            setIsSubmitting(true);
            const token = localStorage.getItem('token');
            const currentUserId = parseInt(localStorage.getItem('userId'));

            const groupKey = await createGroupKey();
            const allMemberIds = [currentUserId, ...Array.from(selectedFriends)];
            
            const keyPromises = allMemberIds.map(id => 
                fetch(`${SERVER_URL}/api/keys/public/by-id/${id}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch key for user ${id}`);
                    return res.json();
                })
            );
            const publicKeysData = await Promise.all(keyPromises);

            const membersWithKeys = await Promise.all(publicKeysData.map(async (keyData) => {
                const importedPublicKey = await window.crypto.subtle.importKey(
                    'spki', pemToDer(keyData.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []
                );

                const encryptedKey = await encryptGroupKey(groupKey, importedPublicKey, keyPair.privateKey);
                return { userId: keyData.userId, encryptedKey };
            }));

            const response = await fetch(`${SERVER_URL}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: groupName, members: membersWithKeys })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to create group on server.');
            
            onGroupCreated(data.groupId, groupKey);
            onClose();
        } catch (error) {
            console.error("Failed to create group:", error);
            alert(`Error creating group: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredFriends = friends.filter(friend => (
        friend.username?.toLowerCase().includes(searchTerm.toLowerCase())
    ));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Create New Group</h2>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        placeholder="Group Name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full p-2 border rounded mb-4"
                        required
                    />
                    <h3 className="font-semibold mb-2">Invite Friends (Optional):</h3>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search friends..."
                        className="w-full p-2 border rounded mb-2 text-sm"
                        disabled={!canManageGroups}
                    />
                    <p className="text-xs text-gray-500 mb-2">Selected: {selectedFriends.size}</p>
                    <div className="max-h-48 overflow-y-auto border rounded p-2 mb-4">
                        {canManageGroups ? (
                            filteredFriends.length > 0 ? filteredFriends.map(friend => (
                                <div key={friend.id} className="flex items-center gap-2 p-1">
                                    <input 
                                        type="checkbox" 
                                        id={`friend-${friend.id}`}
                                        checked={selectedFriends.has(friend.id)}
                                        onChange={() => handleSelectFriend(friend.id)}
                                    />
                                    <label htmlFor={`friend-${friend.id}`}>{friend.username}</label>
                                </div>
                            )) : <p className="text-sm text-gray-500">{friends.length > 0 ? 'No friends match your search.' : 'You have no friends to invite.'}</p>
                        ) : (
                            <p className="text-sm text-gray-500">Your role cannot invite members. Contact a group administrator.</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded" disabled={isSubmitting}>Cancel</button>
                        <button
                            type="submit"
                            className={`px-4 py-2 rounded ${canManageGroups ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                            disabled={!canManageGroups || isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
