import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';
import { SERVER_URL } from '../../config';

const resolveAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return defaultAvatar;
    if (
        avatarUrl === '/uploads/default-avatar.png' ||
        avatarUrl === '/uploads/default-avatar.svg'
    ) {
        return defaultAvatar;
    }
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
    if (avatarUrl.startsWith('/')) {
        return SERVER_URL ? `${SERVER_URL}${avatarUrl}` : avatarUrl;
    }
    return avatarUrl;
};

const Avatar = ({ user, size = 'w-10 h-10' }) => {
    const username = user?.display_name || user?.username || 'User';
    const src = resolveAvatarUrl(user?.avatar_url);

    return (
        <div className={`relative ${size} flex-shrink-0`}>
            <img
                src={src}
                alt={`${username} avatar`}
                className="w-full h-full rounded-full object-cover border-2 border-gray-200 bg-gray-300"
                onError={(e) => {
                    e.currentTarget.src = defaultAvatar;
                }}
            />
        </div>
    );
};

export default Avatar;
