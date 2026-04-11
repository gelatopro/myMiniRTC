# DECISIONS.md

## 1. WebSocket for Signaling Transport

**Decision:** Use raw WebSockets (`ws` library) for the signaling layer.

**Alternatives considered:**
- HTTP long-polling — adds latency, requires client-side retry logic, poor fit for real-time SDP/ICE exchange
- Server-Sent Events (SSE) — unidirectional (server→client only), would still need a separate HTTP channel for client→server messages
- Socket.IO — adds abstraction and fallback logic we don't need; the target browsers all support native WebSocket

**Why WebSocket wins:** Bidirectional, persistent, low-latency. Signaling requires both peers to send and receive messages (SDP offers/answers, ICE candidates, presence events) with minimal delay. WebSocket is the simplest transport that does exactly this — no polling overhead, no extra libraries.

## 2. In-Memory Room State (No Database)

**Decision:** Room membership and presence are stored in a simple in-memory `Map` on the server. No database, no Redis.

**Why this is fine:**
- Room state is inherently ephemeral — it represents live WebSocket connections. If the server restarts, all connections drop and clients reconnect/re-join anyway. There's nothing meaningful to persist or recover.
- 1:1 rooms are small (max 2 users). The memory footprint is negligible.
- No features in scope require durability (no chat history, no user accounts, no scheduled rooms).

**What would change this:**
- Horizontal scaling (multiple server instances) → add Redis pub/sub for shared room state
- Room history or user accounts → add a database
- Scheduled/persistent rooms that outlive connections → need durable storage

## 3. UUID v4 for Room IDs

**Decision:** Rooms are identified by UUID v4, generated client-side when creating a room.

**Why:** The PRD requires room IDs to be non-guessable. UUID v4 gives 122 bits of randomness — brute-forcing is infeasible. This satisfies the "minimal security" requirement without needing an auth layer, user accounts, or room passwords.

## 4. Browser-Native WebRTC (No SDK)

**Decision:** Use browser-native `RTCPeerConnection` and `getUserMedia` APIs directly. No third-party WebRTC SDK.

**Why:** For 1:1 calling, the native API is straightforward. SDKs like Twilio or Daily add abstraction for multi-party, SFU routing, TURN management — none of which we need at this scope. Going native keeps the dependency count low and makes the WebRTC mechanics transparent (which matters for a project that asks you to explain what the technologies actually do).

## 5. Monorepo Structure (`/client` + `/server`)

**Decision:** Single repo with `/client` (React + Vite) and `/server` (Node.js + ws) directories.

**Why:** Two tightly coupled pieces of a single product. Shared TypeScript types for the signaling protocol. One clone, one setup, one `npm start` to run both. No need for separate repos or a monorepo tool like Turborepo at this scale.

---

## Scaling & Cost (PRD Required)

### What breaks at 10k rooms/day?

- **Memory:** 10k rooms × 2 users × small state object = trivial. In-memory `Map` handles this fine on a single server.
- **WebSocket connections:** 20k concurrent connections is within Node.js capability, but a single process will hit CPU limits on connection churn. Would need clustering (`node:cluster`) or multiple instances behind a load balancer.
- **Signaling throughput:** Each room generates a burst of ~10-20 messages (join, SDP offer/answer, ICE candidates, presence). At 10k rooms/day that's ~200k messages — easily handled.
- **The real bottleneck:** Not the signaling server — it's NAT traversal (see below).

### How to keep costs sane

- **Signaling is cheap.** It's lightweight WebSocket messages, no media processing. A single $5/mo VPS handles significant load.
- **TURN is the cost center.** Media relay traffic is bandwidth-intensive. Strategies: use TURN only as fallback (most connections succeed with STUN), set bandwidth limits, use time-limited TURN credentials, monitor relay usage.
- **No SFU needed.** 1:1 is peer-to-peer — no server-side media routing, no transcoding costs.

### NAT Traversal in Real Life

- **STUN** (free, e.g., Google's public STUN servers) handles ~80-85% of connections by helping peers discover their public IP/port.
- **TURN** (expensive, relays media through server) is needed when both peers are behind symmetric NATs or restrictive firewalls. In production you'd:
  - Run your own TURN server (coturn) or use a managed service (Twilio, Xirsys)
  - Issue short-lived credentials per session
  - Set bandwidth caps and session time limits
  - Monitor relay vs. direct connection ratio to control costs
- For this project: we use Google's free STUN servers. No TURN — acceptable for a demo, but ~15% of real-world connections would fail without it.
