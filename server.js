const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

let users = {};

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

wss.on("connection", (connection) => {
  console.log("A new user connected.");

  connection.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error("Invalid JSON received:", e);
      data = {};
    }

    switch (data.type) {
      case "login":
        console.log(`User logged in as: ${data.name}`);
        if (users[data.name]) {
          sendTo(connection, {
            type: "login",
            success: false,
            message: "Username is already taken.",
          });
        } else {
          users[data.name] = connection;
          connection.name = data.name;
          sendTo(connection, { type: "login", success: true });
        }
        break;

      case "offer":
        console.log(
          `Forwarding offer from ${connection.name} to ${data.target}`
        );
        const offerTarget = users[data.target];
        if (offerTarget) {
          connection.otherName = data.target;
          sendTo(offerTarget, {
            type: "offer",
            offer: data.offer,
            name: connection.name,
          });
        } else {
          sendTo(connection, {
            type: "error",
            message: `User ${data.target} not found.`,
          });
        }
        break;

      case "answer":
        console.log(
          `Forwarding answer from ${connection.name} to ${data.target}`
        );
        const answerTarget = users[data.target];
        if (answerTarget) {
          connection.otherName = data.target;
          sendTo(answerTarget, { type: "answer", answer: data.answer });
        }
        break;

      case "candidate":
        const candidateTarget = users[data.target];
        if (candidateTarget) {
          sendTo(candidateTarget, {
            type: "candidate",
            candidate: data.candidate,
          });
        }
        break;

      case "leave":
        console.log(
          `User ${connection.name} is leaving the call with ${data.target}`
        );
        const leaveTarget = users[data.target];
        if (leaveTarget) {
          leaveTarget.otherName = null;
          sendTo(leaveTarget, { type: "leave" });
        }
        break;

      default:
        sendTo(connection, {
          type: "error",
          message: `Unrecognized message type: ${data.type}`,
        });
        break;
    }
  });

  connection.on("close", () => {
    console.log(`User ${connection.name} disconnected.`);
    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        const otherUser = users[connection.otherName];
        if (otherUser) {
          otherUser.otherName = null;
          sendTo(otherUser, { type: "leave" });
        }
      }
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
