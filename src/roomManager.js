/**
 * roomManager.js
 * ------------------------------------------------------------------
 * Responsável só por guardar o ESTADO das salas em memória.
 * Não sabe nada sobre Socket.IO nem sobre WebRTC — é só uma
 * estrutura de dados com funções auxiliares, o que facilita testar
 * e trocar por um armazenamento externo (ex: Redis) no futuro, caso
 * o app precise rodar em múltiplas instâncias.
 * ------------------------------------------------------------------
 */

class RoomManager {
  constructor() {
    // roomId -> { hostId: string, viewers: Set<string> }
    this.rooms = new Map();
  }

  /** Cria uma sala nova. Retorna false se o nome já estiver em uso. */
  createRoom(roomId, hostSocketId) {
    if (this.rooms.has(roomId)) return false;
    this.rooms.set(roomId, { hostId: hostSocketId, viewers: new Set() });
    return true;
  }

  /** Retorna os dados da sala, ou undefined se não existir. */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /** Adiciona um espectador a uma sala existente. */
  addViewer(roomId, viewerSocketId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.viewers.add(viewerSocketId);
    return true;
  }

  /** Remove um espectador (ex: quando ele desconecta). */
  removeViewer(roomId, viewerSocketId) {
    const room = this.rooms.get(roomId);
    if (room) room.viewers.delete(viewerSocketId);
  }

  /** Apaga a sala inteira (ex: quando o host encerra ou cai). */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  /**
   * Dado o id de um socket que caiu, descobre em qual sala ele estava
   * e qual era o seu papel (host ou viewer). Útil no evento "disconnect",
   * já que o cliente não avisa antes de cair.
   */
  findBySocketId(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.hostId === socketId) {
        return { roomId, role: "host" };
      }
      if (room.viewers.has(socketId)) {
        return { roomId, role: "viewer" };
      }
    }
    return null;
  }
}

module.exports = RoomManager;
