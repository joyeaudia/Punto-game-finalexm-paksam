// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; // { roomCode: { players: [], state: {} } }

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("createRoom", (code) => {
    if (rooms[code]) {
      socket.emit("error", "Room code already exists");
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

    const playerIndex = room.players.length; // 2–4
    socket.emit("roomJoined", { code, playerId: socket.id, playerIndex });
    io.to(code).emit("playerJoined", { playerIndex });
    console.log(`${socket.id} joined room ${code} as Player ${playerIndex}`);
  });

  socket.on("stateUpdate", ({ room, state }) => {
    const r = rooms[room];
    if (r) {
      r.state = state;
      socket.to(room).emit("stateUpdate", state);
    }
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (rooms[room]) {
        rooms[room].players = rooms[room].players.filter((id) => id !== socket.id);
        if (rooms[room].players.length === 0) {
          delete rooms[room];
          console.log(`🗑️ Room ${room} deleted (empty)`);
        }
      }
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
