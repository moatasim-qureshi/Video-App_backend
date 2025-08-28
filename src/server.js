const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");

const app = express();
const server = http.createServer(app);

// Serve a test route
app.get("/", (req, res) => {
  res.send("Signaling Server is Running 🚀");
});

// WebSocket signaling
const wss = new WebSocketServer({ server });

let users = [];

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error("Invalid JSON", e);
      return;
    }

    switch (data.type) {
      case "join":
        users.push(ws);
        console.log("User joined, total:", users.length);

        // If 2 users, notify them
        if (users.length === 2) {
          users.forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(
                JSON.stringify({ type: "ready", msg: "Peer found" })
              );
            }
          });
        }
        break;

      case "offer":
      case "answer":
      case "candidate":
        // Relay message to the other peer
        users.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
        break;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    // Remove the closed connection
    users = users.filter((u) => u !== ws);

    // Notify remaining peers that one left
    users.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: "peer-left" }));
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Signaling Server running on port ${PORT}`)
);
