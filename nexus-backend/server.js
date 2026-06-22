const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const initVideoCallSocket = require('./socket/videoCall');

dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'https://nexus-one-rouge.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Serve uploaded documents/signatures as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch((err) => console.log('MongoDB error:', err));

app.get('/', (req, res) => {
  res.json({ message: 'Nexus Backend is running!' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// Create a raw HTTP server so Socket.IO can attach to it
const server = http.createServer(app);

// Socket.IO setup (same CORS origins as Express, for the video call signaling)
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'https://nexus-one-rouge.vercel.app'],
    credentials: true,
  },
});

// Register WebRTC signaling event handlers
initVideoCallSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});