const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

        const [rows] = await db.query(
            `SELECT
                ch.id,
                ch.call_type,
                ch.mode,
                ch.status,
                ch.caller_id,
                ch.callee_id,
                ch.group_id,
                ch.started_at,
                ch.ended_at,
                ch.duration_seconds,
                ch.created_at,
                caller.username AS caller_username,
                callee.username AS callee_username,
                g.name AS group_name
             FROM call_history ch
             LEFT JOIN users caller ON caller.id = ch.caller_id
             LEFT JOIN users callee ON callee.id = ch.callee_id
             LEFT JOIN \`groups\` g ON g.id = ch.group_id
             WHERE
                (ch.call_type = 'private' AND (ch.caller_id = ? OR ch.callee_id = ?))
                OR
                (ch.call_type = 'group' AND EXISTS (
                    SELECT 1
                    FROM group_members gm
                    WHERE gm.group_id = ch.group_id
                      AND gm.user_id = ?
                      AND gm.status = 'accepted'
                ))
             ORDER BY COALESCE(ch.started_at, ch.created_at) DESC
             LIMIT ?`,
            [userId, userId, userId, limit]
        );

        return res.json(rows);
    } catch (error) {
        console.error('Get call history error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
