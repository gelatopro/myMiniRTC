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

## Demo

[Watch the demo video](https://drive.google.com/file/d/1aw3ZA6xUzD9rl0MJD2ZQjCMQt2pHQT3w/view?usp=drive_link)

## How to Run

### Prerequisites
- Node.js 18+
- npm
- [ngrok](https://ngrok.com/) (for cross-device testing)

### Quick Start

```bash
# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Terminal 1: start signaling server
cd server && npm run dev       # ws://localhost:8080

# Terminal 2: start client
cd client && npm run dev --host  # http://localhost:5173

# Terminal 3: expose via ngrok (single tunnel — WebSocket proxied through Vite)
ngrok http 5173
```

Open the ngrok HTTPS URL on two devices, create a room on one, share the link with the other, and call.

> ~85% of connections work with STUN only. If both devices are behind symmetric NATs, the connection will fail (requires TURN, not included in this prototype).

### Local Testing (single machine)

Two browser tabs also work:
1. Open http://localhost:5173
2. Click **Create Room**, copy the URL, open in a second tab
3. Click **Call** on either tab, **Accept** on the other

## Tests

```bash
cd server && npm test          # 24 tests (Jest)
cd client && npx vitest run    # 9 tests (Vitest)
```

## Manual Testing

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
- [docs/plan.md](docs/plan.md) — implementation plan and testing strategy
- [docs/PRD.md](docs/PRD.md) — product requirements
