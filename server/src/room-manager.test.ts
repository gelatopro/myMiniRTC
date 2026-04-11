import { RoomManager, RoomFullError } from './room-manager';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  describe('createUser', () => {
    it('creates a user with a unique id and no room', () => {
      const user = manager.createUser();
      expect(user.id).toBeDefined();
      expect(user.roomId).toBeNull();
    });

    it('creates users with different ids', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();
      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('joinRoom', () => {
    it('creates a new room when joining a non-existent room', () => {
      const user = manager.createUser();
      const { room, peers } = manager.joinRoom(user, 'room-1');

      expect(room.id).toBe('room-1');
      expect(room.users.size).toBe(1);
      expect(peers).toEqual([]);
      expect(user.roomId).toBe('room-1');
    });

    it('joins an existing room and returns current peers', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      const { peers } = manager.joinRoom(user2, 'room-1');

      expect(peers).toEqual([user1.id]);
    });

    it('throws RoomFullError when room has 2 users', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();
      const user3 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      manager.joinRoom(user2, 'room-1');

      expect(() => manager.joinRoom(user3, 'room-1')).toThrow(RoomFullError);
    });

    it('tracks room count correctly', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      manager.joinRoom(user2, 'room-2');

      expect(manager.roomCount).toBe(2);
    });
  });

  describe('leaveRoom', () => {
    it('returns null when user is not in a room', () => {
      const user = manager.createUser();
      expect(manager.leaveRoom(user)).toBeNull();
    });

    it('removes user from room and returns remaining users', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      manager.joinRoom(user2, 'room-1');

      const result = manager.leaveRoom(user1);
      expect(result).toEqual({
        roomId: 'room-1',
        remainingUsers: [user2.id],
      });
      expect(user1.roomId).toBeNull();
    });

    it('cleans up empty rooms', () => {
      const user = manager.createUser();
      manager.joinRoom(user, 'room-1');
      manager.leaveRoom(user);

      expect(manager.getRoom('room-1')).toBeUndefined();
      expect(manager.roomCount).toBe(0);
    });

    it('allows new user to join after someone leaves a full room', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();
      const user3 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      manager.joinRoom(user2, 'room-1');
      manager.leaveRoom(user1);

      expect(() => manager.joinRoom(user3, 'room-1')).not.toThrow();
    });
  });

  describe('getPeers', () => {
    it('returns empty array when user is not in a room', () => {
      const user = manager.createUser();
      expect(manager.getPeers(user.id)).toEqual([]);
    });

    it('returns peer ids excluding the requesting user', () => {
      const user1 = manager.createUser();
      const user2 = manager.createUser();

      manager.joinRoom(user1, 'room-1');
      manager.joinRoom(user2, 'room-1');

      expect(manager.getPeers(user1.id)).toEqual([user2.id]);
      expect(manager.getPeers(user2.id)).toEqual([user1.id]);
    });
  });
});
