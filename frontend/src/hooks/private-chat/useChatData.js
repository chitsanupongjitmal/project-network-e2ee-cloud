
import { useState, useEffect, useCallback } from 'react';
import { SERVER_URL } from '../../config';
import { pemToDer } from '../../utils/keyManager';

const safeReadJson = async (res) => {  };

export const useChatData = (peerUsername) => {
    const [messages, setMessages] = useState([]);
    const [peerUser, setPeerUser] = useState(null);
    const [friendship, setFriendship] = useState(null);
    const [peerPublicKey, setPeerPublicKey] = useState(null);
    const [peerKeyVersion, setPeerKeyVersion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [error, setError] = useState(null);




    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setPeerPublicKey(null);

        try {
            const token = localStorage.getItem('token');
            const [historyRes, profileRes, keyRes] = await Promise.all([
                fetch(`${SERVER_URL}/api/chat/history/${peerUsername}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${SERVER_URL}/api/users/profile/${peerUsername}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${SERVER_URL}/api/keys/public/${peerUsername}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            ]);

            if (!profileRes.ok) throw new Error("Failed to fetch user profile.");
            if (!historyRes.ok) throw new Error("Failed to fetch chat history.");

            let keyData;
            let importedKey = null;
            if (keyRes.status === 404 || keyRes.status === 403) {
                 throw new Error(`Could not retrieve ${peerUsername}'s public key.`);
            } else if (keyRes.ok) {
                keyData = await keyRes.json();
                importedKey = await window.crypto.subtle.importKey('spki', pemToDer(keyData.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
                setPeerKeyVersion(keyData.keyVersion);
            }
            
            const profileData = await profileRes.json();
            const historyData = await historyRes.json();
            
            setMessages(historyData);
            setPeerUser(profileData.user);
            setFriendship(profileData.friendship);
            setPeerPublicKey(importedKey);
            
        } catch (err) {
            console.error("Failed to load chat data", err);
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [peerUsername]);


    useEffect(() => {
        if (peerUsername) {
            fetchData();
        }
    }, [peerUsername, fetchData]); 

    return {
        messages, setMessages,
        peerUser, setPeerUser,
        friendship, setFriendship,
        peerPublicKey, setPeerPublicKey,
        peerKeyVersion, setPeerKeyVersion,
        isLoading,
        replyingToMessage, setReplyingToMessage,
        fetchData,
        error
    };
};