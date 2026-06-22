// socket/videoCall.js
// Basic WebRTC signaling server using Socket.IO
// This server does NOT handle audio/video itself — it only relays
// connection info (offer/answer/ICE candidates) between two peers.
// Actual media streams flow peer-to-peer directly between browsers.

function initVideoCallSocket(io) {
  // roomId -> Set of socketIds currently in that room
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // 1. JOIN ROOM
    socket.on('join-room', ({ roomId, userId }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const roomUsers = rooms.get(roomId);

      // Tell the new user who is already in the room
      socket.emit('room-users', Array.from(roomUsers));

      roomUsers.add(socket.id);

      // Tell everyone else in the room that someone new joined
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
      });

      console.log(`User ${userId} joined room ${roomId}`);
    });

    // 2. WEBRTC OFFER — sent from caller to a specific peer
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', {
        from: socket.id,
        offer,
      });
    });

    // 3. WEBRTC ANSWER — sent from callee back to the caller
    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', {
        from: socket.id,
        answer,
      });
    });

    // 4. ICE CANDIDATES — exchanged continuously by both peers
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
      });
    });

    // 5. TOGGLE AUDIO/VIDEO — just relay state to others in room (for UI indicators)
    socket.on('toggle-media', ({ roomId, userId, audio, video }) => {
      socket.to(roomId).emit('peer-toggle-media', { userId, audio, video });
    });

    // 6. END CALL — user explicitly leaves
    socket.on('end-call', ({ roomId }) => {
      leaveRoom(socket, roomId);
    });

    // 7. DISCONNECT — handles tab close, refresh, network drop, etc.
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        leaveRoom(socket, roomId);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });

    function leaveRoom(socket, roomId) {
      if (!roomId) return;

      socket.leave(roomId);

      const roomUsers = rooms.get(roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) {
          rooms.delete(roomId);
        }
      }

      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userId: socket.data.userId,
      });
    }
  });
}

module.exports = initVideoCallSocket;