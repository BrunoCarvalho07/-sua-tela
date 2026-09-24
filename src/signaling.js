/**
 * signaling.js
 * ------------------------------------------------------------------
 * Toda a lógica de sinalização WebRTC fica aqui: criar/entrar em
 * salas e repassar as mensagens de handshake (SDP/ICE) entre os
 * dois navegadores. Isso é chamado de "sinalização" porque o
 * servidor nunca vê o vídeo em si — só ajuda os dois peers a se
 * encontrarem e negociarem a conexão direta entre eles.
 *
 * Fluxo resumido de uma sessão:
 *   1. Host cria a sala (create-room) e liga a captura de tela.
 *   2. Espectador entra na sala (join-room).
 *   3. Servidor avisa o host que tem um novo espectador (viewer-joined).
 *   4. Host cria uma "oferta" WebRTC (offer) e envia via sinalização.
 *   5. Espectador responde com uma "resposta" (answer).
 *   6. Os dois trocam candidatos de rede (ICE candidates) até
 *      conseguirem se conectar diretamente (peer-to-peer).
 *   7. A partir daí, o vídeo flui direto entre os navegadores.
 * ------------------------------------------------------------------
 */

function registerSignalingHandlers(io, socket, roomManager) {
  // Guardamos a sala/papel atuais no próprio socket, para saber o
  // que limpar quando ele desconectar.
  socket.data.roomId = null;
  socket.data.role = null;

  socket.on("create-room", (roomId) => {
    const created = roomManager.createRoom(roomId, socket.id);
    if (!created) {
      socket.emit("room-error", "Essa sala já existe. Escolha outro nome.");
      return;
    }

    socket.data.roomId = roomId;
    socket.data.role = "host";
    socket.join(roomId);
    socket.emit("room-created", roomId);
  });

  socket.on("join-room", (roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit("room-error", "Sala não encontrada. Confira o código.");
      return;
    }

    roomManager.addViewer(roomId, socket.id);
    socket.data.roomId = roomId;
    socket.data.role = "viewer";
    socket.join(roomId);
    socket.emit("room-joined", roomId);

    // Avisa o host que alguém chegou, para ele iniciar a oferta WebRTC.
    io.to(room.hostId).emit("viewer-joined", socket.id);
  });

  // Repassa mensagens de sinalização (offer/answer/ICE candidate)
  // de um peer específico para outro, sem interpretar o conteúdo.
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  // O host pede para encerrar a transmissão manualmente.
  socket.on("stop-share", () => {
    const { roomId, role } = socket.data;
    if (role !== "host" || !roomId) return;

    io.to(roomId).emit("host-stopped");
    roomManager.deleteRoom(roomId);
  });

  // Limpeza automática quando a aba fecha, a conexão cai, etc.
  socket.on("disconnect", () => {
    const { roomId, role } = socket.data;
    if (!roomId) return;

    if (role === "host") {
      // Sem host, a sala inteira perde sentido: avisa todo mundo e apaga.
      io.to(roomId).emit("host-stopped");
      roomManager.deleteRoom(roomId);
    } else if (role === "viewer") {
      const room = roomManager.getRoom(roomId);
      roomManager.removeViewer(roomId, socket.id);
      if (room) io.to(room.hostId).emit("viewer-left", socket.id);
    }
  });
}

module.exports = registerSignalingHandlers;
