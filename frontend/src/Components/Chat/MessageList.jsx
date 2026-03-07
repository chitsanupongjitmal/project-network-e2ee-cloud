
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import Message from '../Common/Message';

const MessageList = ({
    messages,
    currentUser,
    isPeerTyping,
    onImageClick,
    onUnsendMessage,
    onSetReply,
    peerUser,
    isGroupChat = false,
    groupMemberMap,
    backgroundStyle
}) => {
    const containerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const SCROLL_BOTTOM_THRESHOLD = 120;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

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
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isPeerTyping]);

    return (
        <main
            ref={containerRef}
            className="flex-1 p-4 overflow-y-auto custom-scrollbar"
            style={backgroundStyle || { background: '#F9FAFB' }}
        >
            {messages.map((msg) => (
                <Message
                    key={msg.id}
                    msg={msg}
                    currentUser={currentUser}
                    peerUser={peerUser}
                    onImageClick={onImageClick}
                    onUnsendMessage={onUnsendMessage}
                    onSetReply={onSetReply}
                    isGroupChat={isGroupChat}
                    groupMemberMap={groupMemberMap}
                />
            ))}

            {isPeerTyping && (
                <div className="flex justify-start mb-4">
                    <div className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 rounded-bl-none">
                        <p className="text-sm italic">is typing...</p>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </main>
    );
};

export default MessageList;
