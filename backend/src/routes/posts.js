
const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const postUploadsDir = path.resolve(__dirname, '../../uploads/posts');
if (!fs.existsSync(postUploadsDir)) {
    fs.mkdirSync(postUploadsDir, { recursive: true });
}

const mimeToExtension = (mimeType = '') => {
    const normalized = String(mimeType).toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'image/gif') return '.gif';
    return '';
};


router.get('/feed', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const [posts] = await db.query(
            `SELECT 
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.id AS user_id,
                u.username,
                u.avatar_url,
                COALESCE(r.name, 'user') AS role,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS liked_by_user
             FROM posts p
             JOIN users u ON p.user_id = u.id
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             ORDER BY p.created_at DESC
             LIMIT 50`,
            [userId]
        );
        res.json(posts);
    } catch (error) {
        console.error("Get feed error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


router.post('/:postId/like', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const [existingLike] = await db.query(
            'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );

        if (existingLike.length > 0) {
            await db.query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
            res.json({ message: 'Post unliked successfully.' });
        } else {
            await db.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
            res.json({ message: 'Post liked successfully.' });
        }
    } catch (error) {
        console.error("Like post error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


router.get('/:postId/comments', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const [comments] = await db.query(
            `SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
             FROM post_comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id = ?
             ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json(comments);
    } catch (error) {
        console.error("Get comments error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.post('/:postId/comments', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Comment content cannot be empty.' });
        }

        await db.query(
            'INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, userId, content]
        );
        
        res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
        console.error("Add comment error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { content, imageData, imageMimeType, imageOriginalName } = req.body;
        const userId = req.user.id;
        const normalizedContent = (content || '').trim();

        let imageUrl = null;

        if (imageData) {
            if (!imageMimeType || !String(imageMimeType).startsWith('image/')) {
                return res.status(400).json({ message: 'Invalid image type.' });
            }

            const fileBuffer = Buffer.from(imageData, 'base64');
            const maxBytes = 10 * 1024 * 1024;
            if (fileBuffer.length > maxBytes) {
                return res.status(400).json({ message: 'Image too large. Max size is 10MB.' });
            }

            const extension = mimeToExtension(imageMimeType) || path.extname(imageOriginalName || '') || '.jpg';
            const filename = `post-${userId}-${Date.now()}${extension}`;
            const filePath = path.join(postUploadsDir, filename);
            await fs.promises.writeFile(filePath, fileBuffer);
            imageUrl = `/uploads/posts/${filename}`;
        }

        if (!normalizedContent && !imageUrl) {
            return res.status(400).json({ message: 'Post must have text or image.' });
        }

        const [result] = await db.query(
            'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
            [userId, normalizedContent, imageUrl]
        );

        const [createdRows] = await db.query(
            `SELECT 
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.id AS user_id,
                u.username,
                u.avatar_url,
                COALESCE(r.name, 'user') AS role
             FROM posts p
             JOIN users u ON p.user_id = u.id
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             WHERE p.id = ? LIMIT 1`,
            [result.insertId]
        );

        res.status(201).json({
            message: 'Post created successfully.',
            post: createdRows[0] || null
        });
    } catch (error) {
        console.error("Create post error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
