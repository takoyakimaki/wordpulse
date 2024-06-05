import express from 'express';
import http from 'http';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

// Helper to get __dirname in ES6 module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server by passing the Express app
const server = http.createServer(app);

// Integrate WebSocket with the HTTP server
const wss = new WebSocketServer({ server });

// Store the rooms in an object
const rooms = {};

// Create a room
const createRoom = (data, ws) => {
    if (!rooms[data.room]) {
        rooms[data.room] = {
            name: data.name,
            clients: [ws],
            words: [],
        };
        console.log('User created room:', data.room);

        ws.send(
            JSON.stringify({
                type: 'room-created',
                room: data.room,
                name: data.name,
                participants: 1,
            }),
        );
    }
};

// Join a room
const joinRoom = (data, ws) => {
    if (rooms[data.room]) {
        rooms[data.room].clients.push(ws);
        console.log('User joined room:', data.room);

        const response = JSON.stringify({
            type: 'room-joined',
            room: data.room,
            name: rooms[data.room].name,
            participants: rooms[data.room].clients.length,
            words: rooms[data.room].words,
        });

        rooms[data.room].clients.forEach((client) => client.send(response));
    }
};

// Add words to a room
const addWord = (data) => {
    if (rooms[data.room]) {
        const words = data.words.split(' ');
        rooms[data.room].words.push(...words);

        const response = JSON.stringify({
            type: 'words-added',
            room: data.room,
            words: rooms[data.room].words,
        });

        rooms[data.room].clients.forEach((client) => client.send(response));
    }
};

// Handle incoming messages
const handleMessage = (ws, message) => {
    const data = JSON.parse(message);

    switch (data.type) {
        case 'create-room':
            createRoom(data, ws);
            break;
        case 'join-room':
            joinRoom(data, ws);
            break;
        case 'add-word':
            addWord(data);
            break;
        default:
            console.error('Unknown message type:', data.type);
    }
};

// Handle closing connections
const handleClose = (ws) => {
    for (const room in rooms) {
        const index = rooms[room].clients.indexOf(ws);
        if (index > -1) {
            rooms[room].clients.splice(index, 1);

            const response = JSON.stringify({
                type: 'room-joined',
                room: room,
                name: rooms[room].name,
                participants: rooms[room].clients.length,
            });

            rooms[room].clients.forEach((client) => client.send(response));
        }
    }
};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    ws.on('message', (message) => handleMessage(ws, message));
    ws.on('close', () => handleClose(ws));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
