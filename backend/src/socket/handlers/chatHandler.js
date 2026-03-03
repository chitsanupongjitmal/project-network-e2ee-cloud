
const db = require('../../config/db');
const { userSockets } = require('../state');

module.exports = (io, socket) => {
    const handlePrivateMessage = async ({ encryptedPayload, toUserId, client_id, type = 'encrypted', replyToMessageId }) => {
        const senderId = socket.user.id;
        try {

            if (senderId === toUserId) return;
            const userOneId = Math.min(senderId, toUserId);
            const userTwoId = Math.max(senderId, toUserId);
            const [friendships] = await db.query(
                'SELECT status FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
                [userOneId, userTwoId]
            );
            if (friendships.length === 0 || friendships[0].status !== 'accepted') {
                return socket.emit('message blocked', { 
                    message: "You can only send messages to accepted friends.",
                    client_id: client_id 
                });
            }

            const [receiverData] = await db.query('SELECT public_key_version FROM users WHERE id = ?', [toUserId]);
            const receiverKeyVersion = receiverData.length > 0 ? receiverData[0].public_key_version : null;
            
            const [result] = await db.query(
                'INSERT INTO private_messages (sender_id, receiver_id, message_text, message_type, receiver_key_version, reply_to_message_id) VALUES (?, ?, ?, ?, ?, ?)',
                [senderId, toUserId, encryptedPayload, type, receiverKeyVersion, replyToMessageId || null]
            );

            const messageData = {
                id: result.insertId, encryptedPayload, senderId, sender: socket.user.username,
                receiverId: toUserId, client_id, timestamp: new Date(), type, 
                reply_to_message_id: replyToMessageId,
            };

            const receiverSocketId = userSockets.get(toUserId);
            if (receiverSocketId) io.to(receiverSocketId).emit('private message', messageData);
            socket.emit('private message', messageData);

            if (receiverSocketId) io.to(receiverSocketId).emit('refresh conversations');
            socket.emit('refresh conversations');
        } catch (error) {
            console.error('Error handling private message:', error);
        }
    };


    const handleGroupMessage = async ({ content, groupId, type = 'encrypted_text', replyToMessageId, client_id }) => {
        const senderId = socket.user.id;
        try {
            const [result] = await db.query(
                'INSERT INTO group_messages (group_id, sender_id, message_text, message_type, reply_to_message_id) VALUES (?, ?, ?, ?, ?)', 
                [groupId, senderId, content, type, replyToMessageId || null]
            );
            const messageData = {
                id: result.insertId,
                text: content,
                message_type: type,
                sender_id: senderId,
                sender: socket.user.username,
                senderAvatar: socket.user.avatar_url,
                group_id: groupId,
                timestamp: new Date(),
                reply_to_message_id: replyToMessageId,
                client_id: client_id,
                repliedTo: null
            };


            if (replyToMessageId) {
                const [repliedMessages] = await db.query(
                    `SELECT 
                        gm.message_text as text,
                        gm.message_type,
                        u.username as sender
                     FROM group_messages gm
                     JOIN users u ON gm.sender_id = u.id
                     WHERE gm.id = ?`,
                    [replyToMessageId]
                );

                if (repliedMessages.length > 0) {
                    messageData.repliedTo = repliedMessages[0];
                }
            }

            const sentSocketIds = new Set();

            const sendToSocketId = (targetSocketId) => {
                if (!targetSocketId || sentSocketIds.has(targetSocketId)) return;
                io.to(targetSocketId).emit('group message', messageData);
                io.to(targetSocketId).emit('refresh conversations');
                sentSocketIds.add(targetSocketId);
            };

            sendToSocketId(socket.id);

            const [memberRows] = await db.query(
                'SELECT user_id FROM group_members WHERE group_id = ? AND status = "accepted"',
                [groupId]
            );

            memberRows.forEach(({ user_id }) => {
                const memberId = Number(user_id);
                if (Number.isNaN(memberId) || memberId === senderId) return;
                const memberSocketId = userSockets.get(memberId);
                if (memberSocketId) {
                    sendToSocketId(memberSocketId);
                }
            });

            const roomName = `group_${groupId}`;
            const room = io.sockets.adapter.rooms.get(roomName);
            if (room) {
                room.forEach((socketId) => {
                    if (!sentSocketIds.has(socketId)) {
                        sendToSocketId(socketId);
                    }
                });
            }
        } catch (error) {
            console.error('Error sending group message:', error);
        }
    };


    const handleUnsendMessage = async ({ messageId, chatType, targetId }) => {
        try {
            const tableName = chatType === 'private' ? 'private_messages' : 'group_messages';
            const [result] = await db.query(
                `UPDATE ${tableName} SET is_unsent = 1, message_text = '' WHERE id = ? AND sender_id = ?`,
                [messageId, socket.user.id]
            );

            if (result.affectedRows > 0) {
                if (chatType === 'private') {
                    const eventData = { messageId, chatType, conversationParticipants: [socket.user.id, targetId] };
                    const peerSocketId = userSockets.get(targetId);
                    if (peerSocketId) io.to(peerSocketId).emit('message_unsent', eventData);
                    socket.emit('message_unsent', eventData);
                } else if (chatType === 'group') {
                    io.to(`group_${targetId}`).emit('message_unsent', { messageId, chatType, targetId });
                }
            }
        } catch (error) {
            console.error("Unsend message error:", error);
        }
    };

    const handleMarkAsRead = async ({ peerUsername }) => {
        try {
            const [peer] = await db.query('SELECT id FROM users WHERE username = ?', [peerUsername]);
            if (peer.length > 0) {
                const peerId = peer[0].id;
                await db.query('UPDATE private_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0', [peerId, socket.user.id]);
                const peerSocketId = userSockets.get(peerId);
                if (peerSocketId) io.to(peerSocketId).emit('messages were read', { readerUsername: socket.user.username });
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const handleTyping = (isTyping, { toUserId, groupId }) => {
        const event = isTyping ? 'user typing' : 'user stopped typing';
        if (toUserId) {
            const receiverSocketId = userSockets.get(toUserId);
            if (receiverSocketId) socket.to(receiverSocketId).emit(event, { username: socket.user.username });
        } else if (groupId) {
            socket.to(`group_${groupId}`).emit(event, { username: socket.user.username, groupId });
        }
    };


    socket.on('private message', handlePrivateMessage);
    socket.on('group message', handleGroupMessage);
    socket.on('unsend_message', handleUnsendMessage);
    socket.on('mark as read', handleMarkAsRead);
    socket.on('start typing', (data) => handleTyping(true, data));
    socket.on('stop typing', (data) => handleTyping(false, data));
};

