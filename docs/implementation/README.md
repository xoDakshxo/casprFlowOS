# Implementation — the phase queue

casprFlowOS is built **phase by phase**, in order. Each phase is a self-contained chunk
of work with a clear goal, a checklist, and an exit criterion. Don't start a phase until
the previous one's exit criterion is green. Work in small reviewable slices while a phase
is in progress, but **do not commit partial phase slices**. Commit only after the whole
phase exit criterion is green and the user explicitly approves.

The ordering is deliberate, matching the user's instruction: **cleanup first, then
rebrand, then build features — with taste at every step.**

> **Live status:** [`TRACKER.md`](TRACKER.md) — flip phase status and check off items there
> as you work. It is the single source of "where is the build right now."

| Phase | Goal | Exit criterion |
|---|---|---|
| [0 — Foundations](phase-0-foundations.md) | Empty monorepo boots an Electron window | `pnpm dev` opens a dark glass window that says "casprFlowOS" |
| [1 — Cleanup & extract core](phase-1-cleanup-extract.md) | Port only the canvas+terminal+diff infra from TermCanvas | A canvas with real pty terminals + left-rail diff renders; no fluff present |
| [2 — Rebrand](phase-2-rebrand.md) | All TermCanvas identity → casprFlowOS; logo/animations in | No `termcanvas` strings remain; app shows casprFlow logo + name |
| [3 — Design system & glass](phase-3-design-glass.md) | Dark-glass UI, transparent terminals, canvas themes | Rails/HUD/tiles use the glass design system; theme switcher works |
| [4 — Rails](phase-4-rails.md) | Left rail (projects/sessions/diff) + right rail (OS) shells | Both rails populated; right rail shows OS object sections |
| [5 — Agents on the canvas](phase-5-agents.md) | Add Claude Code / Codex / other agents; callsigns | "Add agent" spawns a named agent terminal; callsigns shown |
| [6 — Intent layer (text first)](phase-6-intent-text.md) | Capability registry + FastRouter + Orchestrator + command bar | Typed commands drive the canvas; HUD readout shows what it did |
| [7 — Voice](phase-7-voice.md) | Option+Space → HUD → Whisper → same pipeline | Spoken commands work end-to-end; latency contract met on common path |
| [8 — Planner (long tail)](phase-8-planner.md) | LLM planner on FastRouter miss; capability catalog | Long-tail utterances resolve to multi-step plans |
| [9 — OS surfaces & MCP](phase-9-os-mcp.md) | Automations/skills/profiles + MCP connector framework (Spotify) | Connect a connector; "open spotify" renders a glass surface |
| [10 — Polish & latency](phase-10-polish.md) | Taste pass, perf, prewarming, accessibility | Feels like an OS; meets the latency budget; ships a build |

## How to work a phase

1. Read the phase doc + the docs it references (`vision`, `architecture`,
   `design-language`, `voice-and-intent`, `extraction-map`, `clean-code`).
2. Work in small slices, each advancing one checklist item.
3. Keep typecheck/lint/tests green.
4. Don't pull in scope from a later phase. If you discover a dependency, note it and
   sequence it, don't smuggle it.
5. End the phase by verifying the exit criterion **by running the app**, not just by
   typechecking.
6. Give the user phase-specific validation steps and wait for explicit approval before
   staging or committing the completed phase.

## Principles that span all phases

- **Subtract before adding** (Phase 1 deletes more than it writes).
- **Capability registry is the single source of truth** for everything voice/text can do.
- **Latency is a feature** — the common command path never touches the network.
- **Never auto-send** outward-facing/destructive actions; confirm in the HUD.
- **Done with taste** — right-sized, legible, the version you'd be proud to show.
