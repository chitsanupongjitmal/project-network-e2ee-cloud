import React, { useState } from 'react';


const JoinPage = ({ onJoin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center font-sans">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h1>
        <p className="text-gray-600 mb-6">Enter your name to join the chat.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            required
            autoFocus
          />
          <button 
            type="submit"
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-md hover:shadow-lg"
          >
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinPage;