
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';
import { decryptMessage, pemToDer, decryptWithGroupKey } from '../../utils/keyManager';
import CreateGroupModal from '../../Components/Modals/CreateGroupModal';

const ContextMenu = ({ x, y, convo, onClose, onHideChat }) => {
    if (!convo) return null;
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <div style={{ top: y, left: x }} className="fixed bg-white rounded-md shadow-lg z-50 border py-1 w-48">
                <ul>
                    <li>
                        <button onClick={() => { onHideChat(convo); onClose(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                            Hide Chat
                        </button>
                    </li>
                </ul>
            </div>
        </>
    );
};

const MANAGER_ROLES = new Set(['group-admin', 'super-admin']);
const canManageGroups = (user) => !!user && (MANAGER_ROLES.has(user.role) || !!user.can_create_group);

const ChatListPage = ({ socket, keyPair, decryptedGroupKeys, onKeyDecrypted, currentUser, themeMode = 'light' }) => {
    const [rawConversations, setRawConversations] = useState([]);
    const [decryptedConversations, setDecryptedConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const navigate = useNavigate();
    const manageGroups = canManageGroups(currentUser);

    const fetchConversations = useCallback(async (query = '', showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url = query ? `${SERVER_URL}/api/conversations?q=${encodeURIComponent(query)}` : `${SERVER_URL}/api/conversations`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            setRawConversations(data);
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => fetchConversations(searchQuery), 300);
        return () => clearTimeout(handler);
    }, [searchQuery, fetchConversations]);

    useEffect(() => {
        if (!rawConversations.length) {
            setDecryptedConversations([]);
            return;
        }
        const decryptPreviews = async () => {
            const processedConvos = await Promise.all(
                rawConversations.map(async (convo) => {
                    if (!convo.lastMessage) return convo;


                    if (convo.type === 'private' && convo.peerPublicKey && convo.messageType?.startsWith('encrypted')) {
                        if (!keyPair) return { ...convo, lastMessage: '🔒 Loading keys...' };
                        try {
                            const importedKey = await window.crypto.subtle.importKey('spki', pemToDer(convo.peerPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
                            const decryptedPayload = await decryptMessage(convo.lastMessage, importedKey, keyPair.privateKey);

                            if (convo.messageType === 'encrypted' || convo.messageType === 'encrypted_text') return { ...convo, lastMessage: decryptedPayload };
                            if (convo.messageType?.startsWith('encrypted_')) {
                                const fileInfo = JSON.parse(decryptedPayload);
                                if (convo.messageType === 'encrypted_image') return { ...convo, lastMessage: fileInfo.caption ? `🖼️ ${fileInfo.caption}` : '🖼️ Photo' };
                                return { ...convo, lastMessage: fileInfo.caption ? `📎 ${fileInfo.caption}` : '📎 Attachment' };
                            }
                        } catch (e) {
                            return { ...convo, lastMessage: '🔒 Failed to decrypt' };
                        }
                    }



                    if (convo.type === 'group' && convo.messageType?.startsWith('encrypted')) {
                        const groupKey = decryptedGroupKeys ? decryptedGroupKeys[convo.id] : null;
                        if (groupKey) {
                            try {
                                const decryptedPayload = await decryptWithGroupKey(convo.lastMessage, groupKey);

                                if (convo.messageType === 'encrypted_text') {
                                    return { ...convo, lastMessage: decryptedPayload };
                                } else if (convo.messageType.startsWith('encrypted_')) {
                                    const fileInfo = JSON.parse(decryptedPayload);
                                    if (convo.messageType === 'encrypted_image') {
                                        return { ...convo, lastMessage: fileInfo.caption ? `🖼️ ${fileInfo.caption}` : '🖼️ Photo' };
                                    }
                                    return { ...convo, lastMessage: fileInfo.caption ? `📎 ${fileInfo.caption}` : '📎 Attachment' };
                                }
                            } catch (e) {
                                return { ...convo, lastMessage: '🔒 Failed to decrypt' };
                            }
                        }
                        return { ...convo, lastMessage: '🔒 Encrypted Message' };
                    }

                    
                    return convo;
                })
            );
            setDecryptedConversations(processedConvos);
        };
        decryptPreviews();
    }, [rawConversations, keyPair, decryptedGroupKeys]);

    useEffect(() => {
        if (!socket) return;
        const handleRefresh = () => fetchConversations(searchQuery, false);
        socket.on('refresh conversations', handleRefresh);
        return () => socket.off('refresh conversations', handleRefresh);
    }, [socket, fetchConversations, searchQuery]);

    const handleContextMenu = (e, convo) => {
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY, convo });
    };

    const handleHideChat = async (convo) => {
        if (!window.confirm(`Are you sure you want to hide the chat with ${convo.name}?`)) return;
        try {
            const token = localStorage.getItem('token');
            let url = '';
            if (convo.type === 'private') {
                url = `${SERVER_URL}/api/chat/history/${encodeURIComponent(convo.name)}`; 
            } else {
                alert("Hiding group chats is not yet implemented.");
                return;
            }
            
            const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                throw new Error("Failed to hide chat on server.");
            }
            await fetchConversations(searchQuery, false);
            alert(`Chat with ${convo.name} hidden. You can unhide it from Settings.`);
        } catch (error) {
            console.error("Failed to hide chat", error);
            alert("Could not hide chat.");
        }
    };
    
    const handleGroupCreated = async (groupId, rawGroupKey) => {
        setIsModalOpen(false);
        if (groupId && rawGroupKey && onKeyDecrypted) {
            await onKeyDecrypted(groupId, rawGroupKey);
        }

        await fetchConversations(searchQuery, false);

        if (groupId) {
            navigate(`/group/${groupId}`);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const queueAudioCall = (username) => {
        if (!username) return;
        localStorage.setItem('pendingCallUser', username);
        navigate(`/chat/${username}`);
    };
    
    const isDark = themeMode === 'dark';
    const activeStyle = { backgroundColor: isDark ? '#1f2937' : '#EFF6FF' };

    return (
        <div className={`h-full flex flex-col ${isDark ? 'bg-black text-white' : 'bg-white'}`}>
            <div className={`p-4 border-b ${isDark ? 'border-gray-800' : ''}`}>
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Chats</h1>
                    <button
                        onClick={() => manageGroups && setIsModalOpen(true)}
                        className={`hidden sm:inline-flex p-2 rounded-full ${manageGroups ? (isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-100') : 'cursor-not-allowed text-gray-300'}`}
                        title={manageGroups ? "Create New Group" : "You do not have permission to create groups"}
                        disabled={!manageGroups}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${manageGroups ? (isDark ? 'text-gray-300' : 'text-gray-600') : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>
                {!manageGroups && (
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Only users with group-creation permission can create new group chats.</p>
                )}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats..."
                    className={`w-full mt-4 px-4 py-2 border rounded-lg focus:outline-none ${isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300'}`}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
                 {isLoading ? (
                     <p className={`text-center mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                ) : decryptedConversations.length > 0 ? (
                    decryptedConversations.map(convo => {
                        const displayName = convo.nickname || convo.display_name || convo.name;
                        const showUsernameBadge = convo.type === 'private' && displayName && convo.name && displayName.toLowerCase() !== convo.name.toLowerCase();
                        const avatarUser = {
                            username: displayName || convo.name,
                            avatar_url: convo.avatar_url
                        };

                        return (
                            <div
                                key={`${convo.type}-${convo.id}`}
                                onContextMenu={(e) => handleContextMenu(e, convo)}
                                className={`flex items-center gap-2 p-2 rounded-lg w-full ${isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-100'}`}
                            >
                                <NavLink
                                    to={convo.type === 'group' ? `/group/${convo.id}` : `/chat/${convo.name}`}
                                    style={({ isActive }) => isActive ? activeStyle : undefined}
                                    className="flex items-center gap-3 flex-1 min-w-0 rounded-lg p-1"
                                >
                                    <Avatar user={avatarUser} size="w-12 h-12" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{displayName}</p>
                                                {showUsernameBadge && (
                                                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>@{convo.name}</p>
                                                )}
                                            </div>
                                            <p className={`text-xs flex-shrink-0 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatTimestamp(convo.lastMessageTimestamp)}</p>
                                        </div>
                                        <p className={`text-sm truncate mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{convo.lastMessage || 'No messages yet'}</p>
                                    </div>
                                </NavLink>

                                {convo.type === 'private' && (
                                    <button
                                        type="button"
                                        onClick={() => queueAudioCall(convo.name)}
                                        className={`h-9 w-9 rounded-full border flex items-center justify-center ${isDark ? 'border-gray-700 text-gray-300 hover:text-blue-400 hover:border-blue-400' : 'border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300'}`}
                                        title={`Call ${displayName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.3a1 1 0 01.95.68l1.2 3.6a1 1 0 01-.23 1.02l-1.52 1.52a16 16 0 006.36 6.36l1.52-1.52a1 1 0 011.02-.23l3.6 1.2a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.94 21 3 14.06 3 5V5z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-center py-4`}>
                        {searchQuery ? `No chats found for "${searchQuery}"` : "You have no active conversations."}
                    </p>
                )}
            </div>
            
            {isModalOpen && manageGroups && (
                <CreateGroupModal 
                    onClose={() => setIsModalOpen(false)} 
                    onGroupCreated={handleGroupCreated}
                    keyPair={keyPair}
                    currentUser={currentUser}
                />
            )}

            {manageGroups && (
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="sm:hidden fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95"
                    title="Create New Group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                </button>
            )}

            {contextMenu && (
                <ContextMenu 
                    {...contextMenu}
                    onClose={() => setContextMenu(null)}
                    onHideChat={handleHideChat}
                />
            )}
        </div>
    );
};

export default ChatListPage;
