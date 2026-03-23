import { io } from 'socket.io-client';

let socket;

export function connectSocket(token) {
  if (!token) return null;
  if (socket) return socket;

  socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000', {
    transports: ['websocket'],
    auth: { token }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
