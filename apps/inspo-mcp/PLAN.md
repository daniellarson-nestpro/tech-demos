# PLAN — Inspo Moodboard (Inspo MCP playground)

## Goal
A single-user playground inspired by Inspo MCP's `recommend` / `search_screens` flow: type a design brief ("calm fintech dashboard", "brutalist dev tool landing page") and get back a moodboard of exemplar sites — screenshot-style cards with palette swatches, font pairings, and matched style tags. A viewer should understand what an agent gets when it asks Inspo for design taste.

## Stack
- Runtime: Bun (Bun.serve, zero npm dependencies)
- Framework: none — vanilla HTML/CSS/JS front end served by a small Bun HTTP server
- Key libraries: none; screenshot-style cards are CSS mini-mockups generated from each site's palette/fonts (no real captures needed offline)

## File layout
apps/inspo-mcp/
├── package.json          — scripts: dev (bun run server.ts)
├── PLAN.md               — this plan
├── README.md             — how to run, what it demos
├── server.ts             — Bun.serve: static files + GET /api/recommend?q=<brief>
├── src/
│   ├── data.ts           — curated sample dataset (~16 exemplar sites: palette, fonts, tags, vibe keywords, layout pattern)
│   └── recommend.ts      — brief tokenizer + tag/keyword scoring, returns top matches with "why matched" reasons
└── public/
    ├── index.html        — single page: brief input, sample-brief chips, moodboard grid
    ├── styles.css        — editorial UI styling
    └── app.js            — fetch /api/recommend, render cards (CSS mockup, swatches, fonts, tags)

## Out of scope
- Live Inspo/Mobbin API calls — runs fully offline on a curated sample dataset, clearly labeled "sample data"; no API keys required or read
- Real MCP server/protocol wiring (this is a UI playground for the concept, not an MCP client)
- Auth, persistence, multi-user, mobile-specific layouts

## Validation
- `bun install && bun run dev` from apps/inspo-mcp/ serves the app on localhost
- Screenshot of the moodboard after submitting a design brief (cards with palettes, fonts, tags)
- Video of the full flow: type/pick a brief → results render → try a second brief
- Both attached to the PR
