"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = void 0;
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const https_1 = require("firebase-functions/v2/https");
const server = (0, http_1.createServer)();
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`Usuário conectado: ${userId}`);
    socket.on('join-ticket', (ticketId) => {
        socket.join(ticketId);
        console.log(`Usuário ${userId} entrou no ticket ${ticketId}`);
    });
    socket.on('leave-ticket', (ticketId) => {
        socket.leave(ticketId);
        console.log(`Usuário ${userId} saiu do ticket ${ticketId}`);
    });
    socket.on('new-comment', (_a) => {
        var { ticketId } = _a, comment = __rest(_a, ["ticketId"]);
        io.to(ticketId).emit(`comment:${ticketId}`, comment);
    });
    socket.on('typing', ({ ticketId, userId, isTyping }) => {
        socket.to(ticketId).emit(`typing:${ticketId}`, { userId, isTyping });
    });
    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${userId}`);
    });
});
exports.chat = (0, https_1.onRequest)((req, res) => {
    if (!server.listeners('request').length) {
        server.on('request', (req, res) => {
            if (req.url === '/socket.io/') {
                io.handleUpgrade(req, req.socket, Buffer.alloc(0));
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
    }
    server.emit('request', req, res);
});
//# sourceMappingURL=socket.js.map