
const db = require('../../config/db');
const { userSockets, activePrivateCalls } = require('../state');

module.exports = (io, socket) => {
    const buildCallSummaryText = ({ mode, status, durationSeconds }) => JSON.stringify({
        event: 'call_ended',
        mode: mode || 'audio',
        status: status || 'completed',
        durationSeconds: Number(durationSeconds) || 0,
        endedAt: new Date().toISOString(),
    });

    const emitPrivateCallSummary = async ({ senderId, receiverId, senderUsername, mode, status, durationSeconds }) => {
        try {
            const summaryText = buildCallSummaryText({ mode, status, durationSeconds });
            const [result] = await db.query(
                `INSERT INTO private_messages (sender_id, receiver_id, message_text, message_type, receiver_key_version, reply_to_message_id)
                 VALUES (?, ?, ?, 'call_summary', NULL, NULL)`,
                [senderId, receiverId, summaryText]
            );

            const messageData = {
                id: result.insertId,
                senderId,
                sender: senderUsername,
                receiverId,
                text: summaryText,
                type: 'call_summary',
                timestamp: new Date().toISOString(),
            };

            const senderSocketId = getSocketIdByUserId(senderId);
            const receiverSocketId = getSocketIdByUserId(receiverId);

            if (senderSocketId) {
                io.to(senderSocketId).emit('private message', messageData);
                io.to(senderSocketId).emit('refresh conversations');
            }
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private message', messageData);
                io.to(receiverSocketId).emit('refresh conversations');
            }
        } catch (error) {
            console.error('Failed to save private call summary message:', error);
        }
    };

    const getSocketIdByUserId = (userId) => {
        return (
            userSockets.get(userId) ||
            userSockets.get(String(userId)) ||
            userSockets.get(Number(userId)) ||
            null
        );
    };

    const emitCallNotAllowed = (payload) => {
        socket.emit('call-not-allowed', {
            reason: payload.reason,
            message: payload.message,
        });
    };

    const fetchFriendship = async (userA, userB) => {
        const userOneId = Math.min(userA, userB);
        const userTwoId = Math.max(userA, userB);
        const [rows] = await db.query(
            'SELECT status, action_user_id FROM friendships WHERE user_one_id = ? AND user_two_id = ?',
            [userOneId, userTwoId]
        );
        return rows[0] || null;
    };

    const ensureCallAllowed = async (callerId, receiverId) => {
        try {
            const caller = Number(callerId);
            const receiver = Number(receiverId);

            if (!Number.isInteger(caller) || !Number.isInteger(receiver)) {
                emitCallNotAllowed({
                    reason: 'invalid-peer',
                    message: 'Call request is missing a valid participant.',
                });
                return false;
            }

            if (caller === receiver) {
                emitCallNotAllowed({
                    reason: 'invalid-peer',
                    message: 'Calling yourself is not supported.',
                });
                return false;
            }

            const friendship = await fetchFriendship(caller, receiver);
            if (!friendship || friendship.status !== 'accepted') {
                if (friendship && friendship.status === 'blocked') {
                    const blockedByCaller = friendship.action_user_id === caller;
                    emitCallNotAllowed({
                        reason: blockedByCaller ? 'blocked-by-self' : 'blocked-by-peer',
                        message: blockedByCaller
                            ? 'You blocked this user. Unblock them before starting a call.'
                            : 'This contact has blocked you. You cannot start a call.',
                    });
                } else {
                    emitCallNotAllowed({
                        reason: 'no-friendship',
                        message: 'You can only call contacts that are in your friends list.',
                    });
                }
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to validate call permissions:', error);
            emitCallNotAllowed({
                reason: 'server-error',
                message: 'Unable to start the call right now. Please try again later.',
            });
            return false;
        }
    };


    const handleCallUser = async ({ to, offer, callType, callerHasVideo }) => {
        const callerId = Number(socket.user.id);
        const targetId = Number(to);
        if (!Number.isInteger(targetId)) {
            emitCallNotAllowed({
                reason: 'invalid-peer',
                message: 'Call request is missing the recipient.',
            });
            return;
        }
        const isAllowed = await ensureCallAllowed(callerId, targetId);
        if (!isAllowed) return;

        let callHistoryId = null;
        try {
            const [result] = await db.query(
                `INSERT INTO call_history (call_type, mode, caller_id, callee_id, status)
                 VALUES ('private', ?, ?, ?, 'ringing')`,
                [callType || 'audio', callerId, targetId]
            );
            callHistoryId = result.insertId;
            const callKey = `${Math.min(callerId, targetId)}:${Math.max(callerId, targetId)}`;
            activePrivateCalls.set(callKey, {
                id: callHistoryId,
                callerId,
                calleeId: targetId,
                answeredAt: null,
                mode: callType || 'audio',
            });
        } catch (error) {
            console.error('Failed to save private call start history:', error);
        }

        const receiverSocketId = getSocketIdByUserId(targetId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-made', {
                offer,
                callerId,
                callerUsername: socket.user.username,
                callerAvatarUrl: socket.user.avatar_url || null,
                callType,
                callerHasVideo: !!callerHasVideo,
                callHistoryId
            });
        }
    };


    const handleMakeAnswer = async ({ to, answer, hasVideo }) => {
        const responderId = Number(socket.user.id);
        const targetId = Number(to);
        if (!Number.isInteger(targetId)) {
            emitCallNotAllowed({
                reason: 'invalid-peer',
                message: 'Call response is missing the recipient.',
            });
            return;
        }

        const isAllowed = await ensureCallAllowed(responderId, targetId);
        if (!isAllowed) return;

        const callKey = `${Math.min(responderId, targetId)}:${Math.max(responderId, targetId)}`;
        const activeCall = activePrivateCalls.get(callKey);
        if (activeCall?.id) {
            try {
                await db.query(
                    `UPDATE call_history
                     SET status = 'answered', started_at = NOW()
                     WHERE id = ?`,
                    [activeCall.id]
                );
                activeCall.answeredAt = new Date();
                activePrivateCalls.set(callKey, activeCall);
            } catch (error) {
                console.error('Failed to mark private call as answered:', error);
            }
        }

        const callerSocketId = getSocketIdByUserId(targetId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('answer-made', { answer, hasVideo });
        }
    };


    const handleIceCandidate = ({ to, candidate }) => {
        const peerSocketId = getSocketIdByUserId(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('ice-candidate', { candidate });
        }
    };


    const handleEndCall = async ({ to }) => {
        const fromUserId = Number(socket.user.id);
        const peerId = Number(to);
        const peerSocketId = getSocketIdByUserId(peerId);
        if (peerSocketId) {
            io.to(peerSocketId).emit('call-ended');
        }

        const callKey = `${Math.min(fromUserId, peerId)}:${Math.max(fromUserId, peerId)}`;
        const activeCall = activePrivateCalls.get(callKey);
        if (activeCall?.id) {
            const wasAnswered = !!activeCall.answeredAt;
            const status = wasAnswered ? 'completed' : 'missed';
            const durationSeconds = wasAnswered
                ? Math.max(0, Math.floor((Date.now() - new Date(activeCall.answeredAt).getTime()) / 1000))
                : 0;

            await db.query(
                `UPDATE call_history
                 SET status = ?, ended_at = NOW(), duration_seconds = ?
                 WHERE id = ?`,
                [status, durationSeconds, activeCall.id]
            ).catch((error) => {
                console.error('Failed to finalize private call history:', error);
            });

            activePrivateCalls.delete(callKey);

            await emitPrivateCallSummary({
                senderId: fromUserId,
                receiverId: peerId,
                senderUsername: socket.user.username,
                mode: activeCall.mode || 'audio',
                status,
                durationSeconds,
            });
        }
    };


    const handleToggleVideo = ({ to, hasVideo }) => {
        const peerSocketId = getSocketIdByUserId(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('video-toggled', { hasVideo });
        }
    };


    const handleToggleAudio = ({ to, isMuted }) => {
        const targetId = Number(to);
        if (!Number.isInteger(targetId)) return;

        const peerSocketId = getSocketIdByUserId(targetId);
        if (peerSocketId) {
            io.to(peerSocketId).emit('audio-toggled', {
                userId: socket.user.id,
                isMuted: !!isMuted,
            });
        }
    };

    const handleBusy = ({ to }) => {
        const peerSocketId = getSocketIdByUserId(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('user-busy', {
                userId: socket.user.id,
                username: socket.user.username
            });
        }
    };


    socket.on('call-user', handleCallUser);
    socket.on('make-answer', handleMakeAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('end-call', handleEndCall);
    socket.on('toggle-video', handleToggleVideo);
    socket.on('toggle-audio', handleToggleAudio);
    socket.on('busy', handleBusy);
};
