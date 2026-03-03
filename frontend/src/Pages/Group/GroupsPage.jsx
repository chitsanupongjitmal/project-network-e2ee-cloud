import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import CreateGroupModal from '../../Components/Modals/CreateGroupModal';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchGroups = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/groups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setGroups(data);
        } catch (error) {
            console.error("Failed to fetch groups", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    if (isLoading) return <p className="text-center mt-8">Loading groups...</p>;

    return (
        <div className="max-w-xl mx-auto p-4 font-sans">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Your Groups</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                    Create Group
                </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
                {groups.length > 0 ? (
                    groups.map(group => (
                        <Link 
                            key={group.id} 
                            to={`/group/${group.id}`} 
                            className="block bg-gray-50 hover:bg-gray-100 p-3 rounded-lg"
                        >
                            <span className="font-semibold">{group.name}</span>
                        </Link>
                    ))
                ) : (
                    <p className="text-gray-500">You are not in any groups yet.</p>
                )}
            </div>
            {isModalOpen && (
                <CreateGroupModal 
                    onClose={() => setIsModalOpen(false)} 
                    onGroupCreated={fetchGroups} 
                />
            )}
        </div>
    );
};

export default GroupsPage;