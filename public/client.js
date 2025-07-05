const loginSection = document.getElementById("login-section");
const connectSection = document.getElementById("connect-section");
const mediaSection = document.getElementById("media-section");
const usernameInput = document.getElementById("username-input");
const loginBtn = document.getElementById("login-btn");
const peerUsernameInput = document.getElementById("peer-username-input");
const connectBtn = document.getElementById("connect-btn");
const startCallBtn = document.getElementById("start-call-btn");
const shareScreenBtn = document.getElementById("share-screen-btn");
const hangUpBtn = document.getElementById("hang-up-btn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statusBar = document.getElementById("status-bar");

let localStream;
let peerConnection;
let dataChannel;
let socket;
let username;
let peerUsername;

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:5349" },
  { urls: "stun:stun1.l.google.com:3478" },
  { urls: "stun:stun1.l.google.com:5349" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:5349" },
  { urls: "stun:stun3.l.google.com:3478" },
  { urls: "stun:stun3.l.google.com:5349" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:5349" },
];

const configuration = {
  iceServers /*: [{ urls: "stun:stun.l.google.com:19302" }],*/,
};

function connectToSignalingServer() {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${wsProtocol}//${window.location.host}`);

  socket.onopen = () => console.log("Connected to signaling server.");
  socket.onmessage = handleSignalingMessage;
  socket.onerror = (err) => console.error("Signaling server error:", err);
}

function sendToServer(msg) {
  socket.send(JSON.stringify(msg));
}

async function handleSignalingMessage(message) {
  const data = JSON.parse(message.data);
  console.log("Got message:", data.type);

  switch (data.type) {
    case "login":
      handleLogin(data.success);
      break;
    case "offer":
      await handleOffer(data.offer, data.name);
      break;
    case "answer":
      await handleAnswer(data.answer);
      break;
    case "candidate":
      await handleCandidate(data.candidate);
      break;
    case "leave":
      handleLeave();
      break;
    default:
      break;
  }
}

loginBtn.addEventListener("click", () => {
  username = usernameInput.value;
  if (username.length > 0) {
    connectToSignalingServer();
    setTimeout(() => sendToServer({ type: "login", name: username }), 500);
  } else {
    alert("Please enter a username.");
  }
});

connectBtn.addEventListener("click", () => {
  peerUsername = peerUsernameInput.value;
  if (peerUsername.length > 0 && peerUsername !== username) {
    initiateConnection();
  } else {
    alert("Please enter a valid peer username.");
  }
});

startCallBtn.addEventListener("click", () => startMedia(false));
shareScreenBtn.addEventListener("click", () => startMedia(true));
hangUpBtn.addEventListener("click", () => {
  sendToServer({ type: "leave", target: peerUsername });
  handleLeave();
});

function handleLogin(success) {
  if (success) {
    loginSection.style.display = "none";
    connectSection.style.display = "flex";
    statusBar.innerText = `Logged in as ${username}. Ready to connect.`;
  } else {
    alert("Login failed. Username may be taken.");
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // **KEY FIX FOR FIREFOX:**
  // Initialize the remote stream and assign it to the video element upfront.
  // ensure remoteVideo.srcObject is always a valid MediaStream object.
  if (!remoteVideo.srcObject) {
    remoteVideo.srcObject = new MediaStream();
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({
        type: "candidate",
        target: peerUsername,
        candidate: event.candidate,
      });
    }
  };

  // **KEY FIX FOR FIREFOX:**
  // Add incoming tracks to the existing MediaStream on the video element.
  peerConnection.ontrack = (event) => {
    console.log("Remote track received:", event.track.kind);
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.addTrack(event.track);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    updateConnectionStatus(peerConnection.connectionState);
  };
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannelEvents();
  };
}

async function initiateConnection() {
  createPeerConnection();
  dataChannel = peerConnection.createDataChannel("messaging");
  setupDataChannelEvents();

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendToServer({
      type: "offer",
      target: peerUsername,
      offer: peerConnection.localDescription,
    });
  } catch (e) {
    console.error("Error creating initial offer:", e);
  }
}

async function handleOffer(offer, name) {
  if (!peerConnection) {
    peerUsername = name;
    createPeerConnection();
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  sendToServer({
    type: "answer",
    target: peerUsername,
    answer: peerConnection.localDescription,
  });
}

async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleCandidate(candidate) {
  if (candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("Error adding received ICE candidate", e);
    }
  }
}

function setupDataChannelEvents() {
  dataChannel.onopen = () => {
    console.log("Data channel is open!");
  };
  dataChannel.onmessage = (event) => {
    console.log("Data channel message:", event.data);
  };
}

async function startMedia(isScreenShare) {
  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    const streamConstraints = isScreenShare
      ? { video: true }
      : { video: true, audio: true };

    localStream = isScreenShare
      ? await navigator.mediaDevices.getDisplayMedia(streamConstraints)
      : await navigator.mediaDevices.getUserMedia(streamConstraints);

    localVideo.srcObject = localStream;

    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendToServer({
      type: "offer",
      target: peerUsername,
      offer: peerConnection.localDescription,
    });
  } catch (error) {
    console.error("Error starting media:", error);
    alert(`Could not start media. Error: ${error.name}`);
  }
}

function updateConnectionStatus(state) {
  statusBar.innerText = `Connection state: ${state}`;
  if (state === "connected") {
    connectSection.style.display = "none";
    mediaSection.style.display = "flex";
  }
  if (state === "failed" || state === "disconnected" || state === "closed") {
    handleLeave();
  }
}

function handleLeave() {
  statusBar.innerText = "Call ended.";
  peerUsername = null;

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
    remoteVideo.srcObject = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  mediaSection.style.display = "none";
  connectSection.style.display = "flex";
}
