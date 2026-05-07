import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: false,
      autoConnect: false,
    });
  }
  return socket;
};

export const rejoinDriverRoom = (driverId: string | number) => {
  if (socket && socket.connected) {
    console.log(`[Socket] Re-joining driver room: driver_${driverId}`);
    socket.emit('join-driver', driverId);
  }
};

export const connectSocket = (userId: string | number, role: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    
    s.on('connect', () => {
      console.log('Connected to socket server');
      if (role === 'passenger') {
        s.emit('join-customer', userId);
      } else if (role === 'driver') {
        s.emit('join-driver', userId);
        s.emit('join-drivers');
      }
    });
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
