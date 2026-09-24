/**
 * webrtc.js
 * ------------------------------------------------------------------
 * Concentra tudo que é específico de WebRTC: configuração dos
 * servidores STUN, criação de RTCPeerConnection e a lógica de
 * criar/receber offer e answer. Fica separado de app.js para que
 * a parte de UI não precise conhecer detalhes de WebRTC.
 * ------------------------------------------------------------------
 */

// Servidor STUN público do Google: ajuda os dois peers a descobrirem
// seu endereço de rede público, necessário para conexões através da
// internet (fora da mesma rede local).
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Lado do HOST: cria uma conexão para UM espectador específico,
 * adiciona a stream da tela e devolve a oferta (offer) já pronta
 * para ser enviada via sinalização.
 */
async function createHostConnection({ localStream, onIceCandidate }) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  return { pc, offer };
}

/**
 * Lado do ESPECTADOR: recebe a oferta do host, monta a conexão e
 * devolve a resposta (answer) para ser enviada de volta.
 */
async function createViewerConnection({ offer, onTrack, onIceCandidate }) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.ontrack = (event) => onTrack(event.streams[0]);
  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  return { pc, answer };
}

/** Pede ao navegador acesso à tela/janela que o usuário escolher. */
function captureScreen() {
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
}

/** Encerra todas as tracks de uma stream local (para soltar a captura de tela). */
function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
