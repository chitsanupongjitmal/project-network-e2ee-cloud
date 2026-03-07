
const { userSockets, activeGroupCalls, activeGroupCallMeta } = require('../state');
const db = require('../../config/db');

const broadcastParticipantsUpdate = async (io, groupId) => {
    const groupIdStr = groupId.toString();
    if (!activeGroupCalls.has(groupIdStr) || activeGroupCalls.get(groupIdStr).size === 0) {
        io.to(`group_${groupIdStr}`).emit('group-call-participants', { participants: [] });
        return;
    }
    const memberIds = Array.from(activeGroupCalls.get(groupIdStr));
    if (memberIds.length === 0) return;
    const [users] = await db.query(
        `SELECT u.id, u.username, u.avatar_url, u.display_name, COALESCE(r.name, 'user') AS role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.id IN (?)`,
        [memberIds]
    );
    io.to(`group_${groupIdStr}`).emit('group-call-participants', { participants: users });
};

module.exports = (io, socket) => {
    const buildGroupCallSummaryText = ({ mode, durationSeconds }) => JSON.stringify({
        event: 'call_ended',
        mode: mode || 'audio',
        status: 'completed',
        durationSeconds: Number(durationSeconds) || 0,
        endedAt: new Date().toISOString(),
    });

    const emitGroupCallSummary = async ({ groupId, senderId, senderUsername, senderAvatar, durationSeconds, mode }) => {
        try {
            const summaryText = buildGroupCallSummaryText({ mode, durationSeconds });
            const [insertResult] = await db.query(
                `INSERT INTO group_messages (group_id, sender_id, message_text, message_type, reply_to_message_id)
                 VALUES (?, ?, ?, 'call_summary', NULL)`,
                [groupId, senderId, summaryText]
            );

            const messageData = {
                id: insertResult.insertId,
                text: summaryText,
                message_type: 'call_summary',
                sender_id: senderId,
                sender: senderUsername,
                senderAvatar: senderAvatar || null,
                group_id: groupId,
                timestamp: new Date().toISOString(),
                reply_to_message_id: null,
                client_id: null,
                repliedTo: null,
            };

            io.to(`group_${groupId}`).emit('group message', messageData);
            io.to(`group_${groupId}`).emit('refresh conversations');
        } catch (error) {
            console.error('Failed to save group call summary message:', error);
        }
    };

    const handleStartGroupCall = async ({ groupId, callType }) => {
        const groupIdStr = groupId.toString();
        if (!activeGroupCalls.has(groupIdStr)) {
            activeGroupCalls.set(groupIdStr, new Set());
        }
        activeGroupCalls.get(groupIdStr).add(socket.user.id);

        if (!activeGroupCallMeta.has(groupIdStr)) {
            try {
                const [historyResult] = await db.query(
                    `INSERT INTO call_history (call_type, mode, caller_id, group_id, status, started_at)
                     VALUES ('group', ?, ?, ?, 'answered', NOW())`,
                    [callType || 'audio', socket.user.id, Number(groupId)]
                );
                activeGroupCallMeta.set(groupIdStr, {
                    historyId: historyResult.insertId,
                    startedAt: new Date(),
                    mode: callType || 'audio',
                });
            } catch (error) {
                console.error('Failed to save group call history start:', error);
            }
        }

        let groupName = `Group ${groupId}`;
        try {
            const [rows] = await db.query('SELECT name FROM `groups` WHERE id = ? LIMIT 1', [groupId]);
            if (rows.length && rows[0].name) {
                groupName = rows[0].name;
            }
        } catch (error) {
            console.error('Failed to load group name for incoming call event:', error);
        }
        
        io.to(`group_${groupIdStr}`).emit('incoming-group-call', { 
            groupId,
            groupName,
            callType,
            caller: { id: socket.user.id, username: socket.user.username, role: socket.user.role || 'user' }
        });
        broadcastParticipantsUpdate(io, groupId);
    };


    const handleJoinGroupCall = ({ groupId }) => {
        const groupIdStr = groupId.toString();
        if (!activeGroupCalls.has(groupIdStr)) {
            return socket.emit('group-call-ended', { groupId });
        }
        

        const existingMembers = Array.from(activeGroupCalls.get(groupIdStr));
        


        existingMembers.forEach(memberId => {
            const memberSocketId = userSockets.get(memberId);
            if (memberSocketId) {
                io.to(memberSocketId).emit('member-joined-call', {
                    groupId,
                    newMember: { id: socket.user.id, username: socket.user.username }
                });
            }
        });


        activeGroupCalls.get(groupIdStr).add(socket.user.id);
        

        broadcastParticipantsUpdate(io, groupId);
    };


    const handleLeaveGroupCall = async ({ groupId }) => {
        const groupIdStr = groupId.toString();
        if (activeGroupCalls.has(groupIdStr)) {
            activeGroupCalls.get(groupIdStr).delete(socket.user.id);
            if (activeGroupCalls.get(groupIdStr).size === 0) {
                activeGroupCalls.delete(groupIdStr);
                io.to(`group_${groupIdStr}`).emit('group-call-ended', { groupId });

                const callMeta = activeGroupCallMeta.get(groupIdStr);
                if (callMeta?.historyId) {
                    const durationSeconds = callMeta.startedAt
                        ? Math.max(0, Math.floor((Date.now() - new Date(callMeta.startedAt).getTime()) / 1000))
                        : 0;
                    db.query(
                        `UPDATE call_history
                         SET status = 'completed', ended_at = NOW(), duration_seconds = ?
                         WHERE id = ?`,
                        [durationSeconds, callMeta.historyId]
                    ).catch((error) => {
                        console.error('Failed to finalize group call history:', error);
                    });

                    await emitGroupCallSummary({
                        groupId: Number(groupId),
                        senderId: Number(socket.user.id),
                        senderUsername: socket.user.username,
                        senderAvatar: socket.user.avatar_url || null,
                        durationSeconds,
                        mode: callMeta.mode || 'audio',
                    });
                }
                activeGroupCallMeta.delete(groupIdStr);
            } else {
                io.to(`group_${groupIdStr}`).emit('member-left-call', { groupId, userId: socket.user.id });
            }
            broadcastParticipantsUpdate(io, groupId);
        }
    };

    const handleRelayGroupSignal = ({ to, from, signal }) => {
        const toSocketId = userSockets.get(to);
        if (toSocketId) {
            io.to(toSocketId).emit('group-signal-relayed', { from, signal });
        }
    };
    
    const handleToggleGroupVideo = ({ groupId, hasVideo }) => {
        io.to(`group_${groupId}`).emit('member-video-toggled', {
            userId: socket.user.id,
            hasVideo: hasVideo
        });
    };

    const handleToggleGroupAudio = ({ groupId, isMuted }) => {
        io.to(`group_${groupId}`).emit('member-audio-toggled', {
            userId: socket.user.id,
            isMuted: !!isMuted,
        });
    };

    socket.on('start-group-call', handleStartGroupCall);
    socket.on('join-group-call', handleJoinGroupCall);
    socket.on('leave-group-call', handleLeaveGroupCall);
    socket.on('relay-group-signal', handleRelayGroupSignal);
    socket.on('toggle-group-video', handleToggleGroupVideo);
    socket.on('toggle-group-audio', handleToggleGroupAudio);
};
