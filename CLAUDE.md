# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MiniRTC — a 1:1 WebRTC calling application with audio (required) and video (optional). Users create or join rooms by URL for peer-to-peer calls.

## Architecture

Two-layer design:

- **`/server`** — Node.js signaling server using `ws` (WebSocket). Handles room membership, presence events, and relaying SDP offers/answers + ICE candidates between peers. Room state is in-memory (no database).
- **`/client`** — React + TypeScript SPA built with Vite. Uses browser-native `RTCPeerConnection` and `getUserMedia` APIs directly (no WebRTC SDK).

Media flows peer-to-peer via WebRTC. The server only handles signaling — it never touches audio/video.

## Key Design Decisions

- WebSocket for signaling (bidirectional, low-latency)
- In-memory room state (ephemeral by nature — no persistence needed)
- UUID v4 room IDs (non-guessable, no auth layer needed)
- Browser-native WebRTC APIs (no third-party SDK for 1:1)
- See `DECISIONS.md` for full rationale and scaling analysis

## Commands

### Server (`/server`)
- `npm test` — run all tests (Jest + ts-jest)
- `npm run dev` — start dev server with auto-reload (tsx watch)
- `npm run build` — compile TypeScript to `/dist`
- `npm start` — run compiled server
- `npx jest path/to/file.test.ts` — run a single test file
- `wscat -c ws://localhost:8080` — manually test signaling protocol (install: `npm i -g wscat`). Send JSON messages like `{"type":"join","roomId":"test-room"}`. Open two terminals to test the full flow.

### Client (`/client`)
- `npx vitest run` — run all tests (Vitest + React Testing Library)
- `npm run dev` — start Vite dev server on http://localhost:5173
- `npm run build` — production build to `/dist`
- `npx vitest run path/to/file.test.ts` — run a single test file
- TypeScript uses `verbatimModuleSyntax` — use `import type` for type-only imports

## Important Rules

- **Write unit tests for every change** when unit tests make sense. Ensure test coverage accompanies implementation work.
- **Log every important technical decision in `DECISIONS.md`** — whenever you make a significant architectural, technology, or design choice while building this app, document it with the decision, alternatives considered, and rationale.

## Reference Documents

- `docs/PRD.md` — product requirements
- `DECISIONS.md` — architectural tradeoffs and scaling/cost analysis
- `docs/plan.md` — implementation plan with technology choices and testing strategy
