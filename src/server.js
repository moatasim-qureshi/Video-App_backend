// const express = require("express");
// const { WebSocketServer } = require("ws");
// const http = require("http");

// const app = express();
// const server = http.createServer(app);

// // Serve a test route
// app.get("/", (req, res) => {
//   res.send("Signaling Server is Running 🚀");
// });

// // WebSocket signaling
// const wss = new WebSocketServer({ server });

// let users = [];

// wss.on("connection", (ws) => {
//   console.log("New client connected");

//   ws.on("message", (message) => {
//     let data;
//     try {
//       data = JSON.parse(message);
//     } catch (e) {
//       console.error("Invalid JSON", e);
//       return;
//     }

//     switch (data.type) {
//       case "join":
//         users.push(ws);
//         console.log("User joined, total:", users.length);

//         // If 2 users, notify them
//         if (users.length === 2) {
//           users.forEach((client, i) => {
//             client.send(
//               JSON.stringify({ type: "ready", msg: "Peer found" })
//             );
//           });
//         }
//         break;

//       case "offer":
//       case "answer":
//       case "candidate":
//         // Relay message to other peer
//         users.forEach((client) => {
//           if (client !== ws && client.readyState === ws.OPEN) {
//             client.send(JSON.stringify(data));
//           }
//         });
//         break;
//     }
//   });

//   ws.on("close", () => {
//     console.log("Client disconnected");
//     users = users.filter((u) => u !== ws);
//   });
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () =>
//   console.log(`Signaling Server running on port ${PORT}`)
// );

// server.js
const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (req, res) => {
  res.send("Signaling Server is Running 🚀");
});

// Rooms: { roomId: [ { id, ws } ] }
let rooms = {};

function broadcastToRoom(roomId, senderId, payload) {
  if (!rooms[roomId]) return;
  rooms[roomId].forEach((c) => {
    if (c.id !== senderId && c.ws.readyState === c.ws.OPEN) {
      c.ws.send(JSON.stringify(payload));
    }
  });
}

wss.on("connection", (ws) => {
  const id = crypto.randomBytes(8).toString("hex");
  console.log("✅ New WebSocket connection:", id);

  let currentRoom = null;

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error("❌ Invalid JSON from", id, e);
      return;
    }

    switch (data.type) {
      case "join": {
        const roomId = data.room || "default";
        currentRoom = roomId;

        rooms[roomId] = rooms[roomId] || [];

        // Avoid duplicate entry
        if (!rooms[roomId].some((c) => c.id === id)) {
          rooms[roomId].push({ id, ws });
        }

        ws.send(JSON.stringify({ type: "id", id }));

        if (rooms[roomId].length === 1) {
          ws.send(JSON.stringify({ type: "role", role: "impolite" }));
        } else if (rooms[roomId].length === 2) {
          const [first, second] = rooms[roomId];
          first.ws.send(JSON.stringify({ type: "role", role: "impolite" }));
          second.ws.send(JSON.stringify({ type: "role", role: "polite" }));

          rooms[roomId].forEach((c) =>
            c.ws.send(JSON.stringify({ type: "ready", msg: "Peer found" }))
          );
        } else if (rooms[roomId].length > 2) {
          // kick extra clients
          ws.send(JSON.stringify({ type: "full", msg: "Room is full (2 peers max)" }));
          ws.close();
        }
        break;
      }

      case "offer":
      case "answer":
      case "candidate":
      case "bye":
        broadcastToRoom(currentRoom, id, data);
        break;

      default:
        console.log("⚠️ Unhandled message type:", data.type);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected:", id);

    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter((c) => c.id !== id);

      if (rooms[currentRoom].length === 1) {
        rooms[currentRoom][0].ws.send(
          JSON.stringify({ type: "peer-left", msg: "Peer disconnected" })
        );
      }

      if (rooms[currentRoom].length === 0) {
        delete rooms[currentRoom];
      }
    }
  });

  ws.on("error", (err) => {
    console.error("⚠️ WS error for", id, err);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Signaling Server running on port ${PORT}`));
