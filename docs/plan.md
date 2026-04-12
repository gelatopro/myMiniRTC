# MiniRTC — High-Level Plan

## Architecture

**Two-layer design:**

1. **Signaling Server** (Node.js + WebSocket) — exchanges SDP offers/answers and ICE candidates between peers. Manages room state and presence.
2. **Client SPA** (React + TypeScript) — handles WebRTC peer connections, media streams, and call UI.

WebRTC does the actual media peer-to-peer. The server never touches audio/video — it's just the matchmaker.

**Why WebSocket for signaling:** Bidirectional, persistent, low-latency — exactly what signaling needs. HTTP polling adds unnecessary latency for SDP/ICE exchange. SSE is one-way. WebSocket is the natural fit.

## Technology

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + TypeScript + Vite | Fast dev, type safety, simple for a focused UI |
| Signaling | Node.js + `ws` library | Lightweight, same language as frontend, no framework overhead needed for this scope |
| WebRTC | Browser native APIs | `RTCPeerConnection`, `getUserMedia` — no SDK needed for 1:1 |
| Room IDs | UUID v4 | Non-guessable by default, no auth layer needed |
| Monorepo | Single repo, `/client` + `/server` | Simple, one `npm start` to run both |

No database — room state is in-memory. For a 1:1 calling app, this is sufficient and keeps complexity low.

## Testing Plan

| What | How |
|------|-----|
| **Server unit tests** | Jest — room creation/joining logic, WebSocket message routing, edge cases (room full, duplicate join, disconnect cleanup) |
| **Client unit tests** | Vitest + React Testing Library — component rendering, UI state transitions (mute/unmute, join/leave, connection status) |
| **WebRTC integration** | Manual + potentially Playwright with fake media streams — verify SDP exchange, ICE flow, media connection established |
| **Error handling** | Test cases for: room full (3rd user), peer disconnect mid-call, media permission denied, invalid room ID |

WebRTC is notoriously hard to automate end-to-end, so the strategy is: unit test everything around it aggressively, integration test the signaling flow, and manual test the actual media path.

## Manual Testing the Signaling Server

No deployment needed — all testable locally:

1. **`wscat` for raw protocol testing** — `npm i -g wscat`, connect two terminals to `ws://localhost:8080`, send JSON messages to verify room join, presence events, message routing, and error responses. Good for quick protocol validation during development.
2. **Two browser tabs** — once the client exists, open two tabs to the same room URL on localhost. Tests the full signaling + WebRTC flow end-to-end on one machine.
3. **Node.js integration test script** — spin up two `ws` clients programmatically, simulate the full signaling handshake (join → offer → answer → ICE candidates), assert messages arrive correctly. Runs in CI without browsers.
4. **Postman** — has WebSocket support, useful for interactive exploration of the protocol.

## Testing Peer-to-Peer Audio/Video

1. **Two browser tabs on localhost (primary dev method)** — open http://localhost:5173, create a room, open the same URL in a second tab. Both tabs share the same camera/mic. Video is visible on both sides; audio is hard to distinguish on a single machine (use headphones or mute one tab to verify).
2. **`chrome://webrtc-internals` (debugging)** — shows live stats for every `RTCPeerConnection`: ICE state, candidate pairs, bytes sent/received, codec info. Useful to confirm P2P is working vs. silently failing. Not used extensively during this project but available when needed.
3. **ngrok for cross-network testing (used)** — expose the client via `ngrok http 5173` (single tunnel, WebSocket proxied through Vite). Gives an HTTPS URL usable on any device. Tests real NAT traversal with STUN. This was the primary method for testing real audio/video between two separate laptops.
