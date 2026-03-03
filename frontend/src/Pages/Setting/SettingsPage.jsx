import React, { useState, useEffect, useCallback } from 'react';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';

const SettingsPage = ({ currentUser, onSettingsChange }) => {
    const [displayName, setDisplayName] = useState(currentUser.display_name || currentUser.username);
    const [error, setError] = useState('');
    const [hiddenChats, setHiddenChats] = useState([]);

    const fetchHiddenChats = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/conversations/hidden`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setHiddenChats(data);
            }
        } catch (err) {
            console.error('Failed to fetch hidden chats:', err);
        }
    }, []);

    useEffect(() => {
        fetchHiddenChats();
    }, [fetchHiddenChats]);

    const handleUnhideChat = async (chat) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/conversations/hidden/${chat.type}/${chat.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setHiddenChats(prev => prev.filter(c => c.id !== chat.id));
                alert(`Chat with ${chat.name} has been restored.`);
            } else {
                throw new Error('Failed to unhide chat.');
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const handleUpdateDisplayName = async (e) => {
        e.preventDefault();
        setError('');
        if (displayName === (currentUser.display_name || currentUser.username)) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/settings/display-name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newDisplayName: displayName }),
            });
            const data = await response.json();
            if (response.ok) {
                onSettingsChange({
                    display_name: data.user.display_name,
                });
                alert('Display name updated successfully!');
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const RoleDisplay = ({ role }) => {
        if (!role) return null;
        const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
        let roleColor = 'text-gray-500 bg-gray-100';
        if (role === 'super-admin') {
            roleColor = 'text-red-700 bg-red-100';
        } else if (role === 'group-admin') {
            roleColor = 'text-blue-700 bg-blue-100';
        }
        return (
            <div className="text-center mb-6">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${roleColor}`}>
                    {displayRole}
                </span>
            </div>
        );
    };

    return (
        <div className="max-w-xl mx-auto p-4 font-sans h-full overflow-y-auto">
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h1 className="text-2xl font-bold mb-6 text-center">User Settings</h1>

                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
                
                <div className="flex flex-col items-center mb-4">
                    <Avatar user={currentUser} size="w-32 h-32" />
                    <p className="mt-2 text-sm text-gray-500 text-center">
                        Profile pictures use the system default avatar.
                    </p>
                </div>

                <RoleDisplay role={currentUser.role} />
                
                <div className="mb-6">
                    <label htmlFor="username" className="font-semibold block mb-2">Username (Cannot be changed)</label>
                    <input
                        id="username" type="text" value={currentUser.username}
                        className="w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-lg focus:outline-none"
                        readOnly
                    />
                </div>

                <form onSubmit={handleUpdateDisplayName}>
                    <label htmlFor="displayName" className="font-semibold block mb-2">Display Name</label>
                    <div className="flex gap-2">
                        <input
                            id="displayName" type="text" value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                            disabled={displayName === (currentUser.display_name || currentUser.username)}
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Hidden Chats</h2>
                <div className="space-y-3">
                    {hiddenChats.length > 0 ? (
                        hiddenChats.map(chat => (
                            <div key={chat.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <Avatar user={chat} size="w-10 h-10" />
                                    <span className="font-semibold">{chat.name}</span>
                                </div>
                                <button 
                                    onClick={() => handleUnhideChat(chat)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm rounded-md font-semibold"
                                >
                                    Unhide
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-center py-4">You have no hidden chats.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
