
const db = require('../../config/db');
const { userSockets, activeGroupCalls } = require('../state');

const getFriends = async (userId) => {
    const [friends] = await db.query(
        `SELECT u.id FROM users u 
         JOIN friendships f ON (f.user_one_id = u.id OR f.user_two_id = u.id) 
         WHERE (f.user_one_id = ? OR f.user_two_id = ?) 
         AND f.status = 'accepted' AND u.id != ?`,
        [userId, userId, userId]
    );
    return friends.map(f => f.id);
};

const getVisibleOnlineFriends = async (userId) => {
    const friendIds = await getFriends(userId);
    const onlineFriendIds = [];
    for (const friendId of friendIds) {
        if (userSockets.has(friendId)) {

            onlineFriendIds.push(friendId);
        }
    }
    return onlineFriendIds;
};


const broadcastParticipantsUpdate = async (io, groupId) => {
    const groupIdStr = groupId.toString();
    if (!activeGroupCalls.has(groupIdStr) || activeGroupCalls.get(groupIdStr).size === 0) {
        io.to(`group_${groupIdStr}`).emit('group-call-participants', { participants: [] });
        return;
    }
    const memberIds = Array.from(activeGroupCalls.get(groupIdStr));
    if (memberIds.length === 0) return;
    const [users] = await db.query('SELECT id, username, avatar_url FROM users WHERE id IN (?)', [memberIds]);
    io.to(`group_${groupIdStr}`).emit('group-call-participants', { participants: users });
};


module.exports = (io, socket) => {
    const userIdStr = socket.user.id.toString();

    const handleConnection = async () => {
        console.log(`[CONNECTION] User '${socket.user.username}' (ID: ${socket.user.id}) connected with socket ID: ${socket.id}`);
        try {

            const [users] = await db.query('SELECT active_socket_id FROM users WHERE id = ?', [socket.user.id]);
            const oldSocketId = users.length > 0 ? users[0].active_socket_id : null;
            if (oldSocketId && oldSocketId !== socket.id) {
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket) {
                    oldSocket.emit('force_disconnect', { message: 'Logged in from another device.' });
                    oldSocket.disconnect(true);
                }
            }
            await db.query('UPDATE users SET active_socket_id = ? WHERE id = ?', [socket.id, socket.user.id]);
            
            userSockets.set(socket.user.id, socket.id);
            socket.join(userIdStr); 


            await db.query('UPDATE users SET last_seen = NULL WHERE id = ?', [socket.user.id]);
            const [userData] = await db.query('SELECT avatar_url FROM users WHERE id = ?', [socket.user.id]);
            if (userData.length > 0) {
                socket.user.avatar_url = userData[0].avatar_url; 
            }


            const friends = await getFriends(socket.user.id);
            friends.forEach(friendId => {
                const friendSocketId = userSockets.get(friendId);
                if (friendSocketId) io.to(friendSocketId).emit('user online', { userId: socket.user.id });
            });


            const onlineFriends = await getVisibleOnlineFriends(socket.user.id);
            socket.emit('friends status', { onlineUserIds: onlineFriends });


            const [groups] = await db.query("SELECT group_id FROM group_members WHERE user_id = ? AND status = 'accepted'", [socket.user.id]);
            groups.forEach(group => {
                const groupId = group.group_id;
                socket.join(`group_${groupId}`);
                

                if (activeGroupCalls.has(groupId.toString()) && activeGroupCalls.get(groupId.toString()).size > 0) {

                    socket.emit('ongoing-call-in-group', { groupId });
                }
            });
        } catch(e) {
            console.error("[ERROR] during connection setup:", e);
        }
    };

    const handleDisconnect = async () => {
        console.log(`[DISCONNECT] User '${socket.user.username}' disconnected with socket ID: ${socket.id}`);
        try {

            const [result] = await db.query(
                'UPDATE users SET active_socket_id = NULL, last_seen = ? WHERE id = ? AND active_socket_id = ?', 
                [new Date(), socket.user.id, socket.id]
            );
            
            if (result.affectedRows > 0) {
                userSockets.delete(socket.user.id);
                const friends = await getFriends(socket.user.id);
                friends.forEach(friendId => {
                    const friendSocketId = userSockets.get(friendId);
                    if (friendSocketId) io.to(friendSocketId).emit('user offline', { userId: socket.user.id });
                });
            }


            activeGroupCalls.forEach((members, groupId) => {
                if (members.has(socket.user.id)) {
                    members.delete(socket.user.id);
                    if (members.size === 0) {
                        activeGroupCalls.delete(groupId);
                        io.to(`group_${groupId}`).emit('group-call-ended', { groupId });
                    } else {
                        io.to(`group_${groupId}`).emit('member-left-call', { groupId, userId: socket.user.id });
                        broadcastParticipantsUpdate(io, groupId);
                    }
                }
            });
        } catch (error) {
            console.error("[ERROR] during disconnect:", error);
        }
    };


    handleConnection();
    socket.on('disconnect', handleDisconnect);
};