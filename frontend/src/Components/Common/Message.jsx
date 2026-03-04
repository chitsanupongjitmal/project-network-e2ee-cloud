
import React, { useState, useEffect, useRef } from 'react';
import { getRoleMeta } from '../../utils/roleLabels';


const SecureImage = ({ fileInfo, conversationType, conversationId, onImageClick }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            if (!fileInfo || !fileInfo.url || !conversationType || !conversationId) return;
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error("No auth token");

                const filename = fileInfo.url.split('/').pop();
                const res = await fetch(`/api/chat/secure-download/${filename}?conversationType=${conversationType}&conversationId=${conversationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
                
                const blob = await res.blob();
                if (isMounted) setImageUrl(URL.createObjectURL(blob));
            } catch (err) {
                if (isMounted) setError("Could not load image.");
            }
        };

        if (fileInfo.url.startsWith('blob:')) {
            setImageUrl(fileInfo.url);
        } else {
            fetchImage();
        }

        return () => {
            isMounted = false;
            if (imageUrl && !fileInfo.url.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [fileInfo, conversationType, conversationId]);

    if (error) return <div className="p-3 text-red-100 bg-red-500/20 rounded-lg text-sm">{error}</div>;
    if (!imageUrl) return <div className="p-3 text-gray-400 animate-pulse text-sm">Loading image...</div>;
    
    return (
        <img
            src={imageUrl}
            alt={fileInfo.caption || "Encrypted Image"}
            className="max-w-xs md:max-w-sm rounded-lg cursor-pointer"
            onClick={() => onImageClick(imageUrl)}
        />
    );
};


const SecureFileLink = ({ fileInfo, conversationType, conversationId, isSender }) => {
    const [fileUrl, setFileUrl] = useState(null);
    const [isFetching, setIsFetching] = useState(false);
    const linkColor = isSender ? 'text-white hover:text-gray-200' : 'text-blue-600 hover:text-blue-800';

    const handleDownload = async (e) => {
        if (fileUrl) return;
        e.preventDefault();
        setIsFetching(true);
        try {
            const token = localStorage.getItem('token');
            const filename = fileInfo.url.split('/').pop();
            const res = await fetch(`/api/chat/secure-download/${filename}?conversationType=${conversationType}&conversationId=${conversationId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            setFileUrl(blobUrl);


            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', fileInfo.fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Could not download the file.");
        } finally {
            setIsFetching(false);
        }
    };
    
    useEffect(() => {
        return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); };
    }, [fileUrl]);

    return (
        <a 
            href={fileUrl || '#'} 
            onClick={handleDownload}
            className={`flex items-center gap-2 ${linkColor} hover:underline cursor-pointer`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 5a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 5a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
            <span>{isFetching ? 'Loading...' : (fileInfo.fileName || 'Encrypted File')}</span>
        </a>
    );
}

