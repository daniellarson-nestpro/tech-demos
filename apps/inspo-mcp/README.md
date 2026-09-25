# Inspo Moodboard — design inspiration playground

A tiny single-user demo inspired by [Inspo MCP](https://inspomcp.dev) ([Nutlope/inspo](https://github.com/Nutlope/inspo)) — "real websites for your coding agent to learn design from, searchable over MCP."

Type a design brief ("calm fintech dashboard", "brutalist creator shop") and get a moodboard of exemplar screens: screenshot-style cards rendered from each site's palette, its font pairing, style tags, and why it matched your brief.

## Run

```bash
bun install
bun run dev
# → http://localhost:3000
```

No API keys required. The demo runs fully offline in **sample mode**: a curated dataset of 16 exemplar sites (`src/data.ts`) with illustrative palettes and type pairings, scored against your brief by a small synonym-aware keyword matcher (`src/recommend.ts`). It is clearly labeled as sample data in the UI — no live Inspo/Mobbin API is called.

## How it maps to Inspo MCP

| Inspo MCP | This demo |
| --- | --- |
| `recommend` tool: ask for a vibe over MCP | `GET /api/recommend?q=<brief>` |
| 832 production sites, 2,320 screens | 16 curated sample entries |
| Real captures + per-site `DESIGN.md` | CSS mini-mockups + palette/fonts/tags per entry |
