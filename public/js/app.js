/**
 * app.js
 * ------------------------------------------------------------------
 * Conecta a interface (cliques, formulários) com a sinalização via
 * Socket.IO e com as funções de WebRTC definidas em webrtc.js.
 *
 * Fluxo geral:
 *   HOST:    captura tela -> cria sala -> para cada viewer que entra,
 *            cria uma RTCPeerConnection e envia uma offer.
 *   VIEWER:  entra na sala -> recebe a offer do host -> responde com
 *            uma answer -> recebe a stream de vídeo remota.
 * ------------------------------------------------------------------
 */

const socket = io();

// ---------- Referências da UI ----------
const tabs = document.querySelectorAll(".tab");
const hostForm = document.getElementById("hostForm");
const viewerForm = document.getElementById("viewerForm");
const msgEl = document.getElementById("msg");
const setupCard = document.getElementById("setupCard");
const sessionView = document.getElementById("sessionView");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const roleBadge = document.getElementById("roleBadge");
const remoteVideo = document.getElementById("remoteVideo");
const fullscreenBtn = document.getElementById("fullscreenBtn");

// ---------- Estado da sessão atual ----------
let mode = "host";        // aba selecionada antes de entrar numa sala
let isHost = false;       // papel depois de entrar na sala
let localStream = null;   // stream de tela do host
let peerConnections = {}; // (host) viewerSocketId -> RTCPeerConnection
let hostConnection = null; // (viewer) única conexão com o host

// ---------- Alternar entre abas "Compartilhar" / "Assistir" ----------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    hostForm.style.display = mode === "host" ? "block" : "none";
    viewerForm.style.display = mode === "viewer" ? "block" : "none";
    setMessage("");
  });
});

function setMessage(text, isError = false) {
  msgEl.textContent = text;
  msgEl.className = "msg" + (isError ? " error" : "");
}

// ==========================================================
// HOST: iniciar compartilhamento
// ==========================================================
document.getElementById("startHostBtn").onclick = async () => {
  const roomId = document.getElementById("hostRoomInput").value.trim();
  if (!roomId) return setMessage("Digite um nome para a sala.", true);

  try {
    localStream = await captureScreen();
  } catch {
    return setMessage("Permissão de compartilhamento de tela negada.", true);
  }

  socket.emit("create-room", roomId);
};

socket.on("room-created", (roomId) => {
  isHost = true;
  enterSession(roomId, "TRANSMITINDO");

  // Se o usuário parar a captura pelo próprio navegador (botão nativo
  // "Parar compartilhamento"), encerramos a sessão também no app.
  localStream.getVideoTracks()[0].onended = stopSharing;
});

// Um novo espectador entrou: cria uma conexão dedicada para ele e
// envia a oferta WebRTC.
socket.on("viewer-joined", async (viewerId) => {
  const { pc, offer } = await createHostConnection({
    localStream,
    onIceCandidate: (candidate) =>
      socket.emit("signal", { to: viewerId, data: { candidate } }),
  });

  peerConnections[viewerId] = pc;
  socket.emit("signal", { to: viewerId, data: { sdp: offer } });
});

socket.on("viewer-left", (viewerId) => {
  peerConnections[viewerId]?.close();
  delete peerConnections[viewerId];
});

// ==========================================================
// VIEWER: entrar numa sala existente
// ==========================================================
document.getElementById("joinBtn").onclick = () => {
  const roomId = document.getElementById("viewerRoomInput").value.trim();
  if (!roomId) return setMessage("Digite o código da sala.", true);
  socket.emit("join-room", roomId);
};

socket.on("room-joined", (roomId) => {
  isHost = false;
  enterSession(roomId, "ASSISTINDO");
});

// ==========================================================
// Sinalização compartilhada (offer / answer / ICE candidates)
// ==========================================================
socket.on("signal", async ({ from, data }) => {
  if (isHost) {
    // Só tratamos candidatos ICE vindos do espectador; a offer/answer
    // do lado do host já foi tratada em "viewer-joined".
    if (data.candidate) await peerConnections[from]?.addIceCandidate(data.candidate);
    return;
  }

  // Lado do espectador
  if (data.sdp) {
    const { pc, answer } = await createViewerConnection({
      offer: data.sdp,
      onTrack: (stream) => (remoteVideo.srcObject = stream),
      onIceCandidate: (candidate) =>
        socket.emit("signal", { to: from, data: { candidate } }),
    });
    hostConnection = pc;
    socket.emit("signal", { to: from, data: { sdp: answer } });
  } else if (data.candidate && hostConnection) {
    await hostConnection.addIceCandidate(data.candidate);
  }
});

socket.on("room-error", (text) => setMessage(text, true));

socket.on("host-stopped", () => {
  setMessage("A transmissão foi encerrada.");
  resetToSetup();
});

// ==========================================================
// Helpers de UI / encerramento
// ==========================================================
function enterSession(roomId, roleText) {
  setupCard.style.display = "none";
  sessionView.classList.add("active");
  roomCodeLabel.textContent = roomId;
  roleBadge.textContent = roleText;
}

function resetToSetup() {
  sessionView.classList.remove("active");
  setupCard.style.display = "block";
  remoteVideo.srcObject = null;

  Object.values(peerConnections).forEach((pc) => pc.close());
  peerConnections = {};

  hostConnection?.close();
  hostConnection = null;

  stopStream(localStream);
  localStream = null;
}

function stopSharing() {
  if (isHost) socket.emit("stop-share");
  resetToSetup();
}

document.getElementById("stopBtn").onclick = stopSharing;

// ==========================================================
// Tela cheia (só faz sentido para o espectador, que é quem
// assiste ao vídeo do remoteVideo)
// ==========================================================
fullscreenBtn.onclick = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    remoteVideo.requestFullscreen?.();
  }
};
