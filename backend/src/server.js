
require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initializeSocket } = require('./socket/socketHandler');


const authRoutes = require('./routes/auth');
const socialRoutes = require('./routes/social');
const postRoutes = require('./routes/posts');
const chatRoutes = require('./routes/chat');
const groupRoutes = require('./routes/groups');
const conversationRoutes = require('./routes/conversations');
const adminRoutes = require('./routes/admin');


const PORT = Number(process.env.PORT) || 4001;
const HTTP_PORT = Number(process.env.HTTP_PORT) || 80;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const FORCE_HTTP_TO_HTTPS = process.env.FORCE_HTTP_TO_HTTPS === 'true';
const CERT_KEY_PATH = process.env.CERT_KEY_PATH || path.join(__dirname, '../certs/key.pem');
const CERT_PATH = process.env.CERT_PATH || path.join(__dirname, '../certs/cert.pem');
const app = express();

function parseCorsOrigins() {
    const envOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (envOrigins.length > 0) return envOrigins;

    if (process.env.NODE_ENV !== 'production') {
        return [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://localhost:5173'
        ];
    }

    return [];
}

const allowedOrigins = parseCorsOrigins();
const corsOriginChecker = (origin, callback) => {
    if (!allowedOrigins.length || !origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'));
};

const server = (() => {
    if (!ENABLE_HTTPS) return http.createServer(app);

    try {
        const httpsOptions = {
            key: fs.readFileSync(CERT_KEY_PATH),
            cert: fs.readFileSync(CERT_PATH)
        };
        return https.createServer(httpsOptions, app);
    } catch (error) {
        console.error('Failed to start HTTPS server. Check certificate paths or disable ENABLE_HTTPS.');
        throw error;
    }
})();

const io = initializeSocket(server, allowedOrigins);

app.use(cors({
    origin: corsOriginChecker,
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/api', authRoutes);
app.use('/api', socialRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/admin', adminRoutes);

server.listen(PORT, '0.0.0.0', () => {
    const protocol = ENABLE_HTTPS ? 'https' : 'http';
    console.log(`Server is running on ${protocol}://0.0.0.0:${PORT}`);
});

if (ENABLE_HTTPS && FORCE_HTTP_TO_HTTPS) {
    const httpApp = express();
    httpApp.use((req, res) => {
        res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
    http.createServer(httpApp).listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`HTTP redirect server running on http://0.0.0.0:${HTTP_PORT}`);
    });
}
