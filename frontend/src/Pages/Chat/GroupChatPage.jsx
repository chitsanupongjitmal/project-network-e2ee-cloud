
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Message from '../../Components/Common/Message';
import MessageInput from '../../Components/Chat/MessageInput';
import GroupSettingsModal from '../../Components/Modals/GroupSettingsModal';
import ImageModal from '../../Components/Modals/ImageModal';
import ThemeMenu from '../../Components/Modals/ThemeMenu';
import { chatThemes } from '../../Data/themeData';
import Avatar from '../../Components/Common/Avatar';
import { decryptGroupKey, encryptWithGroupKey, decryptWithGroupKey, pemToDer } from '../../utils/keyManager';
import useGroupWebRTC from '../../hooks/useGroupWebRTC';
import GroupCallModal from '../../Components/Modals/GroupCallModal';
import { MoreVerticalIcon, PhoneIcon, LockIcon } from '../../Components/Common/Icons';
import { getRoleMeta } from '../../utils/roleLabels';


const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});


const GroupChatPage = ({ socket, currentUser, keyPair, onKeyDecrypted, decryptedGroupKeys }) => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [groupInfo, setGroupInfo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('default');
    const [viewingImage, setViewingImage] = useState(null);
    const [groupKey, setGroupKey] = useState(null);
    const [decryptedMessages, setDecryptedMessages] = useState([]);
    const menuRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const sendGroupMessageViaApi = useCallback(async ({ content, type, replyToMessageId, client_id }) => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${SERVER_URL}/api/groups/${groupId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content, type, replyToMessageId, client_id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Failed to send group message.');
        }
        return payload;
    }, [groupId]);

    const fetchGroupMessages = useCallback(async () => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${SERVER_URL}/api/groups/${groupId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch group messages.');
        return response.json();
    }, [groupId]);
    
    const { 
        localStream, remoteStreams, isCallActive, incomingCall,
        isMuted, startCall, joinCall, leaveCall, setIncomingCall,
        toggleMute, isCallInProgress, callParticipants, participantMuteMap
    } = useGroupWebRTC(socket, currentUser, groupId);
    const canManageGroup = currentUser?.role === 'group-admin' || currentUser?.role === 'super-admin';

    const groupMemberMap = useMemo(() => {
        const map = {};
        if (groupInfo?.members) {
            groupInfo.members.forEach(member => {
                map[member.id] = { ...member };
            });
        }
        if (currentUser) {
            map[currentUser.id] = {
                ...(map[currentUser.id] || {}),
                id: currentUser.id,
                username: currentUser.username,
                display_name: currentUser.display_name,
                nickname: currentUser.nickname,
                role: currentUser.role || 'user'
            };
        }
        return map;
    }, [groupInfo, currentUser]);


    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        
        if (decryptedGroupKeys && decryptedGroupKeys[groupId]) {
            setGroupKey(decryptedGroupKeys[groupId]);
        }

        try {
            const token = localStorage.getItem('token');
            const [infoRes, messagesRes] = await Promise.all([
                fetch(`${SERVER_URL}/api/groups/${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${SERVER_URL}/api/groups/${groupId}/messages`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (!infoRes.ok) {
                if (infoRes.status === 404) setErrorMessage("Group not found.");
                else if (infoRes.status === 403) setErrorMessage("Access denied. You may not be a member of this group.");
                else setErrorMessage(`Failed to load group data (Status: ${infoRes.status}).`);
                setIsLoading(false);
                return;
            }

            const infoData = await infoRes.json();
            const messagesData = await messagesRes.json();



            if (infoData.encryptedGroupKey && keyPair?.privateKey && infoData.encryptingUserPublicKey && (!decryptedGroupKeys || !decryptedGroupKeys[groupId])) {
                try {

                    const encryptingUserPublicKey = await window.crypto.subtle.importKey('spki', pemToDer(infoData.encryptingUserPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
                    
                    const decryptedKey = await decryptGroupKey(infoData.encryptedGroupKey, encryptingUserPublicKey, keyPair.privateKey);
                    
                    setGroupKey(decryptedKey);
                    if (onKeyDecrypted) onKeyDecrypted(groupId, decryptedKey);
                } catch (e) {
                    console.error("Failed to decrypt group key:", e);
                    setErrorMessage("Failed to decrypt group key. You might not have the correct decryption key.");
                }
            }


            setGroupInfo(infoData);
            setMessages(messagesData);
            setCurrentTheme(infoData.chat_theme || 'default');
        } catch (error) {
            console.error("Failed to load group data", error);
            setErrorMessage("Network error or failed to load data.");
        } finally {
            setIsLoading(false);
        }
    }, [groupId, navigate, keyPair, onKeyDecrypted, decryptedGroupKeys]);

    useEffect(() => {
        fetchData();
    }, [groupId, fetchData]);
    
    useEffect(() => {
        if (!groupKey) {
            const placeholderMessages = messages.map(msg => {
                const placeholder = { ...msg, decryptedText: 'Decrypting...' };
                if (msg.repliedTo) {
                    placeholder.repliedTo = { ...msg.repliedTo, decryptedText: '...' };
                }
                return placeholder;
            });
            setDecryptedMessages(placeholderMessages);
            return;
        }

        const decryptAllMessages = async () => {
            const decrypted = await Promise.all(
                messages.map(async (msg) => {
                    if (msg.is_unsent || msg.isTemp) return msg;

                    let decryptedText = '';
                    let fileInfo = null;
                    if (msg.message_type?.startsWith('encrypted') && msg.text) {
                        try {
                            const decryptedPayload = await decryptWithGroupKey(msg.text, groupKey);
                            if (msg.message_type === 'encrypted_image' || msg.message_type === 'encrypted_file') {
                                fileInfo = JSON.parse(decryptedPayload);
                                decryptedText = fileInfo.caption || '';
                            } else {
                                decryptedText = decryptedPayload;
                            }
                        } catch (e) {
                            decryptedText = 'Failed to decrypt message.';
                        }
                    } else {
                        decryptedText = msg.text;
                    }
                    
                    let processedRepliedTo = null;
                    if (msg.repliedTo && msg.repliedTo.text) {
                        let decryptedRepliedText = "Encrypted message";
                        let repliedFileInfo = null;
                        try {
                            const decryptedRepliedPayload = await decryptWithGroupKey(msg.repliedTo.text, groupKey);
                            if (msg.repliedTo.message_type?.startsWith('encrypted_')) {
                                repliedFileInfo = JSON.parse(decryptedRepliedPayload);
                                decryptedRepliedText = repliedFileInfo.caption || (msg.repliedTo.message_type.includes('image') ? 'Photo' : 'File');
                            } else {
                                decryptedRepliedText = decryptedRepliedPayload;
                            }
                        } catch (err) {  }
                        
                        processedRepliedTo = {
                            ...msg.repliedTo,
                            decryptedText: decryptedRepliedText,
                            fileInfo: repliedFileInfo,
                        };
                    }

                    return { ...msg, decryptedText, fileInfo, repliedTo: processedRepliedTo };
                })
            );
            setDecryptedMessages(decrypted);
        };
        decryptAllMessages();
    }, [messages, groupKey]);

    useEffect(() => {
        if (!socket) return;
        
        const handleGroupMessage = (newMessage) => {
            if (String(newMessage.group_id) === String(groupId)) {
                setMessages(prev => {
                    if (String(newMessage.sender_id) === String(currentUser.id) && newMessage.client_id) {
                        const tempMessageExists = prev.some(m => m.id === newMessage.client_id);
                        if (tempMessageExists) {
                            return prev.map(m => (m.id === newMessage.client_id ? { ...newMessage, isTemp: false } : m));
                        }
                    }

                    const messageExists = prev.some(m => m.id === newMessage.id);
                    if (!messageExists) {
                        return [...prev, newMessage];
                    }

                    return prev;
                });
            }
        };

        const handleMessageUnsent = ({ messageId, chatType, targetId }) => {
            if (chatType === 'group' && String(targetId) === String(groupId)) {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_unsent: 1, text: '', fileInfo: null } : m));
            }
        };
        const handleSystemMessage = (systemMessage) => {
            setMessages(prev => [...prev, { id: `system-${Date.now()}`, type: 'system', text: systemMessage.text, timestamp: new Date().toISOString() }]);
            fetchData();
        };
        const handleNameUpdate = ({ groupId: updatedGroupId, newName }) => {
            if (String(updatedGroupId) === String(groupId)) setGroupInfo(prev => ({ ...prev, name: newName }));
        };
        const handleThemeUpdate = ({ groupId: updatedGroupId, newTheme }) => {
            if (String(updatedGroupId) === String(groupId)) setCurrentTheme(newTheme);
        };
        const handleAvatarUpdate = ({ groupId: updatedGroupId, avatar_url }) => {
            if (String(updatedGroupId) === String(groupId)) {
                setGroupInfo(prev => ({ ...prev, avatar_url }));
            }
        };
        const handleGroupMembersUpdated = ({ groupId: updatedGroupId }) => {
            if (String(updatedGroupId) === String(groupId)) fetchData();
        };
        const handleGroupDisbanded = ({ groupId: disbandedGroupId }) => {
            if (String(disbandedGroupId) === String(groupId)) {
                alert("This group has been disbanded.");
                navigate('/');
            }
        };

        socket.on('group message', handleGroupMessage);
        socket.on('system message', handleSystemMessage);
        socket.on('message_unsent', handleMessageUnsent);
        socket.on('group name updated', handleNameUpdate);
        socket.on('group theme updated', handleThemeUpdate);
        socket.on('group avatar updated', handleAvatarUpdate);
        socket.on('group members updated', handleGroupMembersUpdated);
        socket.on('group disbanded', handleGroupDisbanded);

        return () => {
            socket.off('group message', handleGroupMessage);
            socket.off('system message', handleSystemMessage);
            socket.off('message_unsent', handleMessageUnsent);
            socket.off('group name updated', handleNameUpdate);
            socket.off('group theme updated', handleThemeUpdate);
            socket.off('group avatar updated', handleAvatarUpdate);
            socket.off('group members updated', handleGroupMembersUpdated);
            socket.off('group disbanded', handleGroupDisbanded);
        };
    }, [socket, groupId, navigate, fetchData, currentUser.id]);

    useEffect(() => {
        if (socket?.connected) return;
        let cancelled = false;

        const syncMessages = async () => {
            try {
                const serverMessages = await fetchGroupMessages();
                if (cancelled) return;

                setMessages(prev => {
                    const tempMessages = prev.filter(m => m.isTemp);
                    const mergedServer = serverMessages.map((serverMsg) => {
                        const localMatch = prev.find(localMsg => String(localMsg.id) === String(serverMsg.id));
                        return localMatch ? { ...localMatch, ...serverMsg, isTemp: false } : serverMsg;
                    });

                    const pendingTemps = tempMessages.filter((tmp) => (
                        !mergedServer.some((serverMsg) => (
                            tmp.client_id && serverMsg.client_id && String(tmp.client_id) === String(serverMsg.client_id)
                        ))
                    ));

                    return [...mergedServer, ...pendingTemps];
                });
            } catch (_error) {
                // Keep silent here; socket reconnect may recover.
            }
        };

        syncMessages();
        const timer = setInterval(syncMessages, 2500);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [socket?.connected, fetchGroupMessages]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const SCROLL_BOTTOM_THRESHOLD = 120;
        const handleScroll = () => {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            shouldAutoScrollRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
        };

        handleScroll();
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    useLayoutEffect(() => {
        if (shouldAutoScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [decryptedMessages]);

    const handleUnsendMessage = useCallback(async (message) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/groups/${groupId}/messages/${message.id}/unsend`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Failed to unsend message.');

            setMessages(prev => prev.map(m => (
                String(m.id) === String(message.id)
                    ? { ...m, is_unsent: 1, text: '', decryptedText: 'This message was unsent', fileInfo: null }
                    : m
            )));
        } catch (error) {
            console.error('Failed to unsend group message:', error);
            alert(error.message || 'Failed to unsend message.');
        }
    }, [groupId]);

    const handleSend = async (text, file) => {
        if ((!text.trim() && !file) || !groupKey) return;

        const client_id = `temp-${Date.now()}`;
        const tempReplyData = replyingToMessage ? {
            ...replyingToMessage,
            text: replyingToMessage.decryptedText 
        } : null;

        const baseTempMessage = {
            id: client_id,
            isTemp: true,
            sender_id: currentUser.id,
            sender: currentUser.username,
            timestamp: new Date().toISOString(),
            reply_to_message_id: replyingToMessage?.id,
            repliedTo: tempReplyData,
        };

        if (file) {
            setIsUploading(true);
            const isImage = file.type.startsWith('image/');
            const messageType = isImage ? 'encrypted_image' : 'encrypted_file';

            const tempMessage = {
                ...baseTempMessage,
                message_type: messageType,
                fileInfo: { url: URL.createObjectURL(file), caption: text, fileName: file.name },
                decryptedText: text,
            };
            setMessages(prev => [...prev, tempMessage]);

            try {
                const fileData = await fileToBase64(file);
                const token = localStorage.getItem('token');
                
                const uploadResponse = await fetch(`${SERVER_URL}/api/chat/upload-encrypted-file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ fileData, originalName: file.name, mimeType: file.type }),
                });
                if (!uploadResponse.ok) throw new Error('File upload failed on server.');
                const uploadResult = await uploadResponse.json();

                const payload = { url: uploadResult.url, fileName: file.name, mimeType: file.type, caption: text };
                const encryptedContent = await encryptWithGroupKey(JSON.stringify(payload), groupKey);

                const savedMessage = await sendGroupMessageViaApi({
                    content: encryptedContent,
                    type: messageType,
                    replyToMessageId: replyingToMessage?.id || null,
                    client_id
                });

                setMessages(prev => prev.map(m => (
                    m.id === client_id ? { ...savedMessage, isTemp: false, fileInfo: m.fileInfo, repliedTo: m.repliedTo } : m
                )));

            } catch (err) {
                console.error("Failed to send group file:", err);
                setMessages(prev => prev.filter(m => m.id !== client_id));
            } finally {
                setIsUploading(false);
                setReplyingToMessage(null);
            }
        } 
        else {
            try {
                const encryptedContent = await encryptWithGroupKey(text, groupKey);
                const tempMessage = { ...baseTempMessage, decryptedText: text, message_type: 'encrypted_text' };
                setMessages(prev => [...prev, tempMessage]);

                const savedMessage = await sendGroupMessageViaApi({
                    content: encryptedContent,
                    type: 'encrypted_text',
                    replyToMessageId: replyingToMessage?.id || null,
                    client_id
                });

                setMessages(prev => prev.map(m => (
                    m.id === client_id ? { ...savedMessage, isTemp: false, repliedTo: m.repliedTo } : m
                )));

            } catch (e) {
                console.error("Failed to send group message:", e);
                setMessages(prev => prev.filter(m => m.id !== client_id));
            } finally {
                setReplyingToMessage(null);
            }
        }
    };

    const handleThemeChange = async (themeKey) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/groups/${groupId}/theme`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ theme: themeKey })
            });
            if (!response.ok) {
                throw new Error(`Theme update failed with status ${response.status}`);
            }
            setCurrentTheme(themeKey);
            setIsThemeMenuOpen(false);
            setIsMenuOpen(false);
        } catch (error) {
            console.error("Failed to update group theme", error);
            alert("Could not update the group theme. Please try again.");
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const IncomingCallNotification = () => {
        if (!incomingCall || String(incomingCall.groupId) !== String(groupId)) return null;
        return (
            <div className="bg-green-100 border-t border-b border-green-500 text-green-700 px-4 py-3 flex justify-between items-center" role="alert">
                <div>
                    <p className="font-bold">{incomingCall.caller.username} started a group call.</p>
                    <p className="text-sm">Join the call?</p>
                </div>
                <div>
                    <button onClick={() => joinCall()} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-2">Join</button>
                    <button onClick={() => setIncomingCall(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded">Dismiss</button>
                </div>
            </div>
        )
    };
    
    const OngoingCallNotification = () => {
        if (!isCallInProgress || isCallActive) return null;
        return (
            <div className="bg-blue-100 border-t border-b border-blue-500 text-blue-700 px-4 py-3 flex justify-between items-center" role="alert">
                <p className="font-bold">A group call is in progress.</p>
                <button onClick={() => joinCall()} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Join Call</button>
            </div>
        )
    };

    if (isLoading || !groupInfo) return <div className="flex items-center justify-center h-full"><p>Loading group chat...</p></div>;
    if (errorMessage) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
            <p className="text-red-500 text-xl font-bold mb-4">Access Error</p>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <button onClick={() => navigate('/')} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Go to Chats List</button>
        </div>
    );
    if (!groupKey && !isCallActive) return <div className="flex items-center justify-center h-full"><p>Loading encryption key...</p></div>;

    return (
        <>
            {isCallActive && (
                <GroupCallModal 
                   localStream={localStream}
                   remoteStreams={remoteStreams}
                   onLeaveCall={leaveCall}
                   groupName={groupInfo.name}
                   currentUser={currentUser}
                   isMuted={isMuted}
                   toggleMute={toggleMute}
                    callParticipants={callParticipants}
                    participantMuteMap={participantMuteMap}
                />
            )}
            <div className="flex flex-col h-full bg-white">
                <header className="bg-white shadow-sm p-3 border-b flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Avatar user={{ username: groupInfo.name, avatar_url: groupInfo.avatar_url }} size="w-10 h-10" />
                            <div>
                                <h1 className="text-xl font-bold">{groupInfo.name}</h1>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <LockIcon className="h-4 w-4 text-green-500" />
                                    <span>{groupInfo.members.length} member{groupInfo.members.length === 1 ? '' : 's'}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => startCall()}
                                title="Start Audio Call"
                                className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                            >
                                <PhoneIcon />
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(prev => !prev);
                                        setIsThemeMenuOpen(false);
                                    }}
                                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <MoreVerticalIcon />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border py-1">
                                        {isThemeMenuOpen ? (
                                            <ThemeMenu
                                                onSelectTheme={handleThemeChange}
                                                onClose={() => {
                                                    setIsThemeMenuOpen(false);
                                                    setIsMenuOpen(false);
                                                }}
                                            />
                                        ) : (
                                            <ul>
                                                <li>
                                                    <button
                                                        onClick={() => setIsThemeMenuOpen(true)}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                    >
                                                        Change Theme
                                                    </button>
                                                </li>
                                                <li>
                                                    <button
                                                        onClick={() => {
                                                            setIsSettingsOpen(true);
                                                            setIsMenuOpen(false);
                                                            setIsThemeMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                    >
                                                        Group Settings
                                                    </button>
                                                </li>
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
            </div>
        </div>
    </header>

                {groupInfo?.members?.length > 0 && (
                    <div className="px-4 py-2 bg-white border-b flex flex-wrap gap-2 text-xs text-gray-600">
                        {groupInfo.members.map(member => {
                            const roleMeta = getRoleMeta(member.role);
                            return (
                                <span key={member.id} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                                    <span className="font-semibold">{member.username}</span>
                                    {roleMeta && (
                                        <span className={`px-2 py-0.5 rounded-full ${roleMeta.classes}`}>
                                            {roleMeta.label}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}

                <IncomingCallNotification />
                <OngoingCallNotification />

                <main ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto" style={chatThemes[currentTheme]?.style || chatThemes['default'].style}>
                    {decryptedMessages.map((msg, index) => {
                        if (msg.type === 'system') {
                            return <div key={msg.id || index} className="text-center my-2"><p className="text-xs text-gray-500 bg-gray-200 inline-block px-2 py-1 rounded-full">{msg.text}</p></div>;
                        }
                        return (
                            <Message 
                                key={msg.id || index} 
                                msg={{...msg, group_id: groupId}}
                                currentUser={currentUser}
                                onUnsendMessage={handleUnsendMessage}
                                onImageClick={(src) => setViewingImage(src)}
                                onSetReply={setReplyingToMessage}
                                isGroupChat={true}
                                groupMemberMap={groupMemberMap}
                            />
                        );
                    })}
                    <div ref={messagesEndRef} />
                </main>
                <MessageInput 
                    onSend={handleSend} 
                    replyingTo={replyingToMessage} 
                    onCancelReply={() => setReplyingToMessage(null)}
                    isInputDisabled={isUploading}
                />
                {isSettingsOpen && (
                    <GroupSettingsModal
                        groupInfo={groupInfo}
                        onClose={() => setIsSettingsOpen(false)}
                        onDataChanged={fetchData}
                        groupKey={groupKey}
                        keyPair={keyPair}
                        canManageGroup={canManageGroup}
                    />
                )}
            </div>
            <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />
        </>
    );
};

export default GroupChatPage;
