import React, { useState, useEffect, useCallback } from 'react';
import { SERVER_URL } from '../../config';
import PostItem from '../../Components/Posts/PostItem';

const FeedPage = () => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFeed = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/posts/feed`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setPosts(data);
        } catch (error) {
            console.error("Failed to fetch feed", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    const handlePostUpdate = (updatedPost) => {
        setPosts(currentPosts => 
            currentPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
        );
    };

    if (isLoading) {
        return <p className="text-center mt-8">Loading feed...</p>;
    }

    return (
        <div className="max-w-2xl mx-auto p-4 font-sans">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">News Feed</h1>
            <div className="space-y-6">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <PostItem 
                            key={post.id} 
                            post={post}
                            onPostUpdate={handlePostUpdate}
                        />
                    ))
                ) : (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-md">
                        <p className="font-semibold">Your feed is empty.</p>
                        <p className="text-sm">Add some friends to see their posts here!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedPage;