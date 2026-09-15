# PLAN — claude-obsidian: self-organizing AI second brain demo

## Goal
Demonstrate the claude-obsidian / Karpathy "LLM Wiki" pattern without needing Claude Code or a real Obsidian vault: drop a short source (article excerpt, note, pasted text) and watch an agent pipeline read it, extract claims, propose wiki-style note titles, suggest `[[wikilinks]]`, and file generated Markdown notes into a live in-app vault preview with a link graph. A viewer should understand how an AI agent can turn loose sources into a connected, self-organizing Markdown knowledge base.

## Stack
- Runtime: Bun (Bun.serve HTTP server, TypeScript, no build step)
- Framework: none — static HTML/CSS/vanilla JS frontend served by Bun
- Key libraries: none required. Graph view is a small hand-rolled force-directed SVG simulation. Optional live mode calls the Anthropic Messages API via `fetch` when `ANTHROPIC_API_KEY` is set; the default is a fully offline simulated pipeline.

## File layout
apps/claude-obsidian/
├── package.json      — scripts: dev (bun run src/server.ts)
├── PLAN.md           — this plan
├── README.md         — how to run, optional env vars
├── src/
│   ├── server.ts     — Bun.serve: static files + JSON API (/api/vault, /api/ingest, /api/reset, /api/samples)
│   ├── vault.ts      — in-memory vault: seed notes (Karpathy-style wiki layout), note CRUD, link extraction
│   ├── pipeline.ts   — offline "simulated agent": claim extraction, title proposal, wikilink suggestion, Markdown note generation
│   ├── live.ts       — optional Anthropic-backed pipeline used only when ANTHROPIC_API_KEY is present
│   └── samples.ts    — bundled sample sources so the demo works with zero input
└── public/
    ├── index.html    — single-page UI: source drop pane, agent activity log, vault tree + note viewer, graph view
    ├── style.css     — Obsidian-inspired dark theme
    └── app.js        — frontend logic: ingest flow, staged pipeline animation, vault rendering, force-directed graph

## Out of scope
- No auth, no multi-user, no persistence across restarts (vault lives in server memory)
- No real Obsidian plugin, no Claude Code integration, no cloning of Obsidian
- No file uploads beyond pasted text / picking a bundled sample; no URL fetching in offline mode
- No editing of generated notes in the UI

## Validation
- Screenshot of the full UI after ingesting a source: agent log completed, new notes filed in the vault tree, note open with wikilinks, graph showing new edges
- Video of the full flow: pick a sample source → run the agent → staged pipeline animation → notes appear in vault → open a note → graph updates
- Both attached to the PR
