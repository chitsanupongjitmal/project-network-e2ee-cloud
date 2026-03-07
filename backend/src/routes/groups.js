
const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const { userSockets } = require('../socket/state'); 
const router = express.Router();

const GROUP_MANAGER_ROLES = new Set(['group-admin', 'super-admin']);

const ensureGroupManager = (role) => GROUP_MANAGER_ROLES.has(role);

async function canUserCreateGroup(userId, roleFromToken) {
    if (ensureGroupManager(roleFromToken)) return true;
    try {
        const [rows] = await db.query('SELECT can_create_group, approval_status FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!rows.length) return false;
        const user = rows[0];
        return user.approval_status === 'approved' && !!user.can_create_group;
    } catch (error) {
        console.error('Error checking group create permission:', error);
        return false;
    }
}

async function userHasPermission(roleName, permissionName) {
    if (!roleName) return false;
    try {
        const [permissions] = await db.query(
            `SELECT COUNT(*) as count FROM role_permissions rp
             JOIN roles r ON rp.role_id = r.id
             JOIN permissions p ON rp.permission_id = p.id
             WHERE r.name = ? AND p.name = ?`,
            [roleName, permissionName]
        );
        return permissions[0].count > 0;
    } catch (error) {
        console.error("Error in userHasPermission check:", error);
        return false;
    }
}

router.post('/', authenticateToken, async (req, res) => {
    const { name, members } = req.body;
    const creatorId = req.user.id;
    const currentRole = req.user.role;

    const allowed = await canUserCreateGroup(creatorId, currentRole);
    if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to create groups.' });
    }

    if (!name || !members || !Array.isArray(members)) {
        return res.status(400).json({ message: 'Group name and encrypted member keys are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [groupResult] = await connection.query('INSERT INTO `groups` (name, creator_id) VALUES (?, ?)', [name, creatorId]);
        const groupId = groupResult.insertId;

        const allMembers = members; 
        if (!allMembers.some(m => m.userId === creatorId)) {
             throw new Error("Creator's encrypted key is missing.");
        }

        const memberValues = allMembers.map(m => [groupId, m.userId, m.userId === creatorId ? 'accepted' : 'pending']);


        const keyValues = allMembers.map(m => [groupId, m.userId, m.encryptedKey, creatorId]);

        await connection.query('INSERT IGNORE INTO group_members (group_id, user_id, status) VALUES ?', [memberValues]);
        await connection.query('INSERT IGNORE INTO group_keys (group_id, user_id, encrypted_key, encrypting_user_id) VALUES ?', [keyValues]);


        await connection.commit();
        res.status(201).json({ message: 'Group created successfully', groupId });
    } catch (error) {
        await connection.rollback();
        console.error("Create group error:", error);
        res.status(500).json({ message: 'Failed to create group' });
    } finally {
        connection.release();
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const [groups] = await db.query(
            `SELECT g.id, g.name FROM \`groups\` g 
             JOIN group_members gm ON g.id = gm.group_id 
             WHERE gm.user_id = ? AND gm.status = 'accepted'`,
            [req.user.id]
        );
        res.json(groups);
    } catch (error) {
        console.error("Get groups error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/invitations', authenticateToken, async (req, res) => {
    try {
        const [invitations] = await db.query(
            `SELECT g.id, g.name, u.username as inviter FROM \`groups\` g 
             JOIN group_members gm ON g.id = gm.group_id 
             JOIN users u ON g.creator_id = u.id 
             WHERE gm.user_id = ? AND gm.status = 'pending'`,
            [req.user.id]
        );
        res.json(invitations);
    } catch (error) {
        console.error("Get group invitations error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/invitations/respond', authenticateToken, async (req, res) => {
    try {
        const { groupId, response } = req.body;
        const userId = req.user.id;

        if (!groupId || !response) {
            return res.status(400).json({ message: 'Group ID and response are required.' });
        }

        if (response === 'accept') {
            const [result] = await db.query(
                "UPDATE group_members SET status = 'accepted' WHERE group_id = ? AND user_id = ? AND status = 'pending'", 
                [groupId, userId]
            );

            if (result.affectedRows > 0 && req.io) {
                const userIdStr = userId.toString();
                req.io.to(userIdStr).emit('refresh conversations');
                const userSocketId = userSockets.get(userId);
                if (userSocketId) {
                    const userSocket = req.io.sockets.sockets.get(userSocketId);
                    if (userSocket) {
                        userSocket.join(`group_${groupId}`);
                    }
                }
            }
            res.json({ message: "Invitation accepted." });

        } else if (response === 'reject') {
            await db.query("DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'pending'", [groupId, userId]);
            await db.query("DELETE FROM group_keys WHERE group_id = ? AND user_id = ?", [groupId, userId]);
            res.json({ message: "Invitation rejected." });
        } else {
            res.status(400).json({ message: "Invalid response." });
        }
    } catch (error) {
        console.error("Respond to invitation error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});




router.get('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUserId = req.user.id;
        
        const [groupInfo] = await db.query(
            `SELECT g.id, g.name, g.creator_id, g.chat_theme FROM \`groups\` g WHERE g.id = ?`,
            [groupId]
        );
        if (groupInfo.length === 0) return res.status(404).json({ message: 'Group not found.' });
        
        const [members] = await db.query(
            `SELECT 
                u.id,
                u.username,
                u.avatar_url,
                COALESCE(
                    MAX(CASE WHEN r.name IS NOT NULL AND LOWER(r.name) <> 'user' THEN LOWER(r.name) END),
                    'user'
                ) AS role
             FROM users u 
             JOIN group_members gm ON u.id = gm.user_id 
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE gm.group_id = ? AND gm.status = 'accepted'
             GROUP BY u.id, u.username, u.avatar_url`,
            [groupId]
        );
        

        const [keyData] = await db.query(
            `SELECT 
                gk.encrypted_key,
                encrypting_user.public_key AS encryptingUserPublicKey
             FROM group_keys gk
             JOIN users encrypting_user ON gk.encrypting_user_id = encrypting_user.id
             WHERE gk.group_id = ? AND gk.user_id = ?`,
            [groupId, currentUserId]
        );

        if (keyData.length === 0) {
            return res.status(403).json({ message: "You are not a member of this group or don't have a key." });
        }

        res.json({ 
            ...groupInfo[0], 
            members,
            encryptedGroupKey: keyData[0].encrypted_key,
            encryptingUserPublicKey: keyData[0].encryptingUserPublicKey
        });

    } catch (error) {
        console.error("Get group details error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});



router.get('/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const [messages] = await db.query(
            `SELECT gm.id, gm.sender_id, gm.message_text as text, gm.timestamp, gm.message_type, u.username as sender, u.avatar_url as senderAvatar, gm.reply_to_message_id, replied.message_text as replied_text, replied.message_type as replied_type, u_replied.username as replied_sender FROM group_messages gm JOIN users u ON gm.sender_id = u.id LEFT JOIN group_messages replied ON gm.reply_to_message_id = replied.id LEFT JOIN users u_replied ON replied.sender_id = u_replied.id WHERE gm.group_id = ? ORDER BY gm.timestamp ASC`, 
            [groupId]
        );
        const processedMessages = messages.map(msg => {
            if (msg.reply_to_message_id) {
                msg.repliedTo = { text: msg.replied_text, type: msg.replied_type, sender: msg.replied_sender };
            }
            delete msg.replied_text; delete msg.replied_type; delete msg.replied_sender;
            return msg;
        });
        res.json(processedMessages);
    } catch (error) {
        console.error("Get group messages error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const senderId = req.user.id;
        const {
            content,
            type = 'encrypted_text',
            replyToMessageId = null,
            client_id = null
        } = req.body;

        if (!content || !String(content).trim()) {
            return res.status(400).json({ message: 'Message content is required.' });
        }

        const [membership] = await db.query(
            "SELECT status FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
            [groupId, senderId]
        );

        if (!membership.length || membership[0].status !== 'accepted') {
            return res.status(403).json({ message: 'You are not an accepted member of this group.' });
        }

        const [result] = await db.query(
            'INSERT INTO group_messages (group_id, sender_id, message_text, message_type, reply_to_message_id) VALUES (?, ?, ?, ?, ?)',
            [groupId, senderId, content, type, replyToMessageId || null]
        );

        const messageData = {
            id: result.insertId,
            text: content,
            message_type: type,
            sender_id: senderId,
            sender: req.user.username,
            senderAvatar: req.user.avatar_url || null,
            group_id: Number(groupId),
            timestamp: new Date(),
            reply_to_message_id: replyToMessageId,
            client_id,
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

        if (req.io) {
            req.io.to(`group_${groupId}`).emit('group message', messageData);
            req.io.to(`group_${groupId}`).emit('refresh conversations');
        }

        return res.status(201).json(messageData);
    } catch (error) {
        console.error('Send group message (REST) error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:groupId/theme', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { theme } = req.body;
        const [result] = await db.query('UPDATE `groups` SET chat_theme = ? WHERE id = ?', [theme, groupId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Group not found." });

        const payload = { groupId: Number(groupId), newTheme: theme };
        const [memberRows] = await db.query(
            'SELECT user_id FROM group_members WHERE group_id = ? AND status = "accepted"',
            [groupId]
        );

        const notifiedSocketIds = new Set();

        memberRows.forEach(({ user_id }) => {
            const memberId = Number(user_id);
            if (Number.isNaN(memberId)) return;
            const memberSocketId = userSockets.get(memberId);
            if (memberSocketId && !notifiedSocketIds.has(memberSocketId)) {
                req.io.to(memberSocketId).emit('group theme updated', payload);
                notifiedSocketIds.add(memberSocketId);
            }
        });

        const roomName = `group_${groupId}`;
        const room = req.io.sockets?.adapter?.rooms?.get(roomName);
        if (room) {
            room.forEach((socketId) => {
                if (!notifiedSocketIds.has(socketId)) {
                    req.io.to(socketId).emit('group theme updated', payload);
                    notifiedSocketIds.add(socketId);
                }
            });
        } else {
            req.io.to(roomName).emit('group theme updated', payload);
        }
        res.status(200).json({ message: 'Theme updated successfully.' });
    } catch (error) {
        console.error("Update group theme error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:groupId/name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const { groupId } = req.params;
        if (!name) return res.status(400).json({ message: 'New name is required.' });
        await db.query('UPDATE `groups` SET name = ? WHERE id = ?', [name, groupId]);
        req.io.to(`group_${groupId}`).emit('group name updated', { groupId, newName: name });
        res.status(200).json({ message: 'Group name updated.' });
    } catch (error) {
        console.error("Update group name error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:groupId/members', authenticateToken, async (req, res) => {
    const { members } = req.body;
    const { groupId } = req.params;
    const inviterId = req.user.id;
    const currentRole = req.user.role;

    if (!ensureGroupManager(currentRole)) {
        return res.status(403).json({ message: 'Only group administrators can invite members.' });
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ message: 'New members and their encrypted keys are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const memberValues = members.map(m => [groupId, m.userId, 'pending']);


        const keyValues = members.map(m => [groupId, m.userId, m.encryptedKey, inviterId]);

        await connection.query('INSERT IGNORE INTO group_members (group_id, user_id, status) VALUES ?', [memberValues]);
        await connection.query('INSERT IGNORE INTO group_keys (group_id, user_id, encrypted_key, encrypting_user_id) VALUES ?', [keyValues]);


        await connection.commit();
        res.status(200).json({ message: 'Invitations sent successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error("Invite members error:", error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

router.post('/:groupId/leave', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUserId = req.user.id;
        const [result] = await db.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, currentUserId]);
        if (result.affectedRows > 0) {
            await db.query('DELETE FROM group_keys WHERE group_id = ? AND user_id = ?', [groupId, currentUserId]);
            req.io.to(`group_${groupId}`).emit('system message', { text: `${req.user.username} has left the group.` });
            res.status(200).json({ message: 'You have left the group.' });
        } else {
            res.status(404).json({ message: 'You are not a member of this group.' });
        }
    } catch (error) {
        console.error("Leave group error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUserRole = req.user.role;
        if (!ensureGroupManager(currentUserRole)) {
            const hasDisbandPermission = await userHasPermission(currentUserRole, 'disband-any-group');
            if (!hasDisbandPermission) {
                return res.status(403).json({ message: "Only group administrators can disband groups." });
            }
        }
        const [group] = await db.query('SELECT id FROM `groups` WHERE id = ?', [groupId]);
        if (group.length === 0) return res.status(404).json({ message: "Group not found." });
        await db.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
        req.io.to(`group_${groupId}`).emit('group disbanded', { groupId, message: 'The group has been disbanded by the creator.' });
        res.status(200).json({ message: 'Group disbanded successfully.' });
    } catch (error) {
        console.error("Disband group error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
