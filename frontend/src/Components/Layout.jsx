
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Common/Sidebar';
import ChatListPage from '../Pages/Chat/ChatListPage';


const Layout = ({ user, onLogout, hasNewFriendRequest, themeMode, socket, keyPair, decryptedGroupKeys, onKeyDecrypted }) => {

    const location = useLocation();


    const isAtChatListRoot = location.pathname === '/' || location.pathname.startsWith('/chats');

    return (

        <div className={`flex h-[100dvh] overflow-hidden safe-bottom ${themeMode === 'dark' ? 'bg-black' : 'bg-gray-100'}`}>
            <Sidebar 
                user={user}
                onLogout={onLogout}
                hasNewFriendRequest={hasNewFriendRequest}
                themeMode={themeMode}
            />

            {}
            {}
            {}
            <aside className={`${isAtChatListRoot ? 'flex' : 'hidden'} sm:flex w-full sm:w-80 flex-shrink-0 flex-col border-r ${themeMode === 'dark' ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
                {}
                <ChatListPage 
                    currentUser={user} 
                    themeMode={themeMode}
                    socket={socket} 
                    keyPair={keyPair} 
                    decryptedGroupKeys={decryptedGroupKeys} 
                    onKeyDecrypted={onKeyDecrypted} 
                />
                {}
            </aside>

            {}
            {}
            {}
            <main className={`${isAtChatListRoot ? 'hidden' : 'flex'} sm:flex flex-1 flex-col ${themeMode === 'dark' ? 'bg-black' : 'bg-white'}`}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
