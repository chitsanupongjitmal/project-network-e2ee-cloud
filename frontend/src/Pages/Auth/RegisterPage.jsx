import React, { useState } from 'react';
import { SERVER_URL } from '../../config';

const RegisterPage = ({ onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }
    try {
        const response = await fetch(`${SERVER_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to register');
        }
        alert('Registration successful! Please log in.');
        onSwitchToLogin();
    } catch (err) {
        setError(err.message);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center font-sans">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Register</h1>
        <p className="text-gray-600 mb-6">Create your account.</p>
        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button 
            type="submit"
            className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition"
          >
            Register
          </button>
        </form>
        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-blue-500 hover:underline">
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;