import React, { useState, useEffect, useCallback } from 'react';
import { SERVER_URL } from '../../config';
import PostItem from '../../Components/Posts/PostItem';

const FeedPage = () => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [postText, setPostText] = useState('');
    const [postImageFile, setPostImageFile] = useState(null);
    const [postImagePreview, setPostImagePreview] = useState('');
    const [isPosting, setIsPosting] = useState(false);

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (err) => reject(err);
    });

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

    useEffect(() => {
        return () => {
            if (postImagePreview) URL.revokeObjectURL(postImagePreview);
        };
    }, [postImagePreview]);

    const handlePostUpdate = (updatedPost) => {
        setPosts(currentPosts => 
            currentPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
        );
    };

    const handleSelectImage = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        const maxBytes = 10 * 1024 * 1024;
        if (file.size > maxBytes) {
            alert('Image too large. Max size is 10MB.');
            return;
        }
        setPostImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setPostImagePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return previewUrl;
        });
    };

    const clearSelectedImage = () => {
        setPostImageFile(null);
        setPostImagePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return '';
        });
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (isPosting) return;
        if (!postText.trim() && !postImageFile) {
            alert('Please add text or image before posting.');
            return;
        }

        setIsPosting(true);
        try {
            const token = localStorage.getItem('token');
            const payload = { content: postText.trim() };

            if (postImageFile) {
                payload.imageData = await fileToBase64(postImageFile);
                payload.imageMimeType = postImageFile.type;
                payload.imageOriginalName = postImageFile.name;
            }

            const response = await fetch(`${SERVER_URL}/api/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to create post.');
            }

            if (data.post) {
                setPosts((prev) => [data.post, ...prev]);
            } else {
                await fetchFeed();
            }
            setPostText('');
            clearSelectedImage();
        } catch (error) {
            console.error("Failed to create post", error);
            alert(error.message || 'Failed to create post.');
        } finally {
            setIsPosting(false);
        }
    };

    if (isLoading) {
        return <p className="text-center mt-8">Loading feed...</p>;
    }

    return (
        <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto p-3 sm:p-4 font-sans pb-24 sm:pb-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">News Feed</h1>

            <form onSubmit={handleCreatePost} className="bg-white p-4 rounded-lg shadow-md mb-6 space-y-3">
                <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="What's on your mind?"
                    rows={3}
                />

                {postImagePreview && (
                    <div className="relative">
                        <img src={postImagePreview} alt="post preview" className="w-full max-h-80 object-cover rounded-lg border" />
                        <button
                            type="button"
                            onClick={clearSelectedImage}
                            className="absolute top-2 right-2 bg-black/70 text-white rounded-full h-8 w-8 flex items-center justify-center"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-sm cursor-pointer">
                        Add Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleSelectImage} disabled={isPosting} />
                    </label>
                    <button
                        type="submit"
                        disabled={isPosting || (!postText.trim() && !postImageFile)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        {isPosting ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </form>

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
        </div>
    );
};

export default FeedPage;
