# PLAN — freeLLM Catalog

## Goal
A searchable, filterable catalog of free LLM/AI API access routes, inspired by [freellm.sh](https://freellm.sh). A viewer should understand at a glance which providers offer free model access, under what limits (rate limits, daily token pools, signup/card requirements), and be able to drill into any endpoint for details.

## Stack
- Runtime: Bun (dev server via Bun's built-in HTML bundler — `bun ./src/index.html`)
- Framework: React 19 (bundled by Bun, no separate build tool)
- Key libraries: none beyond react/react-dom; plain CSS for styling
- Data: static sample dataset (`src/data.ts`) of ~30 realistic free endpoints, clearly labeled as sample data in the UI

## File layout
apps/freellm-catalog/
├── package.json      — scripts: dev (bun ./src/index.html), deps: react, react-dom
├── PLAN.md           — this plan
├── README.md         — how to run, what it is
├── src/
│   ├── index.html    — HTML entrypoint for Bun's dev server
│   ├── index.tsx     — React mount point
│   ├── App.tsx       — main app: search, filters, grid, detail panel state
│   ├── components.tsx — EndpointCard, DetailPanel, FilterSidebar
│   ├── data.ts       — sample dataset (~30 endpoints) + types
│   └── styles.css    — dark, modern single-page styling

## Out of scope
- Live scraping of freellm.sh (dataset is a static, clearly-labeled sample)
- Auth, accounts, multi-user, persistence
- Mobile-specific layouts (desktop-first, but responsive enough)
- Endpoint health checking / uptime probing

## Validation
- Screenshot of the full catalog view with filters applied and detail panel open
- Video of the flow: search → filter by provider/modality → open detail panel
- Both attached to the PR
