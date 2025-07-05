const loginSection = document.getElementById("login-section");
const callSection = document.getElementById("call-section");
const usernameInput = document.getElementById("username-input");
const loginBtn = document.getElementById("login-btn");
const peerUsernameInput = document.getElementById("peer-username-input");
const startCallBtn = document.getElementById("start-call-btn");
const shareScreenBtn = document.getElementById("share-screen-btn");
const hangUpBtn = document.getElementById("hang-up-btn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statusDiv = document.getElementById("status");

let localStream;
let peerConnection;
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
  iceServers,
};

function connectToSignalingServer() {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${wsProtocol}//${window.location.host}`);

  socket.onopen = () => {
    console.log("Connected to signaling server.");
  };

  socket.onmessage = (message) => {
    console.log("Got message:", message.data);
    const data = JSON.parse(message.data);

    switch (data.type) {
      case "login":
        handleLogin(data.success);
        break;
      case "offer":
        handleOffer(data.offer, data.name);
        break;
      case "answer":
        handleAnswer(data.answer);
        break;
      case "candidate":
        handleCandidate(data.candidate);
        break;
      case "leave":
        handleLeave();
        break;
      default:
        break;
    }
  };

  socket.onerror = (err) => {
    console.error("Signaling server error:", err);
  };
}

function sendToServer(msg) {
  socket.send(JSON.stringify(msg));
}

loginBtn.addEventListener("click", () => {
  username = usernameInput.value;
  if (username.length > 0) {
    connectToSignalingServer();
    setTimeout(() => {
      sendToServer({ type: "login", name: username });
    }, 500);
  } else {
    alert("Please enter a username.");
  }
});

function handleLogin(success) {
  if (success) {
    console.log("Login successful.");
    loginSection.style.display = "none";
    callSection.style.display = "block";
  } else {
    alert("Login failed. Username may be taken.");
  }
}

startCallBtn.addEventListener("click", () => {
  peerUsername = peerUsernameInput.value;
  if (peerUsername.length > 0) {
    startCall(false);
  } else {
    alert("Please enter a peer username.");
  }
});

shareScreenBtn.addEventListener("click", () => {
  peerUsername = peerUsernameInput.value;
  if (peerUsername.length > 0) {
    startCall(true);
  } else {
    alert("Please enter a peer username.");
  }
});

async function startCall(isScreenShare) {
  statusDiv.innerText = "Starting call...";
  try {
    if (isScreenShare) {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } else {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    }
    localVideo.srcObject = localStream;

    createPeerConnection();

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  } catch (error) {
    handleMediaError(error);
  }
}

function handleMediaError(error) {
  console.error("Error accessing media devices.", error);
  statusDiv.innerText = `Error: ${error.name}. See console for details.`;

  if (error.name === "NotAllowedError") {
    alert(
      "Permission to access camera/microphone was denied. Please enable it in your browser settings."
    );
  } else if (error.name === "NotFoundError") {
    alert("No camera/microphone found.");
  }
}

function createPeerConnection() {
  statusDiv.innerText = "Creating peer connection...";
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({
        type: "candidate",
        target: peerUsername,
        candidate: event.candidate,
      });
    }
  };

  peerConnection.ontrack = (event) => {
    statusDiv.innerText = "Remote stream received.";
    remoteVideo.srcObject = event.streams;
  };

  peerConnection.onnegotiationneeded = async () => {
    try {
      statusDiv.innerText = "Negotiation needed, creating offer...";
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendToServer({
        type: "offer",
        target: peerUsername,
        offer: peerConnection.localDescription,
      });
    } catch (error) {
      console.error("Error creating offer:", error);
      statusDiv.innerText = "Error creating offer.";
    }
  };

  peerConnection.onconnectionstatechange = () => {
    statusDiv.innerText = `Connection state: ${peerConnection.connectionState}`;
    console.log(
      `Connection state changed to: ${peerConnection.connectionState}`
    );
    if (peerConnection.connectionState === "connected") {
      hangUpBtn.disabled = false;
      startCallBtn.disabled = true;
      shareScreenBtn.disabled = true;
    }
    if (
      peerConnection.connectionState === "failed" ||
      peerConnection.connectionState === "disconnected" ||
      peerConnection.connectionState === "closed"
    ) {
      handleLeave();
    }
  };
}

async function handleOffer(offer, name) {
  peerUsername = name;
  createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendToServer({
      type: "answer",
      target: peerUsername,
      answer: peerConnection.localDescription,
    });
    statusDiv.innerText = "Call answered.";
  } catch (error) {
    handleMediaError(error);
  }
}

async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  statusDiv.innerText = "Call established.";
}

function handleCandidate(candidate) {
  if (candidate) {
    peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((e) => console.error("Error adding received ICE candidate", e));
  }
}

hangUpBtn.addEventListener("click", () => {
  sendToServer({ type: "leave", target: peerUsername });
  handleLeave();
});

function handleLeave() {
  statusDiv.innerText = "Call ended.";
  peerUsername = null;
  remoteVideo.srcObject = null;
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
  hangUpBtn.disabled = true;
  startCallBtn.disabled = false;
  shareScreenBtn.disabled = false;
}
