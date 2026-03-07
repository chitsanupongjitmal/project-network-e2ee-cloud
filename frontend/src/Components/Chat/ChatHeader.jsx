
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../Common/Avatar';
import { SERVER_URL } from '../../config';
import { MoreVerticalIcon, LockIcon, UnlockIcon, PhoneIcon } from '../Common/Icons';
import ThemeMenu from '../Modals/ThemeMenu';

const ChatHeader = ({ chatPartner, onBlockUser, onAudioCall, onDataChanged, isBlockingPeer, isBlocked, onChangeTheme }) => {
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const isBlockedByPeer = isBlocked && !isBlockingPeer;
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
                setIsThemeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSetNickname = async () => {
        const newNickname = prompt("Enter a new nickname:", chatPartner.nickname || '');
        if (newNickname !== null) {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${SERVER_URL}/api/friends/nickname`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ friendId: chatPartner.id, nickname: newNickname.trim() })
                });
                onDataChanged();
                setIsMenuOpen(false);
            } catch (error) {
                console.error("Failed to set nickname", error);
                alert("Could not set nickname.");
            }
        }
    };

    const handleHideChat = async () => {
        if (!chatPartner?.username) {
            setIsMenuOpen(false);
            return;
        }
        const confirmHide = window.confirm(`Hide chat with ${chatPartner.username}? You can restore it from Settings later.`);
        if (!confirmHide) {
            setIsMenuOpen(false);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/chat/history/${encodeURIComponent(chatPartner.username)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Failed to hide chat.');
            }
            alert(`Chat with ${chatPartner.username} hidden. You can unhide it from Settings.`);
            navigate('/');
        } catch (error) {
            console.error("Failed to hide chat", error);
            alert("Could not hide chat.");
        } finally {
            setIsMenuOpen(false);
        }
    };

    if (!chatPartner) return <header className="bg-white shadow-sm p-3 border-b h-[68px] flex-shrink-0"></header>;

    const nickname = chatPartner.nickname || null;
    const displayName = chatPartner.display_name || null;
    const username = chatPartner.username || '';
    const primaryName = nickname || displayName || username;
    const secondaryPieces = [];
    if (nickname && displayName && displayName !== nickname) {
        secondaryPieces.push(displayName);
    } else if (!nickname && displayName && displayName !== username) {
        secondaryPieces.push(displayName);
    }
    if (username) {
        secondaryPieces.push(`@${username}`);
    }
    const secondaryLine = secondaryPieces.filter(Boolean).join(' \u2022 ');
    
    return (
        <header className="bg-white shadow-sm p-3 border-b flex-shrink-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Link to={`/profile/${chatPartner.username}`} className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-100">
                        <Avatar user={chatPartner} size="w-10 h-10" />
                        <div>
                            <h1 className="text-xl font-bold">{primaryName}</h1>
                            {secondaryLine && (
                                <p className="text-xs text-gray-500">{secondaryLine}</p>
                            )}
                            <p className="text-xs text-green-500 flex items-center mt-0.5"><LockIcon className="h-4 w-4 text-green-500" /> <span className="ml-1">Secure Chat</span></p>
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onAudioCall}
                        title={isBlocked ? "Cannot call a blocked user" : "Start Audio Call"}
                        className={`p-1 ${isBlocked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-500'}`}
                        disabled={isBlocked}
                    >
                        <PhoneIcon />
                    </button>
                    
                    <div className="relative" ref={menuRef}> 
                        <button
                            type="button"
                            onClick={() => {
                                setIsMenuOpen(prev => !prev);
                                if (isMenuOpen) setIsThemeMenuOpen(false);
                            }}
                            className="p-1 rounded-full hover:bg-gray-100"
                        >
                            <MoreVerticalIcon />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border py-1">
                                {isThemeMenuOpen ? (
                                    <ThemeMenu
                                        onSelectTheme={async (themeKey) => {
                                            try {
                                                if (onChangeTheme) await onChangeTheme(themeKey);
                                            } catch (error) {
                                                alert(error.message || 'Failed to update theme.');
                                            } finally {
                                                setIsThemeMenuOpen(false);
                                                setIsMenuOpen(false);
                                            }
                                        }}
                                        onClose={() => {
                                            setIsThemeMenuOpen(false);
                                            setIsMenuOpen(false);
                                        }}
                                    />
                                ) : (
                                    <ul>
                                        <li>
                                            <button
                                                onClick={() => setIsThemeMenuOpen(true)}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Change Theme
                                            </button>
                                        </li>
                                        <li><button onClick={() => { handleSetNickname(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Set Nickname</button></li>
                                        <li><Link to={`/profile/${chatPartner.username}`} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">View Profile</Link></li>
                                        <li><button onClick={handleHideChat} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Hide Chat</button></li>
                                        <li>
                                            {isBlockedByPeer ? (
                                                <div className="w-full flex items-start gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed">
                                                    <LockIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                    <span>คุณถูกบล็อค ไม่สามารถบล็อคกลับได้</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { onBlockUser(); setIsMenuOpen(false); }}
                                                    className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm ${isBlockingPeer ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                                                >
                                                    {isBlockingPeer ? <UnlockIcon className="h-4 w-4 text-green-600" /> : <LockIcon className="h-4 w-4 text-red-600" />}
                                                    {isBlockingPeer ? `Unblock ${chatPartner.username}` : `Block ${chatPartner.username}`}
                                                </button>
                                            )}
                                        </li>
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default ChatHeader;
