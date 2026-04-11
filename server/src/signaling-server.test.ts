import WebSocket from 'ws';
import { SignalingServer } from './signaling-server';
import { ServerMessage } from './types';

let server: SignalingServer;
let port: number;

function createClient(): WebSocket {
  return new WebSocket(`ws://localhost:${port}`);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.on('open', resolve);
  });
}

function waitForClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.on('close', resolve);
  });
}

function waitForMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

beforeEach(async () => {
  // Use port 0 to get a random available port
  server = new SignalingServer({ port: 0 });
  const addr = server.address;
  port = addr!.port;
});

afterEach(async () => {
  await server.close();
});

describe('SignalingServer', () => {
  describe('join', () => {
    it('confirms join with userId and empty peers list', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      send(ws, { type: 'join', roomId: 'test-room' });
      const msg = await waitForMessage(ws);

      expect(msg.type).toBe('joined');
      if (msg.type === 'joined') {
        expect(msg.roomId).toBe('test-room');
        expect(msg.userId).toBeDefined();
        expect(msg.peers).toEqual([]);
      }

      ws.close();
    });

    it('notifies existing peer when new user joins', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      send(ws1, { type: 'join', roomId: 'test-room' });
      const joined1 = await waitForMessage(ws1);

      send(ws2, { type: 'join', roomId: 'test-room' });
      const [joined2, peerJoined] = await Promise.all([
        waitForMessage(ws2),
        waitForMessage(ws1),
      ]);

      expect(joined2.type).toBe('joined');
      if (joined2.type === 'joined') {
        expect(joined2.peers).toEqual([
          (joined1 as any).userId,
        ]);
      }

      expect(peerJoined.type).toBe('peer-joined');
      if (peerJoined.type === 'peer-joined') {
        expect(peerJoined.userId).toBe((joined2 as any).userId);
      }

      ws1.close();
      ws2.close();
    });

    it('rejects third user with ROOM_FULL error', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      const ws3 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2), waitForOpen(ws3)]);

      send(ws1, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws1);

      send(ws2, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws2);
      await waitForMessage(ws1); // peer-joined

      send(ws3, { type: 'join', roomId: 'test-room' });
      const msg = await waitForMessage(ws3);

      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('ROOM_FULL');
      }

      ws1.close();
      ws2.close();
      ws3.close();
    });

    it('returns error for empty room ID', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      send(ws, { type: 'join', roomId: '' });
      const msg = await waitForMessage(ws);

      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('INVALID_ROOM_ID');
      }

      ws.close();
    });
  });

  describe('disconnect', () => {
    it('notifies peer when user disconnects', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      send(ws1, { type: 'join', roomId: 'test-room' });
      const joined1 = await waitForMessage(ws1);

      send(ws2, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws2);
      await waitForMessage(ws1); // peer-joined

      ws2.close();
      const peerLeft = await waitForMessage(ws1);

      expect(peerLeft.type).toBe('peer-left');

      ws1.close();
    });
  });

  describe('signaling relay', () => {
    it('relays offer from one peer to another', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      send(ws1, { type: 'join', roomId: 'test-room' });
      const joined1 = await waitForMessage(ws1);

      send(ws2, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws2);
      await waitForMessage(ws1); // peer-joined

      const sdp = { type: 'offer' as const, sdp: 'v=0\r\n...' };
      send(ws1, { type: 'offer', sdp });

      const offer = await waitForMessage(ws2);
      expect(offer.type).toBe('offer');
      if (offer.type === 'offer') {
        expect(offer.sdp).toEqual(sdp);
        expect(offer.from).toBe((joined1 as any).userId);
      }

      ws1.close();
      ws2.close();
    });

    it('relays ICE candidates between peers', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      send(ws1, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws1);

      send(ws2, { type: 'join', roomId: 'test-room' });
      await waitForMessage(ws2);
      await waitForMessage(ws1); // peer-joined

      const candidate = { candidate: 'candidate:1 1 UDP ...', sdpMid: '0', sdpMLineIndex: 0 };
      send(ws1, { type: 'ice-candidate', candidate });

      const ice = await waitForMessage(ws2);
      expect(ice.type).toBe('ice-candidate');
      if (ice.type === 'ice-candidate') {
        expect(ice.candidate).toEqual(candidate);
      }

      ws1.close();
      ws2.close();
    });

    it('returns error when sending offer without being in a room', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      send(ws, { type: 'offer', sdp: { type: 'offer', sdp: 'test' } });
      const msg = await waitForMessage(ws);

      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('NOT_IN_ROOM');
      }

      ws.close();
    });
  });

  describe('invalid messages', () => {
    it('returns error for unparseable messages', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      ws.send('not json');
      const msg = await waitForMessage(ws);

      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('INVALID_MESSAGE');
      }

      ws.close();
      await waitForClose(ws);
    });
  });
});
