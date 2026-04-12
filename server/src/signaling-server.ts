import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager, RoomFullError, User } from './room-manager';
import { ClientMessage, ServerMessage } from './types';

export interface SignalingServerOptions {
  port: number;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private roomManager: RoomManager;
  private clients = new Map<WebSocket, User>();

  constructor(options: SignalingServerOptions) {
    this.roomManager = new RoomManager();
    this.wss = new WebSocketServer({ port: options.port });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket): void {
    const user = this.roomManager.createUser();
    this.clients.set(ws, user);
    this.log(`Client connected`, user.id);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        this.handleMessage(ws, user, message);
      } catch {
        this.log(`Invalid message from client`, user.id);
        this.send(ws, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Failed to parse message',
        });
      }
    });

    ws.on('close', () => this.handleDisconnect(ws, user));
    ws.on('error', () => this.handleDisconnect(ws, user));
  }

  private handleMessage(ws: WebSocket, user: User, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, user, message.roomId);
        break;
      case 'leave':
        this.handleLeave(ws, user);
        break;
      case 'call-request':
      case 'call-accepted':
      case 'call-declined':
      case 'call-ended':
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.relayToPeer(ws, user, message);
        break;
    }
  }

  private handleJoin(ws: WebSocket, user: User, roomId: string): void {
    if (!roomId || typeof roomId !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_ROOM_ID',
        message: 'Room ID is required',
      });
      return;
    }

    // Leave current room if in one
    if (user.roomId) {
      this.handleLeave(ws, user);
    }

    try {
      const { peers } = this.roomManager.joinRoom(user, roomId);
      this.log(`Joined room ${roomId} (${peers.length + 1}/2 in room)`, user.id);

      // Confirm join to the user
      this.send(ws, {
        type: 'joined',
        roomId,
        userId: user.id,
        peers,
      });

      // Notify existing peers
      this.broadcastToRoom(user.id, {
        type: 'peer-joined',
        userId: user.id,
      });
    } catch (err) {
      if (err instanceof RoomFullError) {
        this.log(`Rejected from room ${roomId} (full)`, user.id);
        this.send(ws, {
          type: 'error',
          code: 'ROOM_FULL',
          message: err.message,
        });
      }
    }
  }

  private handleLeave(ws: WebSocket, user: User): void {
    const result = this.roomManager.leaveRoom(user);
    if (!result) return;
    this.log(`Left room ${result.roomId}`, user.id);

    // Notify remaining peers
    for (const peerId of result.remainingUsers) {
      const peerWs = this.findSocketByUserId(peerId);
      if (peerWs) {
        this.send(peerWs, {
          type: 'peer-left',
          userId: user.id,
        });
      }
    }
  }

  private handleDisconnect(ws: WebSocket, user: User): void {
    this.log(`Client disconnected`, user.id);
    this.handleLeave(ws, user);
    this.clients.delete(ws);
  }

  private relayToPeer(
    ws: WebSocket,
    user: User,
    message: ClientMessage & { type: 'call-request' | 'call-accepted' | 'call-declined' | 'call-ended' | 'offer' | 'answer' | 'ice-candidate' },
  ): void {
    if (!user.roomId) {
      this.log(`Tried to send ${message.type} without being in a room`, user.id);
      this.send(ws, {
        type: 'error',
        code: 'NOT_IN_ROOM',
        message: 'You must join a room before sending signaling messages',
      });
      return;
    }

    const peers = this.roomManager.getPeers(user.id);
    if (peers.length === 0) return;

    this.log(`Relaying ${message.type} to peer ${peers[0]}`, user.id);

    const peerWs = this.findSocketByUserId(peers[0]);
    if (!peerWs) return;

    switch (message.type) {
      case 'call-request':
        this.send(peerWs, { type: 'call-request', from: user.id });
        break;
      case 'call-accepted':
        this.send(peerWs, { type: 'call-accepted', from: user.id });
        break;
      case 'call-declined':
        this.send(peerWs, { type: 'call-declined', from: user.id });
        break;
      case 'call-ended':
        this.send(peerWs, { type: 'call-ended', from: user.id });
        break;
      case 'offer':
        this.send(peerWs, { type: 'offer', sdp: message.sdp, from: user.id });
        break;
      case 'answer':
        this.send(peerWs, { type: 'answer', sdp: message.sdp, from: user.id });
        break;
      case 'ice-candidate':
        this.send(peerWs, { type: 'ice-candidate', candidate: message.candidate, from: user.id });
        break;
    }
  }

  private broadcastToRoom(senderId: string, message: ServerMessage): void {
    const peers = this.roomManager.getPeers(senderId);
    for (const peerId of peers) {
      const peerWs = this.findSocketByUserId(peerId);
      if (peerWs) {
        this.send(peerWs, message);
      }
    }
  }

  private findSocketByUserId(userId: string): WebSocket | undefined {
    for (const [ws, user] of this.clients) {
      if (user.id === userId) return ws;
    }
    return undefined;
  }

  private log(event: string, userId?: string): void {
    const timestamp = new Date().toISOString();
    const prefix = userId ? `[${userId.slice(0, 8)}]` : '';
    console.log(`${timestamp} ${prefix} ${event}`);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  get address(): { port: number } | null {
    const addr = this.wss.address();
    if (typeof addr === 'string') return null;
    return addr;
  }
}
