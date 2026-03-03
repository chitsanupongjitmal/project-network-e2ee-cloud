
import React, { useRef, useEffect } from 'react';
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
    groupMemberMap
}) => {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isPeerTyping]);

    return (
        <main className="flex-1 p-4 overflow-y-auto bg-gray-50">
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
