# LiveAvatar GPT-Live

Single-user browser chat where replies stream in real time through a LiveAvatar-style
talking-head persona ("Nova"), inspired by HeyGen's LiveAvatar + OpenAI realtime
(GPT-Live / HyperFrames) demos.

- Source bookmark: https://x.com/HeyGen/status/2098108031276134776
- Upstream reference: https://github.com/heygen-com/liveavatar-gpt-live-demos

## Run

```bash
cd apps/liveavatar-gpt-live
bun install
bun run dev
# open http://localhost:3000
```

Press **Start session**, then chat. Replies stream token-by-token over SSE and drive
the avatar's lip sync, live captions, and session HUD (first-token latency, fps, LIVE badge).

Good demo prompts: "how do you work?", "what are HyperFrames?", "tell me a joke".

## Modes

| Mode | When | What happens |
| --- | --- | --- |
| **Demo** (default) | No env vars set | Built-in persona brain streams simulated tokens with realistic pacing. Runs fully offline. |
| **Live** | `OPENAI_API_KEY` set | `/api/chat` proxies a streaming OpenAI Chat Completions request; the same UI renders real model tokens. |

## Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Enables live mode: replies come from OpenAI instead of the built-in persona. |
| `OPENAI_MODEL` | Model for live mode (default `gpt-4o-mini`). |
| `LIVEAVATAR_API_KEY` / `HEYGEN_API_KEY` | Reported in `/api/config` as the avatar provider; the real HeyGen WebRTC video stage is out of scope for this MVP (the simulated avatar stage is used either way). |
| `PORT` | Server port (default `3000`). |

## How it works

- `server.ts` — Bun server. Serves `public/`, exposes `GET /api/config` (mode/persona info)
  and `POST /api/chat`, which returns a Server-Sent Events stream of `status`, `token`,
  and `done` events. With no OpenAI key it uses a small scripted persona and paces tokens
  at spoken-word speed; with a key it relays the model's stream.
- `public/app.js` — consumes the SSE stream, renders the transcript token-by-token, and
  drives the avatar: pseudo-viseme mouth animation, blinking, brow raise while "thinking",
  audio-bar visualizer, live captions, and first-token latency in the HUD.

No npm dependencies; everything is Bun built-ins + vanilla web platform.
