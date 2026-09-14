# freeLLM Catalog

A searchable, filterable catalog of free LLM/AI API access routes, inspired by [freellm.sh](https://freellm.sh).

Browse ~30 free endpoints across 15 providers, filter by provider, modality, and access requirement (no signup / free API key / card required), search across models and limits, and open a detail panel with base URL, rate limits, license, and notes for each route.

The dataset is a realistic **invented sample** (`src/data.ts`) — clearly labeled in the UI, not live-scraped.

## Run

```bash
bun install
bun run dev
```

Then open http://localhost:3000.

## Stack

- Bun (dev server via the built-in HTML bundler)
- React 19
- Plain CSS, no other dependencies
