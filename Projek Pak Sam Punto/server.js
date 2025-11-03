// server.js (CommonJS) - ready for Render
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Allow Socket.IO from any origin for testing; restrict later in production
const io = new Server(server, {
  cors: { origin: "*" },
});

// optional: serve static files (if you want to host Game.html from same service)
app.use(express.static(path.join(__dirname, "public")));

const rooms = {}; // { roomCode: { players: [], state: {} } }

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("createRoom", (code) => {
    if (rooms[code]) {
      socket.emit("error", "Room already exists");
      return;
    }
    rooms[code] = { players: [socket.id], state: null };
    socket.join(code);
    socket.emit("roomJoined", { code, playerId: socket.id, playerIndex: 1 });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on("joinRoom", (code) => {
    const room = rooms[code];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }
    if (room.players.length >= 4) {
      socket.emit("error", "Room is full");
      return;
    }
    room.players.push(socket.id);
    socket.join(code);
    const playerIndex = room.players.length;
    socket.emit("roomJoined", { code, playerId: socket.id, playerIndex });
    io.to(code).emit("playerJoined", { playerIndex });
    console.log(`${socket.id} joined room ${code} as Player ${playerIndex}`);
  });

  socket.on("stateUpdate", ({ room, state }) => {
    if (!rooms[room]) return;
    rooms[room].state = state;
    socket.to(room).emit("stateUpdate", state);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (rooms[room]) {
        rooms[room].players = rooms[room].players.filter((id) => id !== socket.id);
        if (rooms[room].players.length === 0) {
          delete rooms[room];
          console.log(`Deleted empty room ${room}`);
        }
      }
    }
  });
});

// Use the port given by Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
