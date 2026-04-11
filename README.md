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

### Server
```bash
cd server
npm install
npm run dev    # starts on ws://localhost:8080
```

### Client
```bash
cd client
npm install
npm run dev    # starts on http://localhost:5173
```

### Tests
```bash
cd server && npm test
cd client && npm test
```

## What's Built

- WebSocket signaling server with room management (max 2 users per room)
- Presence events (peer-joined, peer-left)
- SDP and ICE candidate relay
- UUID v4 room IDs (non-guessable)
- In-memory room state (no database needed)

## What's Skipped

- TURN server (using Google's free STUN servers — ~15% of real-world connections would fail without TURN)
- Authentication / user accounts
- Chat / messaging
- Multi-party calls (SFU)
- Persistent room history

## Documentation

- [DECISIONS.md](DECISIONS.md) — architectural tradeoffs, scaling analysis, cost considerations
- [plan.md](plan.md) — implementation plan and testing strategy
