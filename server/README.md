# MiniRTC Signaling Server

WebSocket-based signaling server for MiniRTC. Handles room membership, presence events, and relays WebRTC signaling messages (SDP offers/answers, ICE candidates) between peers.

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with auto-reload (tsx watch), default port 8080 |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run all tests |

Set `PORT` env var to change the listen port.

## Signaling Protocol

All messages are JSON over WebSocket.

### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `join` | `roomId` | Join or create a room |
| `leave` | — | Leave current room |
| `call-request` | — | Request a call with peer |
| `call-accepted` | — | Accept an incoming call |
| `call-declined` | — | Decline an incoming call |
| `call-ended` | — | End the current call |
| `offer` | `sdp` | Send SDP offer to peer |
| `answer` | `sdp` | Send SDP answer to peer |
| `ice-candidate` | `candidate` | Send ICE candidate to peer |

### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `joined` | `roomId`, `userId`, `peers` | Confirms room join |
| `peer-joined` | `userId` | A peer entered your room |
| `peer-left` | `userId` | A peer left your room |
| `call-request` | `from` | Peer wants to start a call |
| `call-accepted` | `from` | Peer accepted your call |
| `call-declined` | `from` | Peer declined your call |
| `call-ended` | `from` | Peer ended the call |
| `offer` | `sdp`, `from` | Relayed SDP offer |
| `answer` | `sdp`, `from` | Relayed SDP answer |
| `ice-candidate` | `candidate`, `from` | Relayed ICE candidate |
| `error` | `code`, `message` | Error occurred |

### Error Codes

| Code | When |
|------|------|
| `ROOM_FULL` | Room already has 2 users |
| `INVALID_ROOM_ID` | Empty or missing room ID |
| `NOT_IN_ROOM` | Sent signaling message without joining a room |
| `INVALID_MESSAGE` | Unparseable JSON |

## Manual Testing with wscat

Install: `npm install -g wscat`

**Terminal 1 — join a room:**
```bash
wscat -c ws://localhost:8080
> {"type":"join","roomId":"test-room"}
< {"type":"joined","roomId":"test-room","userId":"...","peers":[]}
```

**Terminal 2 — join the same room:**
```bash
wscat -c ws://localhost:8080
> {"type":"join","roomId":"test-room"}
< {"type":"joined","roomId":"test-room","userId":"...","peers":["<user1-id>"]}
# Terminal 1 receives: {"type":"peer-joined","userId":"<user2-id>"}
```

**Test signaling relay (from Terminal 1):**
```
> {"type":"offer","sdp":{"type":"offer","sdp":"fake-sdp"}}
# Terminal 2 receives the offer with a "from" field
```

**Test errors — 3rd terminal joining full room:**
```
> {"type":"join","roomId":"test-room"}
< {"type":"error","code":"ROOM_FULL","message":"..."}
```

**Test disconnect** — close Terminal 2 (ctrl+c), Terminal 1 receives `peer-left`.

## Project Structure

```
src/
  types.ts              # Signaling protocol type definitions
  room-manager.ts       # In-memory room state management
  signaling-server.ts   # WebSocket server + message routing
  index.ts              # Entry point
  room-manager.test.ts  # Room manager unit tests
  signaling-server.test.ts  # Integration tests using ws client
```
