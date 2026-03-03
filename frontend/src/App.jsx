import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';

import { getKeys, clearKeys, getAllGroupKeys, storeGroupKey } from './utils/keyManager';
import { SERVER_URL } from './config';

import Layout from './Components/Layout';
import LoginPage from './Pages/Auth/LoginPage';
import RegisterPage from './Pages/Auth/RegisterPage';
import SearchPage from './Pages/Search/SearchPage';
import ProfilePage from './Pages/Profile/ProfilePage';
import FriendsPage from './Pages/Friends/FriendsPage';
import PrivateChatPage from './Pages/Chat/PrivateChatPage';
import GroupChatPage from './Pages/Chat/GroupChatPage';
import SettingsPage from './Pages/Setting/SettingsPage';
import RoleManagementPage from './Pages/Admin/RoleManagementPage';
import FeedPage from './Pages/Feed/FeedPage';

import CallModal from './Components/Modals/CallModal';
import useWebRTC from './hooks/useWebRTC';

const App = () => {
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);
    const [hasNewFriendRequest, setHasNewFriendRequest] = useState(false);
    const navigate = useNavigate();
    const [keyPair, setKeyPair] = useState(null);
    const [peerKeyVersions, setPeerKeyVersions] = useState({});
    const [decryptedGroupKeys, setDecryptedGroupKeys] = useState({});

    const navigateRef = useRef(navigate);
    
    const { 
        remoteStream, 
        call, setCall, 
        callAccepted, setCallAccepted,
        callDuration, isMuted, isRemoteMuted, toggleMute,
        callUser, answerCall, endCall
    } = useWebRTC(socket, user);

    useEffect(() => {
        if (!socket || !user) return;
        
        const handleCallMade = (data) => {
             if (call) { 
                 socket.emit('busy', { to: data.callerId });
                 return;
             }
             setCall({
                isReceivingCall: true,
                peerId: data.callerId,
                remoteUsername: data.callerUsername,
                remoteAvatarUrl: data.callerAvatarUrl ?? null,
                ...data,
                callerHasVideo: !!data.callerHasVideo
             });
        };
        
        const handleCallEnded = () => {
        };
        
        socket.on('call-made', handleCallMade);
        socket.on('call-ended', handleCallEnded); 

        return () => {
            socket.off('call-made', handleCallMade);
            socket.off('call-ended', handleCallEnded); 
        };
    }, [socket, user, call, setCall]);

    const handleLogout = useCallback(async (forceNav = true) => {
        setSocket(currentSocket => {
            if (currentSocket) currentSocket.disconnect();
            return null;
        });
        await clearKeys();
        localStorage.clear();
        setToken(null);
        setUser(null);
        setKeyPair(null);
        setDecryptedGroupKeys({});
        setIsLoading(false);
        if (forceNav) navigateRef.current('/login');
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            if (token) {
                try {
                    const response = await fetch(`${SERVER_URL}/api/check-session`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (response.ok) {
                        const data = await response.json();
                        const keys = await getKeys();
                        const storedGroupKeys = await getAllGroupKeys();
                        if (keys) {
                            handleLoginSuccess(token, data.user);
                            setKeyPair(keys);
                            setDecryptedGroupKeys(storedGroupKeys);
                        } else {
                            await handleLogout(false);
                        }
                    } else {
                        await handleLogout(false);
                    }
                } catch (error) {
                    await handleLogout(false);
                }
            }
            setIsLoading(false);
        };
        checkSession();
    }, []); 

    useEffect(() => {
        if (token && user) {
            const socketTarget = SERVER_URL || undefined;
            const newSocket = io(socketTarget, {
                auth: { token },
                transports: ["websocket", "polling"]
            });
            setSocket(newSocket);

            newSocket.on('connect', () => console.log("Socket connected successfully with ID:", newSocket.id));
            newSocket.on('connect_error', (err) => {
                console.error("Socket connection error:", err.message);
                if (err.message.includes("Invalid token")) {
                    handleLogout();
                }
            });
            newSocket.on('new friend request', () => setHasNewFriendRequest(true));
            newSocket.on('key changed', ({ userId, newKeyVersion }) => {
                setPeerKeyVersions(prev => ({ ...prev, [userId]: newKeyVersion }));
            });

            return () => {
                newSocket.disconnect();
            };
        }
    }, [token, user, handleLogout]); 

    const handleLoginSuccess = (newToken, userData) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('username', userData.username);
        try {
            const decodedToken = jwtDecode(newToken);
            localStorage.setItem('userId', decodedToken.id);
            setUser({ id: decodedToken.id, ...userData });
            setToken(newToken);
        } catch (error) {
            console.log("Error decoding token:", error);
            handleLogout();
        }
    };
  
    const handleLogin = (newToken, userData, decryptedKeyPair) => {
        handleLoginSuccess(newToken, userData);
        setKeyPair(decryptedKeyPair);
        navigate('/');
    };

    const handleSettingsChange = (updates) => {
        if (updates.token) {
            localStorage.setItem('token', updates.token);
            setToken(updates.token);
        }
        if (updates.username) localStorage.setItem('username', updates.username);
        setUser(prevUser => ({ ...prevUser, ...updates }));
    };
  
    const handleKeyDecrypted = useCallback(async (groupId, key) => {
        setDecryptedGroupKeys(prev => ({ ...prev, [groupId]: key }));
        await storeGroupKey(groupId, key);
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }
  
    const WelcomeComponent = () => (
        <div className="flex-1 flex-col items-center justify-center h-full text-center text-gray-500 hidden sm:flex">
            <h2 className="mt-4 text-2xl font-bold">Welcome to Secure Chat</h2>
            <p>Select a chat to start messaging.</p>
        </div>
    );

    return (
      <>
        <Routes>
          {!token || !user ? (
            <>
              <Route path="/login" element={<LoginPage onLogin={handleLogin} onSwitchToRegister={() => navigate('/register')} />} />
              <Route path="/register" element={<RegisterPage onSwitchToLogin={() => navigate('/login')} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          ) : (
              <Route path="/" element={
                  <Layout 
                      user={user} 
                      onLogout={handleLogout} 
                      hasNewFriendRequest={hasNewFriendRequest} 
                      socket={socket} 
                      keyPair={keyPair} 
                      decryptedGroupKeys={decryptedGroupKeys}
                      onKeyDecrypted={handleKeyDecrypted} 
                  />
              }>
                <Route index element={<WelcomeComponent />} />
                <Route path="chat/:username" element={
                    <PrivateChatPage 
                        socket={socket} 
                        currentUser={user} 
                        keyPair={keyPair} 
                        peerKeyVersions={peerKeyVersions}
                        callUser={callUser}
                    />} 
                />
                <Route path="group/:groupId" element={<GroupChatPage socket={socket} currentUser={user} keyPair={keyPair} onKeyDecrypted={handleKeyDecrypted} decryptedGroupKeys={decryptedGroupKeys} />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="friends" element={<FriendsPage socket={socket} setHasNewFriendRequest={setHasNewFriendRequest} />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="profile/:username" element={<ProfilePage currentUser={user} socket={socket} />} />
               <Route path="settings" element={<SettingsPage currentUser={user} onSettingsChange={handleSettingsChange} />} />
                <Route path="admin/roles" element={user?.role === 'super-admin' ? <RoleManagementPage currentUser={user} /> : <Navigate to="/" />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Route>
          )}
        </Routes>

        {call && (
            <CallModal
                call={call}
                callAccepted={callAccepted}
                remoteStream={remoteStream}
                answerCall={answerCall}
                endCall={endCall}
                callDuration={callDuration}
                isMuted={isMuted}
                isRemoteMuted={isRemoteMuted}
                toggleMute={toggleMute}
            />
        )}
      </>
    );
};

export default App;
