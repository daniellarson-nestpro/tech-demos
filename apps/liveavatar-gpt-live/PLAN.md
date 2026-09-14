# PLAN — LiveAvatar GPT-Live

## Goal
A single-user browser chat where replies stream in real time through a LiveAvatar-style talking-head persona (HeyGen LiveAvatar + OpenAI realtime pattern). A viewer should understand how a "GPT-Live" session feels: you type, the avatar comes alive, speaks the streamed reply with lip/mouth animation, and the transcript streams token-by-token alongside.

## Stack
- Runtime: Bun (`Bun.serve` — no framework, zero npm dependencies)
- Frontend: vanilla HTML/CSS/JS single page, SVG-animated avatar, Server-Sent Events for token streaming
- Live mode (optional): OpenAI Chat Completions streaming API when `OPENAI_API_KEY` is set; HeyGen/LiveAvatar session token endpoint stubbed for `LIVEAVATAR_API_KEY`
- Demo mode (default): built-in persona brain with simulated token streaming + simulated session latency stats, so the app runs with no keys at all

## File layout
apps/liveavatar-gpt-live/
├── package.json      — scripts: dev (bun server.ts)
├── server.ts         — Bun server: static files, GET /api/config, POST /api/chat (SSE token stream; OpenAI proxy or mock persona)
├── public/
│   ├── index.html    — app shell: avatar stage + chat panel
│   ├── styles.css    — dark glassmorphism UI, avatar/stage styling, animations
│   └── app.js        — chat state, SSE consumption, avatar speaking animation (mouth/eyes/status), session HUD
├── PLAN.md           — this plan
└── README.md         — run instructions + env vars (OPENAI_API_KEY, LIVEAVATAR_API_KEY optional)

## Out of scope
- No auth, no persistence, no multi-user/multiplayer
- No real WebRTC video from HeyGen (requires paid key); demo mode simulates the avatar stage instead
- No voice input (mic) — text chat only; speech output is a lightweight visual simulation
- No mobile-specific layout beyond basic responsiveness

## Validation
- Screenshot of the app mid-conversation: avatar in "speaking" state with the transcript streaming in the chat panel
- Video of the full flow: page load → session "connect" → user sends a message → avatar animates while the reply streams → reply completes
- Both attached to the PR
