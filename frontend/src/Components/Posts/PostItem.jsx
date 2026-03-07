
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Avatar from '../Common/Avatar';
import { getRoleMeta } from '../../utils/roleLabels';

const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (imageUrl.startsWith('/')) return `${SERVER_URL}${imageUrl}`;
    return imageUrl;
};

const PostItem = ({ post, onPostUpdate }) => {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const roleMeta = getRoleMeta(post.role);

    const handleLike = async () => {
        const token = localStorage.getItem('token');
        await fetch(`${SERVER_URL}/api/posts/${post.id}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        onPostUpdate({
            ...post,
            like_count: post.liked_by_user ? post.like_count - 1 : post.like_count + 1,
            liked_by_user: !post.liked_by_user,
        });
    };

    const fetchComments = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${SERVER_URL}/api/posts/${post.id}/comments`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setComments(data);
    };

    const handleToggleComments = () => {
        if (!showComments) {
            fetchComments();
        }
        setShowComments(!showComments);
    };
    
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        const token = localStorage.getItem('token');
        await fetch(`${SERVER_URL}/api/posts/${post.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content: newComment })
        });
        setNewComment('');
        fetchComments();
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center gap-3 mb-4">
                <Link to={`/profile/${post.username}`}>
                    <Avatar user={post} size="w-10 h-10" />
                </Link>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <Link to={`/profile/${post.username}`} className="font-bold hover:underline">
                            {post.username}
                        </Link>
                        {roleMeta && (
                            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${roleMeta.classes}`}>
                                {roleMeta.label}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
                </div>
            </div>
            {}

            {post.content && (
                <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
            )}
            {post.image_url && (
                <img
                    src={resolveImageUrl(post.image_url)}
                    alt="Post"
                    className="w-full max-h-[420px] object-cover rounded-lg mb-4 border"
                    loading="lazy"
                />
            )}
            <div className="flex items-center gap-4 text-gray-500 border-t pt-2">
                <button onClick={handleLike} className={`flex items-center gap-1 hover:text-blue-500 ${post.liked_by_user ? 'text-blue-500 font-bold' : ''}`}>
                    👍 Like ({post.like_count})
                </button>
                <button onClick={handleToggleComments} className="flex items-center gap-1 hover:text-blue-500">
                    💬 Comment
                </button>
            </div>
            {showComments && (
                <div className="mt-4 pt-4 border-t">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex items-start gap-2 mb-3">
                            <Avatar user={comment} size="w-8 h-8" />
                            <div className="bg-gray-100 p-2 rounded-lg flex-1">
                                <p>
                                    <span className="font-bold">{comment.username}</span>{' '}
                                    <span className="text-gray-800">{comment.content}</span>
                                </p>
                            </div>
                        </div>
                    ))}
                    <form onSubmit={handleAddComment} className="flex items-center gap-2 mt-4">
                        <input 
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="flex-1 px-3 py-2 bg-gray-100 rounded-full focus:outline-none"
                        />
                        <button type="submit" className="text-blue-500 font-semibold">Post</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default PostItem;
