
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;


const registerConnectionHandlers = require('./handlers/connectionHandler');
const registerChatHandlers = require('./handlers/chatHandler');
const registerSocialHandlers = require('./handlers/socialHandler');
const registerPrivateCallHandlers = require('./handlers/privateCallHandler');
const registerGroupCallHandlers = require('./handlers/groupCallHandler');

function createOriginChecker(allowedOrigins = []) {
    if (!allowedOrigins.length) {
        return (_origin, callback) => callback(null, true);
    }

    return (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy: origin not allowed'));
    };
}

function initializeSocket(httpServer, allowedOrigins = []) {
    const io = new Server(httpServer, {
        cors: {
            origin: createOriginChecker(allowedOrigins),
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