const SecureVideo = ({ fileInfo, conversationType, conversationId }) => {
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        let createdUrl = null;

        const fetchVideo = async () => {
            if (!fileInfo || !fileInfo.url || !conversationType || !conversationId) return;
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error("No auth token");

                const filename = fileInfo.url.split('/').pop();
                const res = await fetch(`/api/chat/secure-download/${filename}?conversationType=${conversationType}&conversationId=${conversationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);

                const blob = await res.blob();
                createdUrl = URL.createObjectURL(blob);
                if (isMounted) setVideoUrl(createdUrl);
            } catch (_err) {
                if (isMounted) setError("Could not load video.");
            }
        };

        if (fileInfo.url.startsWith('blob:')) {
            setVideoUrl(fileInfo.url);
        } else {
            fetchVideo();
        }

        return () => {
            isMounted = false;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [fileInfo, conversationType, conversationId]);

    if (error) return <div className="p-3 text-red-100 bg-red-500/20 rounded-lg text-sm">{error}</div>;
    if (!videoUrl) return <div className="p-3 text-gray-400 animate-pulse text-sm">Loading video...</div>;

    return (
        <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="max-w-xs md:max-w-sm rounded-lg bg-black"
        />
    );
};

const ReplyPreview = ({ message, isGroupChat, currentUser, peerUser }) => {
    if (!message) return null;

    const replySenderIdentifier = message.sender_id ?? message.senderId ?? message.user_id ?? message.userId ?? null;
    const currentUserId = currentUser?.id ?? null;
    const isReplyFromCurrentUser =
        replySenderIdentifier !== null &&
        currentUserId !== null &&
        String(replySenderIdentifier) === String(currentUserId);

    const senderLabel = isReplyFromCurrentUser
        ? 'You'
        : (message.sender
            || message.sender_name
            || message.nickname
            || message.display_name
            || (isGroupChat
                ? message.senderUsername
                : (peerUser?.nickname || peerUser?.display_name || peerUser?.username))
            || 'Unknown');

    const messageType = message.type || message.message_type;
    const isImageReply = messageType?.includes('image');
    const isFileReply = messageType?.includes('file');

    const rawText = message.decryptedText ?? message.text ?? '';
    let parsedFileInfo = message.fileInfo;

    if (!parsedFileInfo && typeof rawText === 'string') {
        const trimmed = rawText.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('{"')) {
            try {
                const maybeJson = JSON.parse(trimmed);
                if (maybeJson && typeof maybeJson === 'object' && maybeJson.url) {
                    parsedFileInfo = maybeJson;
                }
            } catch (err) {

            }
        }
    }

    const fileInfo = parsedFileInfo;

    let previewText = typeof rawText === 'string' ? rawText : '';
    if (fileInfo && previewText) {
        const trimmed = previewText.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('["') || trimmed.startsWith('{\"')) {
            previewText = '';
        }
    }

    if (!previewText) {
        if (isImageReply) {
            previewText = fileInfo?.caption || 'Photo';
        } else if (isFileReply) {
            previewText = fileInfo?.fileName || 'Attachment';
        }
    }

    if (message.is_unsent) {
        previewText = 'This message was unsent';
    }

    const replyIcon = isImageReply ? '🖼️' : (isFileReply ? '📎' : '💬');

    return (
        <div className="flex items-start gap-2 px-3 py-2 mb-1 border-l-4 border-blue-400 bg-blue-50 rounded-t-xl rounded-br-xl text-xs text-blue-900">
            <div className="flex-shrink-0 mt-0.5">
                {replyIcon}
            </div>
            <div className="min-w-0">
                <p className="font-semibold text-blue-600 truncate">{senderLabel}</p>
                <p className="truncate text-[11px]">{previewText}</p>
            </div>
        </div>
    );
};


const Message = ({ msg, currentUser, onImageClick, onUnsendMessage, onSetReply, isGroupChat, peerUser, groupMemberMap }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const senderIdentifier = msg.sender_id ?? msg.senderId ?? msg.sender?.id ?? msg.user_id ?? msg.userId ?? null;
    const currentUserId = currentUser?.id ?? null;
    const isSender = currentUserId !== null && senderIdentifier !== null && String(senderIdentifier) === String(currentUserId);
    const participantInfo = isGroupChat && groupMemberMap ? groupMemberMap[senderIdentifier] : null;

    const senderDisplayName = isSender
        ? (currentUser?.display_name || currentUser?.nickname || currentUser?.username || 'You')
        : (participantInfo?.nickname
            || participantInfo?.display_name
            || participantInfo?.username
            || peerUser?.nickname
            || peerUser?.display_name
            || peerUser?.username
            || msg.sender
            || 'Unknown');

    const derivedPeerIdentifier =
        peerUser?.id
        ?? msg.peer_id
        ?? msg.peerId
        ?? msg.receiver_id
        ?? msg.receiverId
        ?? msg.other_user_id
        ?? msg.otherUserId
        ?? msg.target_id
        ?? msg.targetId
        ?? msg.conversation_partner_id
        ?? msg.conversationPartnerId
        ?? null;

    const groupConversationId =
        msg.group_id
        ?? msg.groupId
        ?? msg.conversation_id
        ?? msg.conversationId
        ?? msg.target_group_id
        ?? msg.targetGroupId
        ?? null;

    const groupRoleSource =
        participantInfo?.group_role
        ?? participantInfo?.member_role
        ?? participantInfo?.role
        ?? msg.sender_role
        ?? msg.senderRole
        ?? msg.sender_role_name
        ?? msg.senderRole
        ?? msg.role
        ?? msg.sender?.role
        ?? null;

    const privateRoleSource = isSender ? currentUser?.role : (peerUser?.role ?? msg.role ?? msg.sender_role ?? null);

    const roleSource = isGroupChat ? groupRoleSource : privateRoleSource;
    const roleMeta = getRoleMeta(roleSource);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (msg.is_unsent) {
            setIsMenuOpen(false);
        }
    }, [msg.is_unsent]);

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (msg.isTemp || msg.is_unsent) return;
        setIsMenuOpen(true);
    };

    const renderContent = () => {
        if (msg.is_unsent) return <p className="text-sm italic p-3 text-gray-500">🗑️ This message was unsent</p>;
        if (msg.error) return <p className="text-base break-words p-3">{msg.error}</p>;

        const conversationType = isGroupChat ? 'group' : 'private';
        const privateConversationId = isSender ? derivedPeerIdentifier : (senderIdentifier ?? derivedPeerIdentifier);
        const conversationId = isGroupChat ? groupConversationId : privateConversationId;
        const hasSecureContext = Boolean(conversationType && conversationId);


        const messageType = msg.type || msg.message_type;


        if (messageType?.includes('image') && msg.fileInfo?.url) {
            if (!hasSecureContext && !msg.fileInfo.url.startsWith('blob:')) {
                return <p className="text-sm italic p-3 text-gray-500">Image unavailable.</p>;
            }
            return (
                <div className="p-1">
                    <SecureImage
                        fileInfo={msg.fileInfo}
                        conversationType={conversationType}
                        conversationId={conversationId}
                        onImageClick={onImageClick}
                    />
                    {msg.fileInfo.caption && <p className="text-sm mt-2 p-2">{msg.fileInfo.caption}</p>}
                </div>
            );
        }
        
        if (messageType?.includes('file') && msg.fileInfo?.url) {
            if (!hasSecureContext && !msg.fileInfo.url.startsWith('blob:')) {
                return <p className="text-sm italic p-3 text-gray-500">Attachment unavailable.</p>;
            }

            const mimeType = (msg.fileInfo.mimeType || '').toLowerCase();
            const fileName = (msg.fileInfo.fileName || '').toLowerCase();
            const isVideoFile = mimeType.startsWith('video/') || /\.(mp4|mov|webm|m4v|ogg)$/i.test(fileName);

            if (isVideoFile) {
                return (
                    <div className="p-1">
                        <SecureVideo
                            fileInfo={msg.fileInfo}
                            conversationType={conversationType}
                            conversationId={conversationId}
                        />
                        {msg.fileInfo.caption && <p className="text-sm mt-2 p-2">{msg.fileInfo.caption}</p>}
                    </div>
                );
            }

            if (msg.fileInfo.url.startsWith('blob:')) {
                return (
                    <div className="p-3">
                        <div className={`flex items-center gap-2 ${isSender ? 'text-white' : 'text-gray-700'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 5a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 5a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                            <span>{msg.fileInfo.fileName || 'File'}</span>
                        </div>
                        {msg.fileInfo.caption && <p className="text-sm mt-2">{msg.fileInfo.caption}</p>}
                    </div>
                );
            }
            return (
                <div className="p-3">
                    <SecureFileLink
                        fileInfo={msg.fileInfo}
                        conversationType={conversationType}
                        conversationId={conversationId}
                        isSender={isSender}
                    />
                    {msg.fileInfo.caption && <p className="text-sm mt-2">{msg.fileInfo.caption}</p>}
                </div>
            );
        }
        
        const isEncryptedText = typeof messageType === 'string' && messageType.startsWith('encrypted');
        const hasDecryptedText = typeof msg.decryptedText === 'string' && msg.decryptedText.length > 0;

        if (isEncryptedText && !msg.isTemp && !hasDecryptedText) {
            return <p className="text-base break-words p-3 italic text-gray-500">Decrypting...</p>;
        }

        const fallbackText = msg.decryptedText ?? msg.text ?? '';
        return <p className="text-base break-words p-3 whitespace-pre-wrap">{fallbackText}</p>;
    };
    
    const alignClass = isSender ? 'justify-end' : 'justify-start';
    const bubbleClass = isSender ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none';
    const timestampDate = msg.timestamp ? new Date(msg.timestamp) : null;
    const formattedTimestamp = (timestampDate && !Number.isNaN(timestampDate.getTime()))
        ? timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    const shouldShowMeta = !msg.is_unsent && (formattedTimestamp || isSender);

    return (
        <div onContextMenu={handleContextMenu} className="relative group">
            <div className={`flex ${alignClass} mb-4`}>
                <div className="flex flex-col max-w-full">
                    <div className={`flex ${isSender ? 'justify-end pr-2' : 'justify-start pl-2'} mb-1`}>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-semibold">
                                {isSender ? (isGroupChat ? senderDisplayName : 'You') : senderDisplayName}
                            </span>
                            {roleMeta && (
                                <span className={`px-2 py-0.5 rounded-full ${roleMeta.classes} uppercase tracking-wide`}>
                                    {roleMeta.label}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={`rounded-xl max-w-sm md:max-w-xl ${bubbleClass}`}>
                        {!msg.is_unsent && (
                            <ReplyPreview
                                message={msg.repliedTo}
                                isGroupChat={isGroupChat}
                                currentUser={currentUser}
                                peerUser={peerUser}
                            />
                        )}
                        {renderContent()}
                        {shouldShowMeta && (
                            <p className={`text-xs text-right mt-1 pr-3 pb-2 pt-1 ${isSender ? 'text-blue-200' : 'text-gray-500'}`}>
                                {formattedTimestamp && <span>{formattedTimestamp}</span>}
                                {isSender && !msg.isTemp && (
                                    <span className={`ml-1 text-xs font-semibold ${msg.is_read ? 'text-green-300' : 'text-blue-200'}`}>
                                        {msg.is_read ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            {isMenuOpen && (
                <div ref={menuRef} className={`absolute z-20 ${isSender ? 'right-0' : 'left-0'} top-0 -mt-2`}>
                    <div className="bg-white rounded-md shadow-lg border py-1 w-48">
                        <ul>
                            <li><button onClick={() => { onSetReply(msg); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Reply</button></li>
                            {isSender && <li><button onClick={() => { onUnsendMessage(msg); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Unsend Message</button></li>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Message;
