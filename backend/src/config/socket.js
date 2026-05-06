const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin:      process.env.FRONTEND_URL,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    // Use polling as fallback in environments that block WS
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    socket.join(`user:${userId}`);

    if (socket.user?.role === 'admin') {
      socket.join('admin');
    }

    logger.info('Socket connected', { userId, socketId: socket.id });

    // ── Typing indicator ──────────────────────────────────────────
    socket.on('chat:typing', ({ conversationId }) => {
      socket.to(`user:${userId}`).emit('chat:typing', { conversationId, userId });
    });

    // ── Presence update (admin dashboard) ────────────────────────
    io.to('admin').emit('presence:update', {
      userId,
      online: true,
      at: new Date().toISOString(),
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId, socketId: socket.id });
      io.to('admin').emit('presence:update', {
        userId,
        online: false,
        at: new Date().toISOString(),
      });
    });
  });

  return io;
};

module.exports = { initSocket };
