# PLAN — Tracking Pixel Sandbox

## Goal
A hermetic cloud environment for detonating email tracking pixels: paste a suspicious
newsletter, email HTML, or a bare pixel URL, and the app renders it inside a sealed
iframe where **no byte ever reaches the real internet**. Every beacon the payload tries
to fire is intercepted, decoded, and attributed, so a viewer understands exactly what a
tracking pixel would have told its vendor — which recipient opened the mail, when, from
which IP and client — and sees it reduced to a blocked, fully explained log entry.

## Stack
- Runtime: Bun (`Bun.serve`, zero runtime dependencies)
- Framework: none — server is `Bun.serve` with `routes`; UI is vanilla ES modules + CSS
- Key libraries:
  - `HTMLRewriter` (built into Bun, lol-html) — streaming rewrite of every remote URL
  - Server-Sent Events — live beacon feed to the UI
  - `playwright` (devDependency only) — captures the screenshot + video proof for the PR

## Sandbox model (defense in depth — four independent layers)
1. **Rewrite** — `HTMLRewriter` rewrites every remote URL (`img/src`, `srcset`, CSS
   `url()` in `style` attrs and `<style>` blocks, `video/audio/source`, `iframe`,
   `link`, `script`, `background`, `poster`) to a local `/trap/:id` collector.
2. **Strip** — `<script>`, `<meta http-equiv=refresh>`, event-handler attributes and
   `javascript:`/`data:text/html` URLs are neutralized before render.
3. **Seal** — the payload is served from `/sandbox/:id` under
   `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`
   so anything the rewriter misses is refused by the browser, not merely unrecorded.
4. **Confine** — the preview `<iframe>` carries `sandbox="allow-same-origin"` (no
   scripts, no forms, no top-navigation) and `referrerpolicy="no-referrer"`.
   Egress is default-deny; the collector answers with a local 1×1 GIF and never forwards.

## Forensics the collector performs
- **Vendor attribution** — host/path signature table covering ~30 real senders and
  open-tracking vendors (Mailchimp, SendGrid, HubSpot, Klaviyo, Braze, Customer.io,
  Marketo, Salesforce/ExactTarget, Postmark, Mailgun, Litmus, Streak, Mixmax, Yesware,
  Mailtrack, Superhuman, Bananatag, Google Analytics, Meta, DoubleClick, …).
- **Shape heuristics** — 1×1 or 0×0 dimensions, `display:none`/`visibility:hidden`,
  missing `alt`, CSS-background-only images, `/open`, `/o/`, `/wf/open`, `/pixel`,
  `/beacon`, `.gif?`-with-query path shapes.
- **Leak extraction** — walks path segments and query values, recursively base64 /
  URL / hex decodes them, and flags recipient identifiers: email addresses, MD5/SHA-1
  hashes of addresses, UUIDs, JWT-ish blobs, campaign + message ids, embedded IPs.
- **Severity** — each beacon scored `critical` / `high` / `medium` / `low` from the
  vendor match, the pixel shape, and what it leaked.

## File layout
```
apps/tracking-pixel-sandbox/
├── PLAN.md                 — this plan
├── README.md               — what it is, how to run, threat model + limits
├── package.json            — scripts: dev, start, capture; zero runtime deps
├── tsconfig.json           — Bun-flavored TS config
├── src/
│   ├── server.ts           — Bun.serve: UI, /api/analyze, /sandbox/:id, /trap/*, SSE
│   ├── rewrite.ts          — HTMLRewriter passes: rewrite remote URLs, strip active content
│   ├── classify.ts         — vendor table, shape heuristics, recursive leak decoder, severity
│   ├── store.ts            — in-memory session + beacon log, SSE subscriber fan-out
│   └── samples.ts          — three built-in payloads (newsletter, stealth CSS pixel, bare URL)
├── public/
│   ├── index.html          — two-pane shell: payload input + sealed preview / live beacon log
│   ├── app.js              — SSE client, beacon table, detail drawer, stat row
│   └── styles.css          — dark forensic-console theme
└── scripts/
    └── capture.mjs         — Playwright: drives a run, writes screenshot + video
```

## Out of scope
- No auth, no multi-user, no database — one in-memory session, single user.
- No real egress. There is deliberately **no** "replay this beacon for real" button;
  a sandbox that can phone home is not a sandbox.
- No JavaScript execution inside payloads (stripped, not emulated) — this analyzes
  email-grade HTML tracking, not browser-grade JS fingerprinting.
- No MIME/`.eml` parsing, no IMAP ingestion — paste HTML or a URL.
- No persistence of analyzed payloads across restarts; no mobile layout.

## Validation
- `bun install && bun run dev` from `apps/tracking-pixel-sandbox/` serves on `:3000`.
- Screenshot of the sandbox after detonating the bundled newsletter sample: sealed
  preview on the left, beacon log on the right showing blocked beacons with vendor
  attribution, and a detail drawer showing a base64-decoded recipient email leak.
- Video of the full flow: pick sample → Detonate → beacons stream in live → open a
  beacon → leak chips and decoded parameters → switch to the stealth CSS-pixel sample.
- Both attached to the PR.
