
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;


const registerConnectionHandlers = require('./handlers/connectionHandler');
const registerChatHandlers = require('./handlers/chatHandler');
const registerSocialHandlers = require('./handlers/socialHandler');
const registerPrivateCallHandlers = require('./handlers/privateCallHandler');
const registerGroupCallHandlers = require('./handlers/groupCallHandler');

function initializeSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: [
                "http://localhost:3000",
                "http://localhost:5173",
                "https://localhost:5173",
                "https://192.168.100.7:5173"
            ],
            methods: ["GET", "POST"]
        }
    });


    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error: Token not provided'));
        
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return next(new Error('Authentication error: Invalid token'));
            socket.user = user;
            next();
        });
    });

    const onConnection = (socket) => {

        registerConnectionHandlers(io, socket);
        registerChatHandlers(io, socket);
        registerSocialHandlers(io, socket);
        registerPrivateCallHandlers(io, socket);
        registerGroupCallHandlers(io, socket);
    }

    io.on('connection', onConnection);

    return io;
}


module.exports = { initializeSocket };