// test-socket.js
// Quick manual test: simulates 2 users joining the same room
// Run this on YOUR machine (not here) while your backend (npm run dev) is running.
//
// Setup:
//   1. cd into any folder
//   2. npm install socket.io-client
//   3. node test-socket.js
//
// Expected output: you should see both users join, exchange a fake offer/answer,
// and see "user-left" when one disconnects.

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000'; // change if your backend runs elsewhere
const ROOM_ID = 'test-room-1';

function createUser(label, userId) {
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`[${label}] connected as socket ${socket.id}`);
    socket.emit('join-room', { roomId: ROOM_ID, userId });
  });

  socket.on('room-users', (users) => {
    console.log(`[${label}] existing users in room:`, users);
  });

  socket.on('user-joined', (data) => {
    console.log(`[${label}] saw user join:`, data);

    // If user A sees user B join, send a fake "offer" to test relay
    if (label === 'UserA') {
      socket.emit('offer', { to: data.socketId, offer: { fake: 'sdp-offer' } });
    }
  });

  socket.on('offer', (data) => {
    console.log(`[${label}] received offer from ${data.from}:`, data.offer);
    socket.emit('answer', { to: data.from, answer: { fake: 'sdp-answer' } });
  });

  socket.on('answer', (data) => {
    console.log(`[${label}] received answer from ${data.from}:`, data.answer);
  });

  socket.on('user-left', (data) => {
    console.log(`[${label}] saw user leave:`, data);
  });

  return socket;
}

const userA = createUser('UserA', 'user-A-id');

setTimeout(() => {
  const userB = createUser('UserB', 'user-B-id');

  // After 3 seconds, disconnect UserB to test leave event
  setTimeout(() => {
    console.log('--- UserB disconnecting ---');
    userB.disconnect();
  }, 3000);

  // Exit script after 5 seconds total
  setTimeout(() => {
    userA.disconnect();
    process.exit(0);
  }, 5000);
}, 1000);
