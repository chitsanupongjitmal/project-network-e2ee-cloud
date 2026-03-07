
import React, { useEffect, useState, useCallback } from 'react';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';
import { getRoleMeta } from '../../utils/roleLabels';

const RoleManagementPage = ({ currentUser }) => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [isBulkApproving, setIsBulkApproving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [approvalFilter, setApprovalFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const [usersRes, rolesRes] = await Promise.all([
                fetch(`${SERVER_URL}/api/admin/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${SERVER_URL}/api/admin/roles`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (!usersRes.ok) {
                const err = await usersRes.json();
                throw new Error(err.message || 'Failed to load users.');
            }
            if (!rolesRes.ok) {
                const err = await rolesRes.json();
                throw new Error(err.message || 'Failed to load roles.');
            }

            const usersData = await usersRes.json();
            const rolesData = await rolesRes.json();
            setUsers(usersData.map(u => ({
                ...u,
                role: (u.role || 'user').toLowerCase(),
                approval_status: (u.approval_status || 'approved').toLowerCase(),
                can_create_group: !!u.can_create_group
            })));
            const normalizedRoles = Array.from(new Set(rolesData.map(r => (r.name || '').toLowerCase()).filter(Boolean)));
            setRoles(normalizedRoles);
        } catch (err) {
            console.error('Role management load error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRoleChange = async (userId, newRole) => {
        setError('');
        setSuccess('');
        setUpdatingUserId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to update role.');
            }

            setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
            setSuccess('Role updated successfully.');
        } catch (err) {
            console.error('Update role error:', err);
            setError(err.message);
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleApprovalChange = async (userId, status) => {
        setError('');
        setSuccess('');
        setUpdatingUserId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}/approval`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to update approval status.');
            }

            setUsers(prev => prev.map(u => (u.id === userId ? { ...u, approval_status: status } : u)));
            setSuccess('Approval status updated successfully.');
        } catch (err) {
            console.error('Update approval error:', err);
            setError(err.message);
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleGroupCreatePermissionChange = async (userId, canCreateGroup) => {
        setError('');
        setSuccess('');
        setUpdatingUserId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}/group-create-permission`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ canCreateGroup })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to update group permission.');
            }

            setUsers(prev => prev.map(u => (u.id === userId ? { ...u, can_create_group: canCreateGroup } : u)));
            setSuccess('Group creation permission updated successfully.');
        } catch (err) {
            console.error('Update group create permission error:', err);
            setError(err.message);
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        const confirmed = window.confirm(`Delete user "${username}"?\nThis action cannot be undone.`);
        if (!confirmed) return;

        setError('');
        setSuccess('');
        setUpdatingUserId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to delete user.');
            }

            setUsers(prev => prev.filter(u => u.id !== userId));
            setSuccess(`Deleted user "${username}" successfully.`);
        } catch (err) {
            console.error('Delete user error:', err);
            setError(err.message);
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleApproveAllPending = async () => {
        const pendingUsers = users.filter(u => (u.approval_status || 'approved') === 'pending');
        if (!pendingUsers.length) return;

        setError('');
        setSuccess('');
        setIsBulkApproving(true);

        try {
            const token = localStorage.getItem('token');
            for (const pendingUser of pendingUsers) {
                const response = await fetch(`${SERVER_URL}/api/admin/users/${pendingUser.id}/approval`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: 'approved' })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || `Failed to approve ${pendingUser.username}.`);
                }
            }

            setUsers(prev => prev.map(u => (
                (u.approval_status || 'approved') === 'pending' ? { ...u, approval_status: 'approved' } : u
            )));
            setSuccess(`Approved ${pendingUsers.length} pending user(s).`);
        } catch (err) {
            console.error('Bulk approve error:', err);
            setError(err.message);
        } finally {
            setIsBulkApproving(false);
        }
    };

    const pendingUsers = users.filter(u => (u.approval_status || 'approved') === 'pending');
    const approvedCount = users.filter(u => (u.approval_status || 'approved') === 'approved').length;
    const rejectedCount = users.filter(u => (u.approval_status || 'approved') === 'rejected').length;

    const filteredUsers = users.filter((user) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const usernameMatched = !normalizedSearch || user.username.toLowerCase().includes(normalizedSearch);
        const approvalMatched = approvalFilter === 'all' || (user.approval_status || 'approved') === approvalFilter;
        return usernameMatched && approvalMatched;
    });

    if (!currentUser || currentUser.role !== 'super-admin') {
        return <div className="p-6 text-center text-red-500">Access denied.</div>;
    }

    if (isLoading) {
        return <div className="p-6 text-center">Loading role management...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans space-y-6 overflow-y-auto">
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Role Management</h1>
                <p className="text-sm text-gray-300 mt-1">Assign application roles to users. You cannot change your own role.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                    <p className="text-xs text-amber-700">Pending</p>
                    <p className="text-2xl font-bold text-amber-800">{pendingUsers.length}</p>
                </div>
                <div className="p-3 rounded-lg border bg-green-50 border-green-200">
                    <p className="text-xs text-green-700">Approved</p>
                    <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
                </div>
                <div className="p-3 rounded-lg border bg-red-50 border-red-200">
                    <p className="text-xs text-red-700">Rejected</p>
                    <p className="text-2xl font-bold text-red-800">{rejectedCount}</p>
                </div>
                <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
                    <p className="text-xs text-blue-700">Total Users</p>
                    <p className="text-2xl font-bold text-blue-800">{users.length}</p>
                </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded-md">{error}</div>}
            {success && <div className="bg-green-100 text-green-700 px-4 py-2 rounded-md">{success}</div>}

            {pendingUsers.length > 0 && (
                <div className="bg-white rounded-lg shadow-md border border-amber-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">Pending Approvals</h2>
                        <button
                            type="button"
                            onClick={handleApproveAllPending}
                            disabled={isBulkApproving}
                            className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                        >
                            {isBulkApproving ? 'Approving...' : `Approve All (${pendingUsers.length})`}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {pendingUsers.slice(0, 8).map((user) => (
                            <div key={`pending-${user.id}`} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2">
                                <div className="flex items-center gap-2">
                                    <Avatar user={user} size="w-8 h-8" />
                                    <span className="font-medium text-sm">{user.username}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleApprovalChange(user.id, 'approved')}
                                        disabled={updatingUserId === user.id}
                                        className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApprovalChange(user.id, 'rejected')}
                                        disabled={updatingUserId === user.id}
                                        className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search username..."
                    className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[180px] bg-white text-gray-900 placeholder:text-gray-400"
                />
                <select
                    value={approvalFilter}
                    onChange={(e) => setApprovalFilter(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900"
                >
                    <option value="all">All approvals</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Can Create Group</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map(user => {
                            const roleMeta = getRoleMeta(user.role);
                            const isSelf = user.id === currentUser.id;
                            return (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar user={user} size="w-10 h-10" />
                                            <div>
                                                <p className="font-semibold text-gray-800">{user.username}</p>
                                                {roleMeta && (
                                                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${roleMeta.classes}`}>
                                                        {roleMeta.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={(user.role || 'user').toLowerCase()}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            disabled={isSelf || updatingUserId === user.id}
                                        >
                                            {['user', ...roles.filter(r => r !== 'user')].map(roleName => (
                                                <option key={roleName} value={roleName}>
                                                    {roleName.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={user.approval_status || 'approved'}
                                            onChange={(e) => handleApprovalChange(user.id, e.target.value)}
                                            disabled={updatingUserId === user.id}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={!!user.can_create_group}
                                                onChange={(e) => handleGroupCreatePermissionChange(user.id, e.target.checked)}
                                                disabled={updatingUserId === user.id}
                                            />
                                            <span className="text-sm text-gray-700">{user.can_create_group ? 'Allowed' : 'Not allowed'}</span>
                                        </label>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {isSelf ? 'Your account' : updatingUserId === user.id ? 'Saving...' : 'Ready'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isSelf ? (
                                            <span className="text-xs text-gray-400">-</span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                disabled={updatingUserId === user.id}
                                                className="px-3 py-2 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
                                            >
                                                Delete User
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoleManagementPage;
