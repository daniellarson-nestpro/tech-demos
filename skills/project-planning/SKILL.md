---
name: project-planning
description: Write apps/<kebab-slug>/PLAN.md before building any demo app. Use at the start of every assigned pick, before writing any code.
---

# Project Planning

Before coding a demo, write a plan at `apps/<kebab-slug>/PLAN.md`. No demo code should be written until the plan exists.

## PLAN.md must include

1. **Goal** — what the demo shows, in one or two sentences. What should a viewer understand after seeing it run?
2. **Stack** — runtime, framework, and key libraries. Prefer Bun; the demo must run with `bun install && bun run dev` from `apps/<kebab-slug>/`.
3. **File layout** — the planned directory/file tree inside `apps/<kebab-slug>/`, with a one-line purpose per file.
4. **Out of scope** — what the MVP deliberately skips (e.g. auth, persistence, multi-user, mobile). Keep the MVP single-user and small.
5. **Validation** — how success is proven: at least one **screenshot** AND at least one **video** of the running app, both attached to the PR.

## Template

```markdown
# PLAN — <demo name>

## Goal
<one or two sentences>

## Stack
- Runtime: Bun
- Framework: <...>
- Key libraries: <...>

## File layout
apps/<kebab-slug>/
├── package.json      — scripts: dev
├── ...

## Out of scope
- <...>

## Validation
- Screenshot of <specific screen/state>
- Video of <specific flow>
- Both attached to the PR
```
