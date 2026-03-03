
const { userSockets, activeGroupCalls } = require('../state');
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
    const handleStartGroupCall = ({ groupId, callType }) => {
        const groupIdStr = groupId.toString();
        if (!activeGroupCalls.has(groupIdStr)) {
            activeGroupCalls.set(groupIdStr, new Set());
        }
        activeGroupCalls.get(groupIdStr).add(socket.user.id);
        
        io.to(`group_${groupIdStr}`).emit('incoming-group-call', { 
            groupId, callType, caller: { id: socket.user.id, username: socket.user.username, role: socket.user.role || 'user' }
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


    const handleLeaveGroupCall = ({ groupId }) => {
        const groupIdStr = groupId.toString();
        if (activeGroupCalls.has(groupIdStr)) {
            activeGroupCalls.get(groupIdStr).delete(socket.user.id);
            if (activeGroupCalls.get(groupIdStr).size === 0) {
                activeGroupCalls.delete(groupIdStr);
                io.to(`group_${groupIdStr}`).emit('group-call-ended', { groupId });
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
