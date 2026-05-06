import { io } from 'socket.io-client';

let socket;

export function connectSocket(token) {
  if (!token) return null;
  if (socket) return socket;

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  let socketUrl = 'http://localhost:5004';
  if (apiBaseUrl) {
    try {
      socketUrl = new URL(apiBaseUrl).origin;
    } catch (_e) {
      // ignore invalid URL and keep default
    }
  }

  socket = io(socketUrl, {
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
