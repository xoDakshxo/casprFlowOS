# Architecture — casprFlowOS

## Stack decision (locked)

- **Single TypeScript monorepo, Electron desktop app.** Decided with the user.
  The canvas-of-terminals core is inherently Electron (from TermCanvas); the voice layer
  is **ported in design, rebuilt in TypeScript** rather than kept as native Swift.
- **On-device Whisper (whisper.cpp) for speech-to-text.** Private, offline, no per-use
  cost. A native binding lives behind a `Transcriber` interface so it can be swapped.
- **pnpm workspaces** for package boundaries. Strict TypeScript everywhere.

Where this differs from CasprFlow's own decisions log (which mandates native Swift, D1),
that is intentional: casprFlowOS optimises for one codebase Codex can own end-to-end.
CasprFlow's *design* — capability model, fast-router-then-planner, latency contract — is
carried over; its *implementation language* is not. Keep the CasprFlow reference docs in
[`reference/`](reference/) as the source of the design ideas.

## Layered view

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/desktop  (Electron)                                             │
│   main process: window, globalShortcut, pty host, git watcher, IPC   │
│   preload:      typed, minimal contextBridge surface                  │
│   renderer:     React host that mounts the canvas + rails + HUD       │
└───────────────┬──────────────────────────────────────────────────────┘
                │ imports
   ┌────────────┴───────────────────────────────────────────────┐
   │ packages/                                                   │
   │                                                             │
   │  ui          design tokens + glass primitives + rails       │
   │  canvas-core infinite canvas, scene state, focus/zoom/pan   │
   │  terminal    pty tiles, transparent surfaces, agent adapters│
   │  voice       hotkey → HUD → Whisper → transcript            │
   │  agents      intent router + capability registry            │
   │  mcp         connector framework + app surfaces (later)     │
   │  shared      ids, result types, logging, event bus          │
   └─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows point inward only. `ui`, `canvas-core`, `terminal`, `voice`,
`agents`, `mcp` may depend on `shared`. `agents` depends on `canvas-core`/`terminal`
*through capability interfaces in `shared`*, never by reaching into their internals.
`apps/desktop` is the only place allowed to wire everything together. No package imports
`apps/desktop`. See [`clean-code.md`](clean-code.md) for the boundary rules.

## The command pipeline (voice OR text → action)

This is the heart of the "agentic OS". Voice and text are two front-ends to **one**
intent pipeline. Adapted from CasprFlow's capability/router/orchestrator model
([`reference/casprflow-architecture.md`](reference/casprflow-architecture.md)).

```
 voice:  Option+Space ─hold─▶ capture ─▶ Whisper (on-device) ─▶ transcript ┐
 text:   command bar  ───────────────────────────────────────▶ transcript ┤
                                                                           ▼
                                                              ┌─────────────────────┐
                                                              │ FastRouter (tier 1) │  zero-network,
                                                              │ deterministic match │  < few ms
                                                              └─────────┬───────────┘
                                                          hit │         │ miss
                                                              ▼         ▼
                                                   CapabilityCall   ┌──────────────┐
                                                              │     │ Planner (LLM)│  long tail only
                                                              │     │ → ordered    │  (speculative,
                                                              │     │   Plan       │   started during speech)
                                                              │     └──────┬───────┘
                                                              ▼            ▼
                                                       ┌──────────────────────────────┐
                                                       │ Orchestrator                 │
                                                       │ executes CapabilityCalls,    │
                                                       │ threads results, gates       │
                                                       │ side-effects (confirm)       │
                                                       └──────────────┬───────────────┘
                                                                      ▼
                                              Capabilities act on the canvas / terminals / OS:
                                              focus_window, spawn_agent, open_diff, pan_zoom,
                                              run_in_terminal, open_connector, …
                                                                      ▼
                                                       HUD readout: "Focused Orion."
```

### Capabilities (the single extension point)

A **Capability** is a typed tool the router/planner can call. Adding ability = adding a
capability, never new plumbing. Mirrors CasprFlow's `Capability` protocol in TS:

