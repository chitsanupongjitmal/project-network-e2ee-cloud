
import { useState, useCallback } from 'react';
import { SERVER_URL } from '../config';
import { encryptMessage } from '../utils/keyManager';
import { useChatData } from './private-chat/useChatData';
import { useChatEncryption } from './private-chat/useChatEncryption';
import { useChatSockets } from './private-chat/useChatSockets';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

export const usePrivateChat = (peerUsername, socket, currentUser, keyPair, peerKeyVersions, onlineFriends) => {

    const {
        messages, setMessages,
        peerUser,
        friendship,
        peerPublicKey,
        peerKeyVersion,
        isLoading,
        replyingToMessage, setReplyingToMessage,
        fetchData,
        error
    } = useChatData(peerUsername);

    const { isPeerTyping, isPeerOnline, isSessionOutOfSync, isUploading, setIsUploading } = useChatSockets(
        socket, currentUser, peerUser, peerUsername, setMessages,
        fetchData, peerKeyVersions, peerKeyVersion
    );

    const decryptedMessages = useChatEncryption(messages, keyPair, peerPublicKey, peerUser);

    const sendPrivateMessageViaApi = useCallback(async ({ encryptedPayload, toUserId, type, replyToMessageId }) => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${SERVER_URL}/api/chat/private/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ encryptedPayload, toUserId, type, replyToMessageId }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Failed to send message.');
        }
        return payload;
    }, []);

    const handleSendMessage = useCallback(async (text) => {
        if (!text.trim() || !peerPublicKey || !keyPair?.privateKey || !peerUser) return;
        try {
            const encryptedPayload = await encryptMessage(text, peerPublicKey, keyPair.privateKey);
            const client_id = `temp-${Date.now()}`;
            

            const tempMessage = {
                id: client_id, isTemp: true, decryptedText: text, sender_id: currentUser.id,
                sender: currentUser.username, timestamp: new Date().toISOString(), type: 'encrypted_text',
                reply_to_message_id: replyingToMessage?.id,
                repliedTo: replyingToMessage || null, 
            };

            setMessages(prev => [...prev, tempMessage]);
            const savedMessage = await sendPrivateMessageViaApi({
                encryptedPayload,
                toUserId: peerUser.id,
                type: 'encrypted_text',
                replyToMessageId: replyingToMessage?.id || null
            });
            setMessages(prev => prev.map(m => (
                m.id === client_id
                    ? { ...savedMessage, text: savedMessage.encryptedPayload, isTemp: false, repliedTo: m.repliedTo }
                    : m
            )));

            if (socket) {
                socket.emit('mark as read', { peerUsername });
            }
            setReplyingToMessage(null);
        } catch (err) {
            console.error("Failed to send message:", err);
            alert("Could not send the message.");
            setMessages(prev => prev.filter(m => m.id !== client_id));
        }
    }, [peerPublicKey, keyPair, peerUser, currentUser, replyingToMessage, setReplyingToMessage, setMessages, sendPrivateMessageViaApi, socket, peerUsername]);

    const handleSendFile = useCallback(async (file, caption = '') => {
        if (!peerPublicKey || !keyPair?.privateKey || !peerUser) {
            alert("Cannot send file: connection or encryption keys are not ready.");
            return;
        }

        setIsUploading(true);
        const client_id = `temp-file-${Date.now()}`;


        const tempMessage = {
            id: client_id, isTemp: true, sender_id: currentUser.id, sender: currentUser.username,
            timestamp: new Date().toISOString(),
            type: file.type.startsWith('image/') ? 'encrypted_image' : 'encrypted_file',
            fileInfo: {
                url: URL.createObjectURL(file), caption: caption, fileName: file.name
            },
            decryptedText: caption,
            reply_to_message_id: replyingToMessage?.id,
            repliedTo: replyingToMessage || null, 
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
            if (!uploadResponse.ok) throw new Error('File upload failed.');
            const uploadResult = await uploadResponse.json();

            const payload = { url: uploadResult.url, fileName: file.name, mimeType: file.type, caption: caption };
            const encryptedPayload = await encryptMessage(JSON.stringify(payload), peerPublicKey, keyPair.privateKey);
            const savedMessage = await sendPrivateMessageViaApi({
                encryptedPayload,
                toUserId: peerUser.id,
                type: file.type.startsWith('image/') ? 'encrypted_image' : 'encrypted_file',
                replyToMessageId: replyingToMessage?.id || null
            });
            setMessages(prev => prev.map(m => (
                m.id === client_id
                    ? { ...savedMessage, text: savedMessage.encryptedPayload, isTemp: false, repliedTo: m.repliedTo }
                    : m
            )));

        } catch (err) {
            console.error("Failed to send file:", err);
            alert("Could not send the file. Please try again.");
            setMessages(prev => prev.filter(m => m.id !== client_id));
        } finally {
            setIsUploading(false);
            setReplyingToMessage(null);
        }
    }, [peerUser, peerPublicKey, keyPair, currentUser, replyingToMessage, setMessages, setIsUploading, setReplyingToMessage, sendPrivateMessageViaApi]);

    const handleUnsendMessage = useCallback((message) => {
        if (socket && peerUser) {
            socket.emit('unsend_message', {
                messageId: message.id,
                chatType: 'private',
                targetId: peerUser.id
            });
        }
    }, [socket, peerUser]);

    const handleBlockUser = useCallback(async (userIdToBlock) => {
        const isBlocking = friendship?.status === 'blocked' && friendship.action_user_id === currentUser.id;
        
        const confirmMessage = isBlocking 
            ? `Are you sure you want to unblock ${peerUser.username}?`
            : `Are you sure you want to block ${peerUser.username}?`;
            
        if (!window.confirm(confirmMessage)) return;
        
        const endpoint = isBlocking ? `${SERVER_URL}/api/friends/unfriend` : `${SERVER_URL}/api/friends/block`;
        const body = isBlocking ? { friendId: userIdToBlock } : { userIdToBlock };
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(endpoint, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify(body) 
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || 'Failed to update status.');
            }
            await fetchData();
        } catch (err) {
            console.error(`Failed to update friendship status:`, err);
            alert(`Failed to update status: ${err.message}`);
        }
    }, [friendship, currentUser.id, peerUser, fetchData]);

    return {
        isLoading, error, peerUser, friendship, decryptedMessages, isPeerTyping,
        peerPublicKey, isSessionOutOfSync, handleSendMessage, handleSendFile,
        handleBlockUser, fetchData, handleUnsendMessage, replyingToMessage,
        setReplyingToMessage, isPeerOnline, isUploading
    };
};
