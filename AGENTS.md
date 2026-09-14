# AGENTS.md

Rules for agents working in this tech-demos monorepo.

## Repository layout

- `apps/<kebab-slug>/` — one self-contained demo per pick. Everything a demo needs lives inside its own folder.
- `skills/project-planning/` — planning skill. Write `apps/<slug>/PLAN.md` before building anything.
- `tracking/seen-bookmarks.json` — registry of already-proposed bookmarks. Do not re-propose bookmarks listed there.

## Rules

1. **Plan first.** Before writing any demo code, follow `skills/project-planning/SKILL.md` and write `apps/<kebab-slug>/PLAN.md`.
2. **Stay in your lane.** Cloud agents ONLY add/update files under `apps/<kebab-slug>/` for their assigned pick. Do not touch other apps, shared config, or tracking files unless explicitly instructed.
3. **Never create a new GitHub repository.** All work happens in this monorepo.
4. **The demo must run.** From `apps/<kebab-slug>/`, the following must work:

   ```bash
   bun install && bun run dev
   ```

5. **One PR per pick, with proof.** Open a single PR that includes BOTH at least one screenshot AND at least one video of the running app.
6. **Keep it small.** Prefer Bun. Keep the MVP single-user and small — no auth, no multi-tenancy, no premature abstractions.
