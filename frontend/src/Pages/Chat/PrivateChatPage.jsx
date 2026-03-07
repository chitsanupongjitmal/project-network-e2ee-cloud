
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { usePrivateChat } from '../../hooks/usePrivateChat';

import ChatHeader from '../../Components/Chat/ChatHeader';
import MessageList from '../../Components/Chat/MessageList';
import MessageInput from '../../Components/Chat/MessageInput';
import ImageModal from '../../Components/Modals/ImageModal';
import { chatThemes } from '../../Data/themeData';



const SessionResetNotification = ({ onReset }) => (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 text-center" role="alert">
        <p className="font-bold">Security Key Changed</p>
        <p className="text-sm">Your contact has logged in on a new device. To protect your conversation, you need to refresh the secure session.</p>
        <button onClick={onReset} className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded">
            Refresh Session
        </button>
    </div>
);


const PrivateChatPage = ({ socket, currentUser, keyPair, peerKeyVersions, callUser, themeMode = 'light' }) => { 

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
        isUploading,
        currentTheme,
        handleThemeChange
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

    const isDark = themeMode === 'dark';

    return (
        <div className={`flex flex-col flex-1 h-full max-h-screen overflow-y-hidden ${isDark ? 'bg-black' : 'bg-white'}`}>
            {isSessionOutOfSync && <SessionResetNotification onReset={fetchData} />}

            <ChatHeader 
                chatPartner={peerUser} 
                themeMode={themeMode}
                onBlockUser={() => handleBlockUser(peerUser.id)}
                onAudioCall={startAudioCall}
                onDataChanged={fetchData}
                isBlockingPeer={isBlockedByMe}
                isBlocked={isBlockedByMe || hasBlockedMe}
                onChangeTheme={handleThemeChange}
            />

            <MessageList 
                messages={decryptedMessages} 
                currentUser={currentUser} 
                peerUser={peerUser}
                isPeerTyping={isPeerTyping}
                onImageClick={(src) => setViewingImage(src)}
                onUnsendMessage={handleUnsendMessage}
                onSetReply={setReplyingToMessage}
                themeMode={themeMode}
                backgroundStyle={chatThemes[currentTheme]?.style || chatThemes.default.style}
            />
            
            <div className={`w-full p-2 border-t ${isDark ? 'bg-black border-gray-800' : 'bg-white'}`}>
                 {(isBlockedByMe || hasBlockedMe) ? (
                    <div className={`p-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
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
                        themeMode={themeMode}
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
