import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  roomId: string | null;
}

export interface Room {
  id: string;
  name?: string;
  users: Map<string, User>;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private userRooms = new Map<string, string>(); // userId → roomId

  createUser(): User {
    return { id: uuidv4(), roomId: null };
  }

  joinRoom(user: User, roomId: string, roomName?: string): { room: Room; peers: string[] } {
    let room = this.rooms.get(roomId);

    if (room && room.users.size >= 2) {
      throw new RoomFullError(roomId);
    }

    if (!room) {
      room = { id: roomId, name: roomName, users: new Map() };
      this.rooms.set(roomId, room);
    }

    const peers = Array.from(room.users.keys());

    room.users.set(user.id, user);
    user.roomId = roomId;
    this.userRooms.set(user.id, roomId);

    return { room, peers };
  }

  leaveRoom(user: User): { roomId: string; remainingUsers: string[] } | null {
    const roomId = this.userRooms.get(user.id);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users.delete(user.id);
    this.userRooms.delete(user.id);
    user.roomId = null;

    const remainingUsers = Array.from(room.users.keys());

    if (room.users.size === 0) {
      this.rooms.delete(roomId);
    }

    return { roomId, remainingUsers };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getUserRoom(userId: string): Room | undefined {
    const roomId = this.userRooms.get(userId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  getPeers(userId: string): string[] {
    const room = this.getUserRoom(userId);
    if (!room) return [];
    return Array.from(room.users.keys()).filter((id) => id !== userId);
  }

  updateRoomName(roomId: string, name: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.name = name;
    return true;
  }

  listRooms(): { roomId: string; roomName?: string; userCount: number }[] {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.id,
      roomName: room.name,
      userCount: room.users.size,
    }));
  }

  get roomCount(): number {
    return this.rooms.size;
  }
}

export class RoomFullError extends Error {
  constructor(roomId: string) {
    super(`Room ${roomId} is full (max 2 users)`);
    this.name = 'RoomFullError';
  }
}
