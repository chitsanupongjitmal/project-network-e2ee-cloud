
const db = require('../../config/db');
const { userSockets } = require('../state');

module.exports = (io, socket) => {
    const handleSendFriendRequest = async ({ receiverId }) => {
        const senderId = socket.user.id;
        try {
            if (receiverId === senderId) return;
            const userOneId = Math.min(senderId, receiverId);
            const userTwoId = Math.max(senderId, receiverId);
            await db.query(
                `INSERT INTO friendships (user_one_id, user_two_id, status, action_user_id) VALUES (?, ?, 'pending', ?) ON DUPLICATE KEY UPDATE status = VALUES(status), action_user_id = VALUES(action_user_id)`,
                [userOneId, userTwoId, senderId]
            );
            
            const receiverSocketId = userSockets.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new friend request', { 
                    sender: { id: senderId, username: socket.user.username, avatar_url: socket.user.avatar_url } 
                });
            }
            socket.emit('friend request sent', { receiverId });
        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    };


    const handleRespondToFriendRequest = async ({ senderId, status }) => {
        const receiverId = socket.user.id;
        try {
            if (!['accepted', 'rejected'].includes(status)) return;

            const userOneId = Math.min(senderId, receiverId);
            const userTwoId = Math.max(senderId, receiverId);



            const [result] = await db.query(
                'UPDATE friendships SET status = ?, action_user_id = ? WHERE user_one_id = ? AND user_two_id = ? AND status = \'pending\' AND action_user_id != ?',
                [status, receiverId, userOneId, userTwoId, receiverId]
            );

            if (result.affectedRows > 0) {

                if (status === 'accepted') {
                    const senderSocketId = userSockets.get(senderId);
                    if (senderSocketId) {
                        io.to(senderSocketId).emit('friend request accepted', { 
                            responder: { id: receiverId, username: socket.user.username, avatar_url: socket.user.avatar_url }
                        });
                    }
                }
                socket.emit('friend response success', { senderId, status });
            }
        } catch (error) {
             console.error('Error responding to friend request:', error);
        }
    };



    socket.on('send friend request', handleSendFriendRequest);
    socket.on('respond to friend request', handleRespondToFriendRequest);
};