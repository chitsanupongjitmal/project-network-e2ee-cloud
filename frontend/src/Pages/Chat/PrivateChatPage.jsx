
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { usePrivateChat } from '../../hooks/usePrivateChat';

import ChatHeader from '../../Components/Chat/ChatHeader';
import MessageList from '../../Components/Chat/MessageList';
import MessageInput from '../../Components/Chat/MessageInput';
import ImageModal from '../../Components/Modals/ImageModal';



const SessionResetNotification = ({ onReset }) => (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 text-center" role="alert">
        <p className="font-bold">Security Key Changed</p>
        <p className="text-sm">Your contact has logged in on a new device. To protect your conversation, you need to refresh the secure session.</p>
        <button onClick={onReset} className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded">
            Refresh Session
        </button>
    </div>
);


const PrivateChatPage = ({ socket, currentUser, keyPair, peerKeyVersions, callUser }) => { 

    const { username: peerUsername } = useParams();
    const [viewingImage, setViewingImage] = useState(null);
    const autoCallStartedRef = useRef(false);

    const {
        isLoading,
        error,
        peerUser,
        friendship,
        decryptedMessages,
        isPeerTyping,
        isSessionOutOfSync,
        handleSendMessage,
        handleSendFile,
        handleBlockUser,
        fetchData,
        handleUnsendMessage,
        replyingToMessage,
        setReplyingToMessage,
        isUploading
    } = usePrivateChat(peerUsername, socket, currentUser, keyPair, peerKeyVersions);


    

    const isBlockedByMe = friendship?.status === 'blocked' && friendship.action_user_id === currentUser.id;
    const hasBlockedMe = friendship?.status === 'blocked' && friendship.action_user_id !== currentUser.id;

    const startAudioCall = useCallback(() => {
        if (!peerUser) return;

        if (isBlockedByMe) {
            alert(`Unblock ${peerUser.username} before starting a call.`);
            return;
        }
        if (hasBlockedMe) {
            alert(`${peerUser.username} has blocked you. Calls are disabled.`);
            return;
        }

        callUser(peerUser.id, 'audio', {
            username: peerUser.username,
            displayName: peerUser.nickname || peerUser.display_name || peerUser.username,
            avatarUrl: peerUser.avatar_url || null,
        });
    }, [peerUser, callUser, isBlockedByMe, hasBlockedMe]);

    useEffect(() => {
        if (!peerUser || autoCallStartedRef.current) return;
        const pendingCallUser = localStorage.getItem('pendingCallUser');
        if (!pendingCallUser) return;

        if (pendingCallUser.toLowerCase() === String(peerUsername || '').toLowerCase()) {
            autoCallStartedRef.current = true;
            localStorage.removeItem('pendingCallUser');
            startAudioCall();
        }
    }, [peerUser, peerUsername, startAudioCall]);


    if (isLoading && !peerUser) {  }
    if (error && !peerUser) {  }
    if (!peerUser) {  }
    const handleTyping = (action) => {
        if (socket && peerUser) socket.emit(action === 'start' ? 'start typing' : 'stop typing', { toUserId: peerUser.id });
    };

    const handleSend = (text, file) => {
        if (file) {
            handleSendFile(file, text);
        } else if (text.trim()) {
            handleSendMessage(text);
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full max-h-screen overflow-y-hidden bg-white">
            {isSessionOutOfSync && <SessionResetNotification onReset={fetchData} />}

            <ChatHeader 
                chatPartner={peerUser} 
                onBlockUser={() => handleBlockUser(peerUser.id)}
                onAudioCall={startAudioCall}
                onDataChanged={fetchData}
                isBlockingPeer={isBlockedByMe}
                isBlocked={isBlockedByMe || hasBlockedMe}
            />

            <MessageList 
                messages={decryptedMessages} 
                currentUser={currentUser} 
                peerUser={peerUser}
                isPeerTyping={isPeerTyping}
                onImageClick={(src) => setViewingImage(src)}
                onUnsendMessage={handleUnsendMessage}
                onSetReply={setReplyingToMessage}
            />
            
            <div className="w-full bg-white p-2 border-t">
                 {(isBlockedByMe || hasBlockedMe) ? (
                    <div className="p-4 text-center text-gray-500">
                        {isBlockedByMe
                            ? `You have blocked ${peerUsername}.`
                            : `คุณถูกบล็อคโดย ${peerUsername} ไม่สามารถส่งข้อความ โทร หรือบล็อคกลับได้`}
                    </div>
                ) : (
                    <MessageInput 
                        onSend={handleSend}
                        onTyping={handleTyping}
                        replyingTo={replyingToMessage}
                        onCancelReply={() => setReplyingToMessage(null)}
                        isInputDisabled={isUploading}
                    />
                )}
            </div>

            {}

            <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />
        </div>
    );
};

export default PrivateChatPage;
