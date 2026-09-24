/**
 * server.js — ponto de entrada da aplicação
 * ------------------------------------------------------------------
 * Sobe um servidor HTTP (Express, servindo os arquivos estáticos de
 * /public) e um servidor de WebSocket (Socket.IO) na mesma porta,
 * usado só para a sinalização WebRTC (ver src/signaling.js).
 *
 * O vídeo da tela compartilhada NUNCA passa por este servidor —
 * ele viaja direto entre os navegadores via WebRTC (peer-to-peer).
 * ------------------------------------------------------------------
 */

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const RoomManager = require("./src/roomManager");
const registerSignalingHandlers = require("./src/signaling");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // ajuste para o domínio do seu front-end em produção, se necessário
});

// Serve o front-end estático (public/index.html, css, js).
app.use(express.static(path.join(__dirname, "public")));

// Estado das salas fica todo isolado nesta instância.
const roomManager = new RoomManager();

io.on("connection", (socket) => {
  registerSignalingHandlers(io, socket, roomManager);
});

server.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
