# MiniRTC Client

React SPA for MiniRTC. Handles room joining, call initiation (request/accept/decline), and peer-to-peer audio/video via browser-native WebRTC APIs.

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on http://localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npx vitest run` | Run all tests |
| `npx vitest run path/to/file.test.ts` | Run a single test file |

Requires the signaling server running on `ws://localhost:8080` (see `../server/`).

## How It Works

### Room Flow
1. User creates a room (generates UUID) or joins by pasting a room ID/link
2. Client opens a WebSocket to the signaling server and sends a `join` message
3. Presence events (`peer-joined`, `peer-left`) show when the other user arrives/leaves

### Call Flow
1. Either user clicks **Call** — sends `call-request` via signaling
2. Other user sees an incoming call banner with **Accept** / **Decline** (30s timeout)
3. On accept, the caller initiates WebRTC: creates `RTCPeerConnection`, gets media, sends SDP offer
4. Callee receives offer, gets media, sends SDP answer
5. ICE candidates trickle in via signaling — once connectivity is established, media flows peer-to-peer

### Key Technology
- **React + TypeScript + Vite** — SPA framework and build tooling
- **Browser WebRTC APIs** — `RTCPeerConnection`, `getUserMedia`, no third-party SDK
- **WebSocket** — connects to signaling server for room presence and SDP/ICE exchange
- **Google STUN servers** — NAT traversal for peer discovery (no TURN)
- **Vitest + React Testing Library** — unit tests

## Project Structure

```
src/
  types.ts                      # Signaling protocol types (mirrored from server)
  hooks/useWebSocket.ts         # WebSocket connection, send/receive messages
  hooks/useWebSocket.test.ts    # WebSocket hook tests
  hooks/useWebRTC.ts            # RTCPeerConnection, media streams, ICE
  pages/Home.tsx                # Create/join room landing page
  pages/Home.test.tsx           # Home page tests
  pages/Room.tsx                # Call UI — video, controls, call signaling
  components/VideoPlayer.tsx    # Video element with MediaStream binding
  styles.css                    # Dark theme UI
  App.tsx                       # Router setup
  main.tsx                      # Entry point
```
