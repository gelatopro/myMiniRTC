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

1. **Fake media in two Chrome tabs (fast dev iteration)** — enable `chrome://flags/#use-fake-device-for-media-stream` or launch Chrome with `--use-fake-device-for-media-stream`. Generates synthetic audio/video without a real mic/camera. Verifies `ontrack` fires, remote video renders, and connection state reaches `connected`.
2. **`chrome://webrtc-internals` (debugging)** — shows live stats for every `RTCPeerConnection`: ICE state, candidate pairs, bytes sent/received, codec info. Use this to confirm P2P is actually working vs. silently failing.
3. **Two devices on the same network (real audio test)** — run the server on your machine, access the client from a phone or another laptop via local IP (e.g., `http://192.168.1.x:5173`). Requires HTTPS for `getUserMedia` on non-localhost — Vite supports `--host --https`.
4. **ngrok for cross-network testing** — expose your local server publicly (`ngrok http 5173`), gives an HTTPS URL shareable with anyone. Tests real NAT traversal (STUN).
