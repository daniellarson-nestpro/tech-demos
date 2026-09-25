# PLAN — transitions-dev gallery

## Goal
A single-page gallery of 10 production-quality UI micro-transitions inspired by [transitions.dev](https://transitions.dev): each one runs live in the browser and its CSS can be copied with one click. A viewer should understand that crisp, agent-ready UI transitions can be plain copy-paste CSS — no animation library needed.

## Stack
- Runtime: Bun (dev server via `Bun.serve`, zero npm dependencies)
- Framework: none — static HTML + vanilla JS + CSS
- Key libraries: none; all animations are hand-written CSS keyframes/transitions with tiny JS triggers

## File layout
apps/transitions-dev/
├── package.json        — scripts: dev (runs server.ts)
├── server.ts           — Bun.serve static file server for public/
├── PLAN.md             — this plan
├── README.md           — how to run
└── public/
    ├── index.html      — gallery page, one card per transition
    ├── base.css        — page shell, grid, card chrome (not copyable)
    ├── transitions.css — the 10 transition styles, marker-delimited per demo
    └── app.js          — demo triggers, replay logic, copy-CSS button (slices transitions.css by markers)

## The 10 transitions
1. Toast open/close — rises in with fade, blur and scale
2. Tabs sliding — pill indicator follows the active tab
3. Skeleton loader and reveal — pulse to content cross-fade
4. Number flip — digit flip with blur and stagger
5. Error state shake — cubic-bezier shake on invalid input
6. Success check — SVG stroke draws on with blur and rotate
7. Spinner to check morph — spinner pops into a drawn check
8. Like button — heart fills and bursts particles
9. Notification badge — diagonal slide with spring pop-in
10. Shimmer text — masked gradient sweep across text

## Out of scope
- No backend, persistence, auth, or multi-user anything
- No build step, bundler, or npm dependencies
- No "coding-agent skill" packaging (the real product's angle) — this is a visual gallery only
- No mobile-specific layout work beyond a responsive grid

## Validation
- Screenshot of the full gallery grid with several transitions mid-state
- Video of interacting with the demos (playing transitions, copying CSS with the "Copied" confirmation)
- Both attached to the PR
- `bun install && bun run dev` from `apps/transitions-dev/` serves the app
