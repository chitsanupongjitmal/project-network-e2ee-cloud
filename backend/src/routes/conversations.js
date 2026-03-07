
const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const router = express.Router();
const { userSockets } = require('../socket/state');

router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { q: query } = req.query;

    try {
        const baseGroupQuery = `
            SELECT
                g.id, 'group' AS type, g.name, g.name AS display_name, g.avatar_url AS avatar_url, NULL as peerPublicKey,
                gm.message_text AS lastMessage, gm.message_type as messageType, gm.timestamp AS lastMessageTimestamp,
                NULL AS nickname -- เพิ่ม NULL nickname สำหรับ Group
            FROM \`groups\` g
            JOIN group_members g_mem ON g.id = g_mem.group_id
            LEFT JOIN (
                SELECT group_id, message_text, message_type, timestamp,
                       ROW_NUMBER() OVER(PARTITION BY group_id ORDER BY timestamp DESC) as rn
                FROM group_messages
            ) gm ON g.id = gm.group_id AND gm.rn = 1
            LEFT JOIN hidden_conversations hc ON hc.user_id = ? AND hc.conversation_type = 'group' AND hc.target_id = g.id
            WHERE g_mem.user_id = ? AND g_mem.status = 'accepted' AND hc.id IS NULL
        `;
        const groupQuery = query ? `${baseGroupQuery} AND g.name LIKE ?` : baseGroupQuery;
        const groupParams = query ? [userId, userId, `%${query}%`] : [userId, userId];
        const [groupConversations] = await db.query(groupQuery, groupParams);




        const basePrivateQuery = `
            SELECT
                u.id, 
                'private' AS type, 
                u.username AS name, 
                u.display_name AS display_name, 
                u.avatar_url,
                u.public_key AS peerPublicKey,
                pm.message_text AS lastMessage, 
                pm.message_type AS messageType,
                pm.timestamp AS lastMessageTimestamp,
                CASE -- Logic เพื่อดึงชื่อเล่นของเพื่อน
                    WHEN f.user_one_id = ? THEN f.user_two_nickname
                    ELSE f.user_one_nickname
                END AS nickname 
            FROM users u
            JOIN (
                SELECT
                    CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_user_id,
                    message_text,
                    message_type,
                    timestamp,
                    ROW_NUMBER() OVER(PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END ORDER BY timestamp DESC) as rn
                FROM private_messages
                WHERE sender_id = ? OR receiver_id = ?
            ) pm ON u.id = pm.other_user_id
            -- LEFT JOIN friendship table
            LEFT JOIN friendships f ON (
                (f.user_one_id = ? AND f.user_two_id = u.id) OR -- เราคือ user_one_id
                (f.user_two_id = ? AND f.user_one_id = u.id)    -- เราคือ user_two_id
            )
            LEFT JOIN hidden_conversations hc ON hc.user_id = ? AND hc.conversation_type = 'private' AND hc.target_id = u.id
            WHERE pm.rn = 1 AND hc.id IS NULL
        `;
        

        const privateParamsBase = [userId, userId, userId, userId, userId, userId, userId, userId, userId];
        
        let privateParams;
        let privateQuery;
        
        if (query) {
             privateQuery = `${basePrivateQuery} AND (
                u.username LIKE ?
                OR u.display_name LIKE ?
                OR (
                    CASE
                        WHEN f.user_one_id = ? THEN f.user_two_nickname
                        ELSE f.user_one_nickname
                    END
                ) LIKE ?
            )`;
             privateParams = [...privateParamsBase, `%${query}%`, `%${query}%`, userId, `%${query}%`];
        } else {
             privateQuery = basePrivateQuery;
             privateParams = privateParamsBase;
        }

        const [privateConversations] = await db.query(privateQuery, privateParams);

        const allConversations = [...groupConversations, ...privateConversations];
        allConversations.sort((a, b) => {
            if (!a.lastMessageTimestamp) return 1;
            if (!b.lastMessageTimestamp) return -1;
            return new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp);
        });

        res.json(allConversations);

    } catch (error) {
        console.error("Get conversations error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/hidden', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [hiddenPrivate] = await db.query(`
            SELECT u.id, 'private' as type, u.username as name, u.avatar_url
            FROM users u
            JOIN hidden_conversations hc ON u.id = hc.target_id
            WHERE hc.user_id = ? AND hc.conversation_type = 'private'
        `, [userId]);
        res.json(hiddenPrivate);
    } catch (error) {
        console.error("Get hidden conversations error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.delete('/hidden/:type/:targetId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { type, targetId } = req.params;

    if (!['private', 'group'].includes(type)) {
        return res.status(400).json({ message: 'Invalid conversation type.' });
    }

    try {
        const [result] = await db.query(
            'DELETE FROM hidden_conversations WHERE user_id = ? AND conversation_type = ? AND target_id = ?',
            [userId, type, targetId]
        );

        if (result.affectedRows > 0 && req.io) {

            req.io.to(userId.toString()).emit('refresh conversations');
        }

        res.status(200).json({ message: 'Conversation unhidden successfully.' });
    } catch (error) {
        console.error("Unhide conversation error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
