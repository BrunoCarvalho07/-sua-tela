/**
 * webrtc.js
 * ------------------------------------------------------------------
 * Concentra tudo que é específico de WebRTC: configuração dos
 * servidores STUN, criação de RTCPeerConnection e a lógica de
 * criar/receber offer e answer. Fica separado de app.js para que
 * a parte de UI não precise conhecer detalhes de WebRTC.
 *
 * Também cuida da QUALIDADE ADAPTATIVA da transmissão: em vez de
 * mandar a tela numa taxa de bits fixa (que trava quando a rede do
 * espectador não aguenta), configuramos o navegador para preferir
 * reduzir a RESOLUÇÃO automaticamente e manter os quadros por
 * segundo fluidos — assim a experiência é "imagem um pouco mais
 * simples, mas sem engasgar" em vez de travadinhas constantes.
 * ------------------------------------------------------------------
 */

// Servidor STUN público do Google: ajuda os dois peers a descobrirem
// seu endereço de rede público, necessário para conexões através da
// internet (fora da mesma rede local).
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Teto de banda para o vídeo da tela. 2.5 Mbps dá uma imagem nítida
// o suficiente pra ler texto na maioria das redes domésticas, sem
// exigir uma conexão muito rápida do espectador. Ajuste se quiser
// mais nitidez (custa mais banda) ou mais estabilidade (menos banda).
const MAX_VIDEO_BITRATE_BPS = 2_500_000;

/**
 * Ajusta os parâmetros de envio de um RTCRtpSender de vídeo para
 * priorizar fluidez sobre resolução quando a rede aperta.
 *
 * degradationPreference: "maintain-framerate" é o que faz o
 * navegador reduzir a resolução (em vez de derrubar os FPS) quando
 * detecta que a rede não está dando conta da taxa de bits atual.
 */
async function applyAdaptiveQuality(sender) {
  if (!sender || sender.track?.kind !== "video") return;

  const params = sender.getParameters();
  params.degradationPreference = "maintain-framerate";

  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE_BPS;

  try {
    await sender.setParameters(params);
  } catch (err) {
    // Alguns navegadores mais antigos não suportam todos esses campos —
    // nesse caso seguimos com o comportamento padrão do navegador.
    console.warn("Não foi possível aplicar qualidade adaptativa:", err);
  }
}

/**
 * Lado do HOST: cria uma conexão para UM espectador específico,
 * adiciona a stream da tela e devolve a oferta (offer) já pronta
 * para ser enviada via sinalização.
 */
async function createHostConnection({ localStream, onIceCandidate }) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  for (const track of localStream.getTracks()) {
    // Avisa o navegador que é conteúdo com movimento (cursor, janelas
    // se movendo, etc.), o que ajuda o codificador a priorizar
    // fluidez de forma coerente com o degradationPreference abaixo.
    if (track.kind === "video") track.contentHint = "motion";

    const sender = pc.addTrack(track, localStream);
    await applyAdaptiveQuality(sender);
  }

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

/**
 * Pede ao navegador acesso à tela/janela que o usuário escolher.
 * Limitamos a captura a 1080p/30fps: capturar em resolução muito
 * alta (ex: 4K) sem necessidade só aumenta a chance de travamentos,
 * já que gera muito mais dado pra codificar e transmitir.
 */
function captureScreen() {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: true,
  });
}

/** Encerra todas as tracks de uma stream local (para soltar a captura de tela). */
function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
