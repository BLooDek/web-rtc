const users = new Map();
const userPeers = new Map();

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

export const addUser = (name, ws) => {
  if (users.has(name)) {
    return false;
  }
  users.set(name, ws);
  ws.name = name;
  return true;
};

export const removeUser = (ws) => {
  if (!ws.name) return;

  const peerName = userPeers.get(ws.name);
  if (peerName) {
    const peerWs = users.get(peerName);
    if (peerWs) {
      sendTo(peerWs, { type: "leave" });
      userPeers.delete(peerName);
    }
  }
  users.delete(ws.name);
  userPeers.delete(ws.name);
};

export const linkPeers = (user, peer) => {
  userPeers.set(user, peer);
  userPeers.set(peer, user);
};

export const forwardMessage = (fromUser, message) => {
  const targetUser = users.get(message.target);
  if (targetUser) {
    const outgoingMessage = { ...message, name: fromUser };
    sendTo(targetUser, outgoingMessage);
  }
};
