const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const crypto = require('crypto');
const forge = require('node-forge');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const PBKDF2_ITERATIONS = 100000; 

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
            'INSERT INTO users (username, password, public_key, public_key_version, encrypted_private_key, display_name) VALUES (?, ?, ?, ?, ?, ?)', 
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
        
        res.status(201).json({ message: 'User registered successfully' });
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
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role || 'user' }, 
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
            `SELECT u.avatar_url, u.show_online_status, u.public_key, u.display_name, r.name as role 
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

module.exports = router;
