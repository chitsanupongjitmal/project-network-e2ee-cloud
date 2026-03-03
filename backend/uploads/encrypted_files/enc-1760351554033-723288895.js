
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


const HTTPS_PORT = process.env.PORT || 4001;
const HTTP_PORT = process.env.HTTP_PORT || 80; 
const app = express();


const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '../certs/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/cert.pem'))
};
const server = https.createServer(httpsOptions, app);


const io = initializeSocket(server);


const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost:5173",
    "https://192.168.100.7:5173"
];

app.use(cors({
    origin: allowedOrigins
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use('/api', authRoutes);
app.use('/api', socialRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/groups', groupRoutes);



app.use('/api/conversations', conversationRoutes);

app.get('/', (req, res) => {
    res.send('Server is running securely!');
});

const httpApp = express();
httpApp.use((req, res) => {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    console.log(`Redirecting HTTP request to: ${httpsUrl}`);
    res.redirect(301, httpsUrl);
});
const httpServer = http.createServer(httpApp);
httpServer.listen(HTTP_PORT, () => {
  console.log(`🚀 HTTP redirect server running on http://localhost:${HTTP_PORT}`);
});


server.listen(HTTPS_PORT, () => {
  console.log(`🚀 Main HTTPS server is listening securely on https://localhost:${HTTPS_PORT}`);
});