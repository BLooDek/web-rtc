import * as userManager from "../services/userManager.js";

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

export const handleConnection = (ws, wsInstance) => {
  console.log("A new user connected.");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error("Invalid JSON received:", e);
      return;
    }

    switch (data.type) {
      case "login":
        handleLogin(ws, data);
        break;

      case "offer":
      case "answer":
      case "candidate":
        handleForwarding(ws, data);
        break;

      case "leave":
        handleLeave(ws);
        break;

      default:
        sendTo(ws, {
          type: "error",
          message: `Unrecognized message type: ${data.type}`,
        });
        break;
    }
  });

  ws.on("close", () => {
    console.log(`User ${ws.name} disconnected.`);
    userManager.removeUser(ws);
  });
};

const handleLogin = (ws, data) => {
  console.log(`User trying to log in as: ${data.name}`);
  const success = userManager.addUser(data.name, ws);
  sendTo(ws, { type: "login", success });
  if (!success) {
    console.log(`Login failed for ${data.name}, username taken.`);
  }
};

const handleForwarding = (ws, data) => {
  console.log(`Forwarding '${data.type}' from ${ws.name} to ${data.target}`);
  if (data.type === "offer") {
    userManager.linkPeers(ws.name, data.target);
  }
  userManager.forwardMessage(ws.name, data);
};

const handleLeave = (ws) => {
  console.log(`User ${ws.name} is leaving the call.`);
  userManager.removeUser(ws);
};
