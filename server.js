require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Store active rooms and their participants
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      host: socket.id,
      participants: new Set([socket.id]),
      currentUrl: null
    });
    socket.join(roomId);
    socket.emit('room-created', { roomId });
  });

  socket.on('join-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.participants.add(socket.id);
      socket.join(roomId);
      socket.emit('room-joined', { 
        roomId,
        currentUrl: room.currentUrl
      });
      io.to(roomId).emit('participant-joined', { 
        participantId: socket.id,
        count: room.participants.size
      });
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on('url-change', ({ roomId, url }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.currentUrl = url;
      socket.to(roomId).emit('url-changed', { url });
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        if (room.participants.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('participant-left', { 
            participantId: socket.id,
            count: room.participants.size
          });
        }
      }
    });
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});