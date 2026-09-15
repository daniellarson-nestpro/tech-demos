# claude-obsidian — self-organizing AI second brain (demo)

A single-user MVP demo of the [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) / Karpathy **LLM Wiki** pattern: drop a source into an inbox and an agent reads it, extracts atomic claims, proposes wiki-style note titles, suggests `[[wikilinks]]`, and files generated Markdown notes into a connected vault — shown live with a file tree, note viewer, and force-directed link graph.

No Claude Code, no real Obsidian vault, and no API keys required: the default is a fully offline heuristic pipeline with bundled sample sources.

## Run

```bash
bun install && bun run dev
```

Then open http://localhost:3000.

## Using the demo

1. Pick a bundled sample (or paste any text / drop a `.md`/`.txt` file into the inbox).
2. Click **Run agent** and watch the staged pipeline: read → extract claims → propose notes → suggest wikilinks → file into vault.
3. New notes appear in the vault tree (tagged `new`), the source note opens in the viewer with clickable wikilinks, and the graph grows new edges.
4. **Reset vault** restores the seed vault.

## Optional environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(unset)_ | When set, the pipeline calls the Anthropic Messages API so Claude performs the claim extraction, note proposal, and linking. On any API error the app falls back to the offline pipeline. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Model used in live mode. |
| `PORT` | `3000` | HTTP port for the demo server. |

## How it works

- `src/vault.ts` — in-memory vault seeded with a small Karpathy-style wiki (`Home`, `concepts/…`); links are derived from `[[wikilinks]]` in note bodies.
- `src/pipeline.ts` — offline "agent": sentence scoring for claim extraction, capitalized-phrase and frequency analysis for concept proposal, title matching for wikilink suggestion, and Markdown generation for `sources/` and `concepts/` notes.
- `src/live.ts` — optional Anthropic-backed variant of the same pipeline.
- `src/server.ts` — Bun server: static frontend + JSON API (`/api/vault`, `/api/samples`, `/api/ingest`, `/api/reset`).
- `public/` — vanilla JS frontend: staged agent activity log, vault tree, mini Markdown renderer with wikilink navigation, hand-rolled force-directed SVG graph.

## Out of scope

Single-user, in-memory only (vault resets on server restart), no auth, no note editing, no URL fetching.
