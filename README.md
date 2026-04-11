# MiniRTC

A simple 1:1 WebRTC calling app. Users create or join a room by URL and can start audio/video calls with peer-to-peer media.

## Architecture

```
┌──────────┐   WebSocket   ┌──────────────────┐   WebSocket   ┌──────────┐
│  Client  │ ◄───────────► │ Signaling Server │ ◄───────────► │  Client  │
│ (React)  │               │   (Node + ws)    │               │ (React)  │
└────┬─────┘               └──────────────────┘               └────┬─────┘
     │                                                              │
     │              WebRTC (peer-to-peer audio/video)               │
     └──────────────────────────────────────────────────────────────┘
```

- **Signaling Server** — relays SDP offers/answers and ICE candidates between peers, manages room membership and presence. No media ever touches the server.
- **Client** — React SPA using browser-native WebRTC APIs (`RTCPeerConnection`, `getUserMedia`).

## Run Locally

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Install dependencies for both server and client
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Start
```bash
# Terminal 1: start signaling server
cd server
npm run dev    # ws://localhost:8080

# Terminal 2: start client
cd client
npm run dev    # http://localhost:5173
```

### Tests
```bash
cd server && npm test          # 24 tests (Jest)
cd client && npx vitest run    # 9 tests (Vitest)
```

## Manual Testing

### Two browser tabs (same machine)
1. Open http://localhost:5173
2. Click **Create Room**
3. Copy the URL and open it in a second browser tab
4. Click **Call** on either tab
5. Click **Accept** on the other tab
6. Both tabs should show local + remote video, with status **CALL: CONNECTED**

> Audio may not be noticeable on a single machine (same mic/speakers). Use headphones or mute one tab's mic to verify.

### Two devices via ngrok (cross-network)
```bash
# Terminal 1: start server
cd server && npm run dev

# Terminal 2: start client with network access
cd client && npm run dev --host

# Terminal 3: expose via ngrok (single tunnel)
ngrok http 5173
```

The client proxies WebSocket connections through Vite (`/ws` → `localhost:8080`), so only one ngrok tunnel is needed.

1. Open the ngrok HTTPS URL on both devices
2. One device creates a room, shares the link with the other
3. Follow the call flow above

> ~85% of connections work with STUN only. If both devices are behind symmetric NATs, the connection will fail (requires TURN, not included).

### Signaling server with wscat
```bash
npm install -g wscat

# Terminal 1
wscat -c ws://localhost:8080
> {"type":"join","roomId":"test-room"}

# Terminal 2
wscat -c ws://localhost:8080
> {"type":"join","roomId":"test-room"}
```

Useful for testing room join/leave, presence events, and error handling without a browser.

### WebRTC debugging
Open `chrome://webrtc-internals` in Chrome to inspect live PeerConnection stats: ICE state, candidate pairs, bytes sent/received, codec info.

## What's Built

- WebSocket signaling server with room management (max 2 users per room)
- Call flow with request/accept/decline and 30-second timeout
- Presence events (peer-joined, peer-left)
- SDP and ICE candidate relay
- Peer-to-peer audio + video via WebRTC
- UUID v4 room IDs (non-guessable)
- In-memory room state (no database needed)
- Mute/unmute and video on/off controls

## What's Skipped

- TURN server (using Google's free STUN servers — ~15% of real-world connections would fail without TURN)
- Authentication / user accounts
- Chat / messaging
- Multi-party calls (SFU)
- Persistent room history

## Documentation

- [DECISIONS.md](DECISIONS.md) — architectural tradeoffs, scaling analysis, cost considerations
- [plan.md](plan.md) — implementation plan and testing strategy
