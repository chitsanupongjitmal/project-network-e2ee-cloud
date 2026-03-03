import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';

const Avatar = ({ user, size = 'w-10 h-10' }) => {
    const username = user?.display_name || user?.username || 'User';

    return (
        <div className={`relative ${size} flex-shrink-0`}>
            <img
                src={defaultAvatar}
                alt={`${username} avatar`}
                className="w-full h-full rounded-full object-cover border-2 border-gray-200 bg-gray-300"
            />
        </div>
    );
};

export default Avatar;
