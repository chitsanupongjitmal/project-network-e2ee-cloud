
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Common/Sidebar';
import ChatListPage from '../Pages/Chat/ChatListPage';


const Layout = ({ user, onLogout, hasNewFriendRequest, socket, keyPair, decryptedGroupKeys, onKeyDecrypted }) => {

    const location = useLocation();


    const isAtChatListRoot = location.pathname === '/' || location.pathname.startsWith('/chats');

    return (

        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <Sidebar 
                user={user}
                onLogout={onLogout}
                hasNewFriendRequest={hasNewFriendRequest}
            />

            {}
            {}
            {}
            <aside className={`${isAtChatListRoot ? 'flex' : 'hidden'} sm:flex w-full sm:w-80 flex-shrink-0 flex-col bg-white border-r`}>
                {}
                <ChatListPage 
                    currentUser={user} 
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
            <main className={`${isAtChatListRoot ? 'hidden' : 'flex'} sm:flex flex-1 flex-col`}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;