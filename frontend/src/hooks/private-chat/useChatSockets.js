
import { useState, useEffect } from 'react';

export const useChatSockets = (socket, currentUser, peerUser, peerUsername, setMessages, fetchData, peerKeyVersions, peerKeyVersion) => {
    const [isPeerTyping, setIsPeerTyping] = useState(false);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [isSessionOutOfSync, setIsSessionOutOfSync] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (peerUser && peerKeyVersions[peerUser.id] && peerKeyVersions[peerUser.id] !== peerKeyVersion) {
            setIsSessionOutOfSync(true);
        } else if (peerUser) {
            setIsSessionOutOfSync(false);
        }
    }, [peerKeyVersions, peerUser, peerKeyVersion]);

    useEffect(() => {
        if (!socket || !peerUser?.id) return;
        
        const peerId = peerUser.id;
        socket.emit('mark as read', { peerUsername });

        const handlePrivateMessage = (newMessage) => {
            const isRelevant = [currentUser.id, peerId].includes(newMessage.senderId) && [currentUser.id, peerId].includes(newMessage.receiverId);
            if (isRelevant) {
                setMessages(prev => {



                    if (newMessage.senderId === currentUser.id && newMessage.client_id) {
                        const tempMessageExists = prev.some(m => m.id === newMessage.client_id);
                        if (tempMessageExists) {
                            return prev.map(m => {
                                if (m.id === newMessage.client_id) {


                                    return { ...newMessage, text: newMessage.encryptedPayload, isTemp: false, repliedTo: m.repliedTo };
                                }
                                return m;
                            });
                        }
                    }


                    const messageExists = prev.some(m => m.id === newMessage.id);
                    if (!messageExists) {
                        let finalNewMessage = { ...newMessage, text: newMessage.encryptedPayload || newMessage.text };



                        if (finalNewMessage.reply_to_message_id) {
                            const originalMessage = prev.find(m => m.id === finalNewMessage.reply_to_message_id);
                            if (originalMessage) {


                                finalNewMessage.repliedTo = {
                                    text: originalMessage.decryptedText || (originalMessage.fileInfo ? (originalMessage.fileInfo.caption || 'Attachment') : ''),
                                    sender: originalMessage.sender,
                                    type: originalMessage.type,
                                    fileInfo: originalMessage.fileInfo || null
                                };
                            }
                        }
                        return [...prev, finalNewMessage];
                    }

                    return prev;


                });

                if (newMessage.senderId === peerId) {
                    socket.emit('mark as read', { peerUsername });
                }
            }
        };

        const handleMessageUnsent = ({ messageId, chatType, conversationParticipants }) => {
            const isRelevant = chatType === 'private' && conversationParticipants.includes(currentUser.id) && conversationParticipants.includes(peerId);
            if (isRelevant) {
                setMessages(prevMessages => 
                    prevMessages.map(msg => 
                        msg.id === messageId 
                            ? { ...msg, is_unsent: 1, text: '', decryptedText: '', fileInfo: null }
                            : msg
                    )
                );
            }
        };

        const handleMessageBlocked = ({ message, client_id }) => {
            if (client_id) {
                setMessages(prevMessages => prevMessages.filter(msg => msg.id !== client_id));
            }
            if (message) {
                alert(message);
            }
        };

        const handleMessagesRead = ({ readerUsername }) => {  };
        const handleTyping = ({ username }) => setIsPeerTyping(username === peerUsername);
        const handleStopTyping = ({ username }) => { if (username === peerUsername) setIsPeerTyping(false); };
        const handleUserOnline = ({ userId }) => { if (userId === peerId) setIsPeerOnline(true); };
        const handleUserOffline = ({ userId }) => { if (userId === peerId) setIsPeerOnline(false); };

        const handleFriendshipUpdate = ({ peerId: updatedPeerId }) => {
            if (String(updatedPeerId) === String(peerId)) { 
                fetchData();
            }
        };

        socket.on('private message', handlePrivateMessage);
        socket.on('messages were read', handleMessagesRead);
        socket.on('user typing', handleTyping);
        socket.on('user stopped typing', handleStopTyping);
        socket.on('message_unsent', handleMessageUnsent);
        socket.on('message blocked', handleMessageBlocked);
        socket.on('user online', handleUserOnline); 
        socket.on('user offline', handleUserOffline);
        socket.on('friendship_update_needed', handleFriendshipUpdate); 

        return () => {
            socket.off('private message', handlePrivateMessage);
            socket.off('messages were read', handleMessagesRead);
            socket.off('user typing', handleTyping);
            socket.off('user stopped typing', handleStopTyping);
            socket.off('message_unsent', handleMessageUnsent);
            socket.off('message blocked', handleMessageBlocked);
            socket.off('user online', handleUserOnline);
            socket.off('user offline', handleUserOffline);
            socket.off('friendship_update_needed', handleFriendshipUpdate);
        };
    }, [socket, currentUser.id, peerUser?.id, peerUsername, setMessages, fetchData]);

    useEffect(() => {
        if (!peerUser?.id) return;

        // Fallback live sync for deployments where socket delivery can be unstable.
        const intervalId = setInterval(() => {
            fetchData();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [peerUser?.id, fetchData]);
    
    return { isPeerTyping, isPeerOnline, isSessionOutOfSync, isUploading, setIsUploading };
};
