
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import Avatar from './Avatar';
import ChatsIcon from './Icons/ChatsIcon';
import FriendsIcon from './Icons/FriendsIcon';


const FeedIcon = ({ isActive }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h2m0 0h2" />
    </svg>
);


const SearchIcon = ({ isActive }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const AdminIcon = ({ isActive }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l3 3-3 3-3-3 3-3zm0 8l5 5H7l5-5z" />
    </svg>
);




const SettingsIcon = ({ isActive }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const LogoutIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
);


const Sidebar = ({ user, onLogout, hasNewFriendRequest }) => {
  const commonLinkClass = "flex items-center justify-center p-3 rounded-lg w-full transition-colors";
  const activeLinkStyle = "text-blue-500 bg-blue-100";
  const inactiveLinkStyle = "text-gray-600 hover:bg-gray-100";

  return (
    <aside className="w-20 bg-white border-r flex flex-col items-center py-4 h-screen flex-shrink-0 z-20">
      <Link to="/" className="mb-8"></Link>

      <nav className="flex-1 w-full px-2">
        <ul className="space-y-4">
          <li>
            <NavLink to="/chats" title="Chats" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
              {({ isActive }) => <ChatsIcon isActive={isActive} />}
            </NavLink>
          </li>
          <li>
            <NavLink to="/feed" title="Feed" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
              {({ isActive }) => <FeedIcon isActive={isActive} />}
            </NavLink>
          </li>
          <li className="relative">
            <NavLink to="/friends" title="Friends" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
              {({ isActive }) => <FriendsIcon isActive={isActive} />}
            </NavLink>
            {hasNewFriendRequest && (
              <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </li>
          <li>
             <NavLink to="/search" title="Search" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
              {({ isActive }) => <SearchIcon isActive={isActive} />}
            </NavLink>
          </li>
          {user?.role === 'super-admin' && (
            <li>
              <NavLink to="/admin/roles" title="Admin" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
                {({ isActive }) => <AdminIcon isActive={isActive} />}
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="w-full flex flex-col items-center space-y-4 px-2">
         <Link to={`/profile/${user.username}`} title="Profile">
            <Avatar user={user} size="w-10 h-10" />
         </Link>
         <NavLink to="/settings" title="Settings" className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkStyle : inactiveLinkStyle}`}>
            {({ isActive }) => <SettingsIcon isActive={isActive} />}
         </NavLink>
         <button onClick={onLogout} title="Logout" className={`${commonLinkClass} text-red-500 hover:bg-red-50`}>
            <LogoutIcon />
         </button>
      </div>
    </aside>
  );
};

export default Sidebar;
