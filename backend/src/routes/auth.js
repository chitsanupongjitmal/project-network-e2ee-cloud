const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const avatarUploadsDir = path.resolve(__dirname, '../../uploads/avatars');

const PBKDF2_ITERATIONS = 100000; 

if (!fs.existsSync(avatarUploadsDir)) {
    fs.mkdirSync(avatarUploadsDir, { recursive: true });
}

const mimeToExtension = (mimeType = '') => {
    const normalized = String(mimeType).toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'image/gif') return '.gif';
    return '';
};

const setupCryptoKeys = async (password) => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const saltBytes = crypto.randomBytes(16);
    const ivBytes = crypto.randomBytes(12);

    const keyBuffer = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, saltBytes, PBKDF2_ITERATIONS, 32, 'sha256', (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey);
        });
    });

    const key = forge.util.binary.raw.encode(keyBuffer);
    const iv = forge.util.binary.raw.encode(ivBytes);
    const cipher = forge.cipher.createCipher('AES-GCM', key);
    cipher.start({ iv, tagLength: 128 });
    cipher.update(forge.util.createBuffer(privateKey, 'utf8'));

    const success = cipher.finish();
    if (!success) {
        throw new Error("AES-GCM encryption failed during finish()");
    }

    const encrypted = cipher.output.getBytes();
    const tag = cipher.mode.tag.getBytes();

    const saltB64 = saltBytes.toString('base64');
    const ivB64 = ivBytes.toString('base64');
    const tagB64 = forge.util.encode64(tag);
    const encryptedB64 = forge.util.encode64(encrypted);

    return {
        publicKeyPem: publicKey,
        encryptedData: `${saltB64}:${ivB64}:${tagB64}:${encryptedB64}`
    };
};

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
        const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) return res.status(409).json({ message: 'Username already exists' });

        const { publicKeyPem, encryptedData } = await setupCryptoKeys(password); 
        const keyVersion = Date.now();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [userInsertResult] = await db.query(
            `INSERT INTO users (
                username, password, public_key, public_key_version, encrypted_private_key, display_name, approval_status, can_create_group
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
            [username, hashedPassword, publicKeyPem, keyVersion, encryptedData, username]
        );

        const newUserId = userInsertResult.insertId;

        const [existingRole] = await db.query('SELECT id FROM roles WHERE name = ?', ['user']);
        let userRoleId;
        if (existingRole.length === 0) {
            const [roleInsert] = await db.query('INSERT INTO roles (name) VALUES (?)', ['user']);
            userRoleId = roleInsert.insertId;
        } else {
            userRoleId = existingRole[0].id;
        }

        await db.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)',
            [newUserId, userRoleId]
        );
        
        res.status(201).json({ message: 'Registration submitted. Please wait for admin approval.' });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [users] = await db.query(
            `SELECT u.*, r.name as role 
             FROM users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE u.username = ?`, 
            [username]
        );

        if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

        const user = users[0];
        const approvalStatus = user.approval_status || 'approved';
        if (approvalStatus !== 'approved') {
            if (approvalStatus === 'pending') {
                return res.status(403).json({ message: 'Your account is pending admin approval.' });
            }
            return res.status(403).json({ message: 'Your account was rejected. Please contact an administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role || 'user',
                can_create_group: !!user.can_create_group,
                approval_status: approvalStatus
            },
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name || user.username,
                role: user.role || 'user',
                can_create_group: !!user.can_create_group,
                approval_status: approvalStatus,
                avatar_url: user.avatar_url,
                show_online_status: user.show_online_status,
                public_key: user.public_key
            },
            encryptedPrivateKey: user.encrypted_private_key,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/check-session', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.avatar_url, u.show_online_status, u.public_key, u.display_name, u.can_create_group, u.approval_status, r.name as role
             FROM users u
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE u.id = ?`, 
            [req.user.id]
        );

        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                avatar_url: users.length > 0 ? users[0].avatar_url : null,
                show_online_status: users.length > 0 ? !!users[0].show_online_status : true,
                public_key: users.length > 0 ? users[0].public_key : null,
                display_name: users.length > 0 ? (users[0].display_name || req.user.username) : req.user.username,
                role: users.length > 0 ? (users[0].role || 'user') : 'user',
                can_create_group: users.length > 0 ? !!users[0].can_create_group : false,
                approval_status: users.length > 0 ? (users[0].approval_status || 'approved') : 'approved'
            }
        });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});


