import React, { useState, useEffect, useRef } from 'react';
import Message from '../../Components/Common/Message';
import MessageInput from '../../Components/Common/MessageInput';

const ChatPage = ({ socket }) => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join public chat');

    const handleHistory = (history) => setMessages(history);
    const handleMessage = (msg) => setMessages(prev => [...prev, msg]);

    socket.on('load public history', handleHistory);
    socket.on('public message', handleMessage);

    return () => {
      socket.off('load public history', handleHistory);
      socket.off('public message', handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (text) => {
    if (socket) {
      socket.emit('public message', { text });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="bg-white shadow-sm p-4 border-b">
        <h1 className="text-xl font-bold">Public Chat Room</h1>
      </header>
      <main className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <Message key={index} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatPage;