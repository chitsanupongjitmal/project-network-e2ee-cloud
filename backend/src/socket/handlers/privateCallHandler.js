
const db = require('../../config/db');
const { userSockets } = require('../state');

module.exports = (io, socket) => {
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

        const receiverSocketId = userSockets.get(targetId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-made', {
                offer,
                callerId,
                callerUsername: socket.user.username,
                callerAvatarUrl: socket.user.avatar_url || null,
                callType,
                callerHasVideo: !!callerHasVideo
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

        const callerSocketId = userSockets.get(targetId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('answer-made', { answer, hasVideo });
        }
    };


    const handleIceCandidate = ({ to, candidate }) => {
        const peerSocketId = userSockets.get(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('ice-candidate', { candidate });
        }
    };


    const handleEndCall = ({ to }) => {
        const peerSocketId = userSockets.get(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('call-ended');
        }
    };


    const handleToggleVideo = ({ to, hasVideo }) => {
        const peerSocketId = userSockets.get(to);
        if (peerSocketId) {
            io.to(peerSocketId).emit('video-toggled', { hasVideo });
        }
    };


    const handleToggleAudio = ({ to, isMuted }) => {
        const targetId = Number(to);
        if (!Number.isInteger(targetId)) return;

        const peerSocketId = userSockets.get(targetId);
        if (peerSocketId) {
            io.to(peerSocketId).emit('audio-toggled', {
                userId: socket.user.id,
                isMuted: !!isMuted,
            });
        }
    };

    const handleBusy = ({ to }) => {
        const peerSocketId = userSockets.get(to);
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
