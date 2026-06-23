# Phase 6 — Intent layer (text first)

**Goal:** the command pipeline — capability registry + FastRouter + Orchestrator + a text
**command bar** — driving the canvas. Voice comes in Phase 7 as a second front-end to this
exact pipeline.

**Why text first:** it lets us build and test the whole intent pipeline deterministically,
without the STT variable. Voice then just feeds transcripts in.

## Tasks

- [ ] **`packages/agents` scaffolding.** Define the core types in `shared` (so capabilities
      can act on the canvas via ports without importing canvas internals):
      `Capability`, `CapabilityCall`, `CapabilityResult`, `ExecutionContext`,
      `CanvasPort`, `TerminalPort`, `OsPort`. See
      [`../architecture.md`](../architecture.md) and
      [`../voice-and-intent.md`](../voice-and-intent.md).
- [ ] **Capability registry** — the single source of truth. Each capability has
      `name/summary/parameters/sideEffect/fastMatch/execute`.
- [ ] **Seed capabilities** (v1 set): `focus_window`, `pan_zoom`, `spawn_agent`,
      `run_in_terminal`, `open_diff`, `close_window`, `arrange`, `ask_user`. Back them with
      the Phase 5 ports.
- [ ] **FastRouter** — deterministic, zero-network matcher built from each capability's
      `fastMatch`. Wide: synonyms, loose word order, fuzzy callsign resolution via the
      allocator. Table-driven tests are mandatory.
- [ ] **Orchestrator** — `handle(transcript, source)`: FastRouter → execute (single-step in
      this phase), thread results, gate `confirm` side-effects, drive `ask_user` clarify,
      and **render the result readout** ("what it did").
- [ ] **Command bar (`ui`)** — glass input (rebuild, don't resurrect TermCanvas's command
      palette). Enter routes to `Orchestrator.handle(text, "text")`. Autocomplete pulls
      capability names + live callsigns from the registry/scene.
- [ ] **HUD readout surface** — even without voice, show the orchestrator's result line in a
      glass pill (the same surface voice will reuse).

## Where

`packages/agents` (registry, FastRouter, Orchestrator, capabilities), `packages/shared`
(types + ports), `packages/ui` (command bar + result pill).

## Exit criterion

Typing commands drives the canvas end-to-end: "focus Orion", "spawn a codex agent on
casprflowos", "show Nova's diff", "zoom out", "close Vega" — each executes and the HUD pill
states what happened. Destructive actions prompt a confirm. FastRouter has a passing
table-driven test suite.

## Watch-outs

- **Single source of truth:** FastRouter patterns, command-bar autocomplete, and (Phase 8)
  the planner catalog all read the registry. Don't hand-maintain a second command list.
- Keep FastRouter **synchronous and allocation-light** — it's the latency-critical path.
- Capabilities act through **ports/interfaces**, never by importing `canvas-core`/`terminal`
  internals — this is what keeps `agents` unit-testable.
- Get `run_in_terminal`'s gating right: queue/type into the agent, surface in the readout,
  confirm anything destructive. Never silently fire.
