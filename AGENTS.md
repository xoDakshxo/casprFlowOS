# AGENTS.md — working brief for casprFlowOS

This is the brief for any agent (Codex, Claude, …) working in this repo. Read it first,
then the docs it points to. Keep [`docs/implementation/TRACKER.md`](docs/implementation/TRACKER.md)
up to date as you work.

## What this is

casprFlowOS is an **agentic OS**: you open it and you're already inside a voice/text-driven
canvas of AI coding agents working on your favourite project. Built by extracting the
usable parts of two prior repos and growing in a new direction.

## Read these — the source of truth, in order

1. `docs/vision.md` — what we're building and why
2. `docs/architecture.md` — Electron/TS monorepo, the voice|text → action pipeline
3. `docs/extraction-map.md` — exactly what to take from TermCanvas and what to DELETE
4. `docs/clean-code.md` — the code bar this repo holds itself to
5. `docs/design-language.md` — dark + glass visual system
6. `docs/voice-and-intent.md` — capability registry, FastRouter → Planner → Orchestrator
7. `docs/window-naming.md` — sci-fi callsigns for voice/text targeting
8. `docs/implementation/README.md` + the phase docs (`phase-0` … `phase-10`)
9. `docs/reference/*` — CasprFlow design docs (read-only source material; do not edit)

## Source repos you extract FROM (siblings; do NOT edit them)

- `../termcanvas` (Electron/TS) — the canvas + pty terminals + the **whole project/code
  panel** (file-structure tree + diffs + git + editor). Most of it is fluff to drop.
- `../CasprFlow` (native Swift) — logo/animations (already copied to `assets/logo/`) and
  the voice-dispatch **design only**. Do not port Swift; rebuild the design in TypeScript.

## Locked decisions (do not relitigate)

- Single **TypeScript pnpm monorepo, Electron**. NOT native Swift.
- **On-device Whisper (whisper.cpp)** for STT, behind a swappable `Transcriber` interface.
- Dark + glass design; translucent terminals; themeable canvas background (no dotted grid).
- The **capability registry is the single source of truth** for everything voice/text can do.

## Non-negotiable invariants (every phase)

- **Subtract before adding.** When in doubt, delete (Phase 1 deletes more than it writes).
- **Boundaries are real.** Dependency arrows point inward; packages talk via `index.ts` +
  interfaces in `shared`. `agents` drives the canvas/terminals through **ports** in
  `shared`, never their internals.
- **Latency is a feature.** The common command path is synchronous + zero-network; the
  planner LLM is miss-path only.
- **Never auto-send** outward-facing/destructive actions — gate with a HUD confirm.
- Strict TypeScript, no `any`, named exports, tokens not hardcoded styles.
- The left work sidebar keeps the **entire** TermCanvas project/code panel (file tree +
  diffs + git + editor), not a diff-only view.

## Design (any UI work — read before touching a component or stylesheet)

UI here keeps regressing. Two layers govern all visual work:

1. **The floor (mechanical, enforced):** [`docs/design-rules.md`](docs/design-rules.md) +
   the auto-loaded `.codex/skills/casprflowos-design` skill. Real macOS glass (vibrancy +
   translucent layers — never an opaque background in the stack), **computed/responsive
   spacing** (fluid `--pad-*`/`--gap-*` tokens, never raw px in padding/margin/gap/inset),
   tokens-only styling, `ui` primitives. `pnpm lint:css` (stylelint) **fails the build** on
   raw-px spacing and non-token backgrounds — run it before you commit UI.
2. **The taste (for any net-new design):** use the **`frontend-design` plugin/skill** to
   make deliberate, non-templated choices (palette, type, layout, one signature element).
   casprFlowOS is dark + glass; don't ship generic AI-default UI. Plan the design, critique
   it against the brief, then build — and **run the app and look at it** (resize 920px →
   full-screen) before calling it done. "It typechecks" is not "the UI is done."



## How to work

- Go **phase by phase, in order**. Don't start a phase until the previous phase's exit
  criterion is green **and verified by running the app** (not just typecheck).
- Work in small, reviewable slices, each advancing one checklist item, but keep them
  uncommitted until the **entire current phase** is complete.
- **Update `docs/implementation/TRACKER.md`** when you start/finish a phase or check off an
  item. It is the live status of the build.
- When you finish a phase, **stop and report** the exit-criterion result before starting
  the next.
- **Start with Phase 0** (`docs/implementation/phase-0-foundations.md`): `pnpm install &&
  pnpm dev` opens a dark glass Electron window showing the casprFlowOS logo + name, with
  `pnpm verify` (typecheck + lint + test) green. No TermCanvas code yet.

## Commit gate (phase-complete only, user approval required)

Do **not** commit partial phase slices. Before staging or committing any work:

- Run the relevant verification commands (`pnpm verify`, plus `pnpm build` when build
  wiring or app/runtime code changed).
- Run the application with `pnpm dev` and verify the **full current phase exit criterion**
  in the actual UI, not just in tests.
- Give the user concise, phase-specific validation steps they can run manually.
- Ask the user for explicit approval to stage/commit only after the phase is complete, and
  do not run `git add` or `git commit` until they approve.
- If the user rejects or interrupts approval, leave the working tree uncommitted and report
  what remains pending.

## Git (the user's setup — respect it)

- **Do NOT set git config manually.** Identity is managed by the user's `git switch-personal`.
- Commits are **signed**; the remote `origin` uses the **`github-personal`** SSH host alias
  (already configured). Push/commit normally; don't rewrite remotes.
- Small, reviewable commits; one concern each.
