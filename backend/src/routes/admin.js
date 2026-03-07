
const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'super-admin') {
        return res.status(403).json({ message: 'Forbidden: Super admin access required.' });
    }
    next();
};

router.use(authenticateToken, requireSuperAdmin);

router.get('/roles', async (_req, res) => {
    try {
        const [roles] = await db.query('SELECT id, name FROM roles ORDER BY name ASC');
        res.json(roles);
    } catch (error) {
        console.error('Admin roles fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/users', async (_req, res) => {
    try {
        const [users] = await db.query(
            `SELECT 
                u.id,
                u.username,
                u.avatar_url,
                u.approval_status,
                u.can_create_group,
                COALESCE(r.name, 'user') AS role
             FROM users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             ORDER BY u.username ASC`
        );
        res.json(users);
    } catch (error) {
        console.error('Admin users fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/users/:userId/role', async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || typeof role !== 'string') {
            return res.status(400).json({ message: 'Role is required.' });
        }

        if (Number(userId) === req.user.id) {
            return res.status(400).json({ message: 'You cannot modify your own role.' });
        }

        const normalizedRole = role.toLowerCase();

        let roleId;
        const [existingRole] = await db.query('SELECT id FROM roles WHERE name = ?', [normalizedRole]);
        if (existingRole.length === 0) {
            const [insertRole] = await db.query('INSERT INTO roles (name) VALUES (?)', [normalizedRole]);
            roleId = insertRole.insertId;
        } else {
            roleId = existingRole[0].id;
        }

        await db.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)',
            [userId, roleId]
        );

        res.json({ message: 'Role updated successfully.' });
    } catch (error) {
        console.error('Admin update role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/users/:userId/approval', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        const normalizedStatus = (status || '').toLowerCase();
        const allowedStatuses = new Set(['pending', 'approved', 'rejected']);

        if (!allowedStatuses.has(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status. Use pending, approved or rejected.' });
        }

        const [result] = await db.query(
            'UPDATE users SET approval_status = ? WHERE id = ?',
            [normalizedStatus, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({ message: 'Approval status updated successfully.' });
    } catch (error) {
        console.error('Admin update approval error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/users/:userId/group-create-permission', async (req, res) => {
    try {
        const { userId } = req.params;
        const { canCreateGroup } = req.body;

        if (typeof canCreateGroup !== 'boolean') {
            return res.status(400).json({ message: 'canCreateGroup must be boolean.' });
        }

        const [result] = await db.query(
            'UPDATE users SET can_create_group = ? WHERE id = ?',
            [canCreateGroup ? 1 : 0, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({ message: 'Group creation permission updated successfully.' });
    } catch (error) {
        console.error('Admin update group create permission error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