```ts
export interface Capability {
  /** stable name the router/planner calls by, e.g. "focus_window" */
  readonly name: string;
  /** one-line description telling the planner WHEN to choose this */
  readonly summary: string;
  /** JSON-schema of arguments; validated before execute */
  readonly parameters: JSONSchema;
  /** outward-facing / irreversible actions are gated */
  readonly sideEffect: "readOnly" | "local" | "confirm";
  /** optional zero-network shortcut so trivial commands skip the planner */
  fastMatch(text: string): CapabilityCall | null;
  /** run it; reads args + prior results from ctx; returns a result */
  execute(call: CapabilityCall, ctx: ExecutionContext): Promise<CapabilityResult>;
}
```

### Seed capabilities (v1)

| Capability | Side-effect | Backed by | Example utterance |
|---|---|---|---|
| `focus_window` | local | canvas-core | "focus Orion" |
| `pan_zoom` | local | canvas-core | "zoom out", "show everything" |
| `spawn_agent` | local | terminal + agents | "spawn a Codex agent on casprflowos" |
| `run_in_terminal` | confirm* | terminal | "tell Vega to run the tests" |
| `open_diff` | readOnly | canvas-core/left rail | "show Nova's diff" |
| `close_window` | confirm | canvas-core | "close Vega" |
| `arrange` | local | canvas-core | "tidy up the canvas" |
| `open_connector` | local | mcp (later) | "open spotify" |
| `ask_user` | — | HUD clarifier | resolves a missing slot |

\* `run_in_terminal` pastes/queues the command; destructive shell is `confirm`. We never
silently send outward-facing actions — carried from CasprFlow's "never auto-send" rule.

### Why two front-ends, one pipeline

Voice and text differ only at the **transcript** boundary. Everything after — FastRouter,
Planner, Orchestrator, Capabilities, HUD readout — is shared. This keeps behaviour
identical regardless of input modality and means a new capability instantly works for
both. The command bar is also the debugging surface for the voice path.

## Window identity & callsigns

Every terminal/agent window gets a stable, human-memorable **callsign** (sci-fi names:
Orion, Vega, Nova…) so voice targeting is unambiguous. The callsign is assigned on window
creation, shown on the tile and in the left rail, and is the primary key `focus_window`
and friends resolve against (with fuzzy matching). See
[`window-naming.md`](window-naming.md).

## Electron process responsibilities

| Process | Owns |
|---|---|
| **main** | window lifecycle, `globalShortcut` (Option+Space), the **pty host** (node-pty), git watcher feeding the diff rail, file-tree watcher, IPC handlers, on-device Whisper process |
| **preload** | a minimal, typed `contextBridge` API — no `nodeIntegration` in the renderer |
| **renderer** | React: canvas, terminals, left/right rails, voice HUD, command bar, the intent pipeline (FastRouter/Planner/Orchestrator run here; the planner's LLM call and Whisper go through preload to main) |

Security posture: `contextIsolation: true`, `nodeIntegration: false`, a narrow preload
surface. Anything touching the filesystem, pty, network, or shell lives in main behind an
explicit IPC channel.

## State & persistence

- **Scene state** (windows, positions, focus, callsigns, canvas theme) is a serializable
  document persisted locally; restored on launch so you reopen to your canvas.
- **Sessions / diffs** are derived from the live pty + git watcher, not stored.
- **OS objects** (automations, skills, connector configs, profiles) are local config
  documents owned by the right rail; connector secrets go in the OS keychain, never in the
  scene file or git.

## Where each requirement lives

| Requirement | Home |
|---|---|
| Multiple connected terminals on one canvas | `canvas-core` + `terminal` |
| Left rail: projects + sessions + **whole project/code panel** (file tree, diffs, git, editor) | `ui` (rail) + the kept TermCanvas `RightPanel/` suite (renamed) + `canvas-core` (scene) + main (git + file-tree watchers) |
| Right rail: projects/automations/skills/MCP/profiles | `ui` (rail) + `mcp` + `shared` (OS object model) |
| Voice control + on-screen HUD modal | `voice` + `ui` (HUD) |
| "It wrote what it did" readout | Orchestrator → HUD result line (`ui`) |
| Add Claude Code / Codex / other agents | `terminal` agent adapters + `spawn_agent` capability |
| MCP app surfaces (Spotify player, …) | `mcp` (later phase) |
| Transparent terminals + themeable canvas | `terminal` (surface) + `ui`/`canvas-core` (theme) |
| Clean code / monorepo | this whole structure + [`clean-code.md`](clean-code.md) |
