import React from 'react';

const Header = ({ username, onLogout }) => (
  <header className="bg-white shadow-md p-4 sticky top-0 z-10 flex justify-between items-center">
    <div>
        <h1 className="text-xl font-bold text-gray-800">Real-time Chat Room</h1>
        <p className="text-sm text-gray-500 text-left">Welcome, <span className="font-semibold">{username}</span>!</p>
    </div>
    <button
        onClick={onLogout}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
    >
        Logout
    </button>
  </header>
);

export default Header;