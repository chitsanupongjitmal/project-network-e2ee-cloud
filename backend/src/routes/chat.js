
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');
const router = express.Router();

const encryptedUploadsDir = path.resolve(__dirname, '../../uploads/encrypted_files');

if (!fs.existsSync(encryptedUploadsDir)) {
    fs.mkdirSync(encryptedUploadsDir, { recursive: true });
}

router.post('/upload-encrypted-file', authenticateToken, async (req, res) => {
    try {
        const { fileData, originalName, mimeType } = req.body;
        if (!fileData) {
            return res.status(400).json({ message: 'No file data was provided.' });
        }
        const fileBuffer = Buffer.from(fileData, 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(originalName || '');
        const filename = `enc-${uniqueSuffix}${extension}`;
        const filePath = path.join(encryptedUploadsDir, filename);

        await fs.promises.writeFile(filePath, fileBuffer);
        const fileUrl = `/uploads/encrypted_files/${filename}`;
        
        res.status(200).json({
            message: 'File uploaded successfully',
            url: fileUrl,
            mimeType: mimeType,
        });
    } catch (err) {
        console.error("Error during file upload:", err);
        res.status(500).json({ message: "An error occurred during file upload." });
    }
});

router.get('/secure-download/:filename', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const { conversationType, conversationId } = req.query;
    const currentUserId = req.user.id;

    if (!conversationType || !conversationId || !filename) {
        return res.status(400).json({ message: 'Missing required parameters.' });
    }

    try {
        let isAuthorized = false;

        if (conversationType === 'private') {
            const peerUserId = parseInt(conversationId, 10);
            if (isNaN(peerUserId)) return res.status(400).json({ message: 'Invalid conversation ID.' });




            const userOneId = Math.min(currentUserId, peerUserId);
            const userTwoId = Math.max(currentUserId, peerUserId);

            const [friendship] = await db.query(
                "SELECT status FROM friendships WHERE user_one_id = ? AND user_two_id = ?",
                [userOneId, userTwoId]
            );


            if (friendship.length > 0 && friendship[0].status === 'accepted') {
                isAuthorized = true;
            }
        } else if (conversationType === 'group') {
            const groupId = parseInt(conversationId, 10);
            if (isNaN(groupId)) return res.status(400).json({ message: 'Invalid conversation ID.' });
            const [member] = await db.query(
                "SELECT status FROM group_members WHERE group_id = ? AND user_id = ?",
                [groupId, currentUserId]
            );
            if (member.length > 0 && member[0].status === 'accepted') {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'You are not authorized to access this file.' });
        }

        const secureFilePath = path.join(encryptedUploadsDir, path.basename(filename));
        if (!secureFilePath.startsWith(encryptedUploadsDir)) {
            return res.status(403).json({ message: 'Forbidden: Invalid file path.' });
        }

        res.sendFile(secureFilePath, (err) => {
            if (err) {
                if (err.code === "ENOENT") {
                    console.error(`File not found at path: ${secureFilePath}`);
                    return res.status(404).json({ message: 'File not found on server.' });
                }
                console.error("File send error:", err);
                return res.status(500).json({ message: 'Error sending file.' });
            }
        });

    } catch (error) {
        console.error("Secure download error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/history/:peerUsername', authenticateToken, async (req, res) => {
    try {
        const { peerUsername } = req.params;
        const currentUserId = req.user.id;
        const [peerUsers] = await db.query('SELECT id FROM users WHERE username = ?', [peerUsername]);
        if (peerUsers.length === 0) {
            return res.status(404).json({ message: `User '${peerUsername}' not found.` });
        }
        const peerUserId = peerUsers[0].id;
        const [messages] = await db.query(
            `SELECT pm.id, pm.sender_id, pm.message_text AS text, pm.timestamp, pm.is_read, pm.message_type AS type, pm.receiver_key_version, pm.is_unsent, u_sender.username AS sender, u_sender.avatar_url as senderAvatar, pm.reply_to_message_id, replied.message_text AS replied_text, replied.message_type AS replied_type, u_replied_sender.username AS replied_sender FROM private_messages pm JOIN users u_sender ON pm.sender_id = u_sender.id LEFT JOIN private_messages replied ON pm.reply_to_message_id = replied.id LEFT JOIN users u_replied_sender ON replied.sender_id = u_replied_sender.id WHERE (pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?) ORDER BY pm.timestamp ASC`,
            [currentUserId, peerUserId, peerUserId, currentUserId]
        );

        const processedMessages = messages.map(msg => {
            if (msg.reply_to_message_id) {
                msg.repliedTo = { text: msg.replied_text, type: msg.replied_type, sender: msg.replied_sender };
            }
            delete msg.replied_text;
            delete msg.replied_type;
            delete msg.replied_sender;
            return msg;
        });

        res.json(processedMessages);
    } catch (error) {
        console.error("Get chat history error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/history/:peerUsername', authenticateToken, async (req, res) => {
    try {
        const { peerUsername } = req.params;
        const currentUserId = req.user.id;
        const [peerUsers] = await db.query('SELECT id FROM users WHERE username = ?', [peerUsername]);
        if (peerUsers.length === 0) return res.status(404).json({ message: `User '${peerUsername}' not found.` });
        const peerUserId = peerUsers[0].id;
        await db.query('INSERT IGNORE INTO hidden_conversations (user_id, conversation_type, target_id) VALUES (?, ?, ?)', [currentUserId, 'private', peerUserId]);
        if (req.io) {
            const currentUserRoom = currentUserId.toString();
            req.io.to(currentUserRoom).emit('refresh conversations');
        }
        res.status(200).json({ message: 'Chat hidden successfully.' });
    } catch (error) {
        console.error("Hide chat history error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