router.put('/settings/display-name', authenticateToken, async (req, res) => {
     try {
        const { newDisplayName } = req.body;
        const currentUserId = req.user.id;
        if (!newDisplayName || newDisplayName.trim().length === 0) {
            return res.status(400).json({ message: 'Display name cannot be empty.' });
        }
        
        await db.query('UPDATE users SET display_name = ? WHERE id = ?', [newDisplayName.trim(), currentUserId]);
        
        const updatedUser = { 
            id: currentUserId, 
            username: req.user.username,
            display_name: newDisplayName.trim()
        };

        res.json({ message: 'Display name updated successfully.', user: updatedUser });
    } catch (error) { 
        console.error("Update display name error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/settings/avatar', authenticateToken, async (req, res) => {
    try {
        const { fileData, mimeType, originalName } = req.body;
        const currentUserId = req.user.id;

        if (!fileData || !mimeType) {
            return res.status(400).json({ message: 'fileData and mimeType are required.' });
        }

        if (!String(mimeType).startsWith('image/')) {
            return res.status(400).json({ message: 'Only image files are allowed.' });
        }

        const fileBuffer = Buffer.from(fileData, 'base64');
        const maxBytes = 5 * 1024 * 1024;
        if (fileBuffer.length > maxBytes) {
            return res.status(400).json({ message: 'Image too large. Max size is 5MB.' });
        }

        const extension = mimeToExtension(mimeType) || path.extname(originalName || '') || '.png';
        const filename = `avatar-${currentUserId}-${Date.now()}${extension}`;
        const filePath = path.join(avatarUploadsDir, filename);

        await fs.promises.writeFile(filePath, fileBuffer);
        const avatarUrl = `/uploads/avatars/${filename}`;

        const [previousRows] = await db.query('SELECT avatar_url FROM users WHERE id = ? LIMIT 1', [currentUserId]);
        const previousAvatarUrl = previousRows.length ? previousRows[0].avatar_url : null;

        await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, currentUserId]);

        if (previousAvatarUrl && previousAvatarUrl.startsWith('/uploads/avatars/')) {
            const previousFilename = path.basename(previousAvatarUrl);
            const previousPath = path.join(avatarUploadsDir, previousFilename);
            if (previousPath.startsWith(avatarUploadsDir)) {
                fs.promises.unlink(previousPath).catch(() => {});
            }
        }

        if (req.io) {
            req.io.to(String(currentUserId)).emit('profile updated', { userId: currentUserId, avatar_url: avatarUrl });

            const [friends] = await db.query(
                `SELECT u.id FROM users u
                 JOIN friendships f ON (f.user_one_id = u.id OR f.user_two_id = u.id)
                 WHERE (f.user_one_id = ? OR f.user_two_id = ?)
                 AND f.status = 'accepted' AND u.id != ?`,
                [currentUserId, currentUserId, currentUserId]
            );
            friends.forEach(({ id }) => {
                req.io.to(String(id)).emit('refresh conversations');
                req.io.to(String(id)).emit('profile updated', { userId: currentUserId, avatar_url: avatarUrl });
            });
        }

        return res.json({
            message: 'Profile image updated successfully.',
            user: {
                id: currentUserId,
                username: req.user.username,
                avatar_url: avatarUrl
            }
        });
    } catch (error) {
        console.error('Update avatar error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
