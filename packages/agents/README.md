# @casprflowos/agents

The intent layer: how a voice or text command becomes canvas actions. **The brain.**

## Responsibility
- **Capability registry** — the single source of truth for everything voice/text can do.
- **FastRouter** — deterministic, zero-network matcher (the latency-critical common path).
- **Planner** — LLM, miss-path only; turns the long tail into an ordered `Plan` using the
  auto-generated capability catalog.
- **Orchestrator** — `handle(transcript, source)`: route → execute → thread results → gate
  side-effects (confirm) → drive clarify (`ask_user`) → render the "what it did" readout.
- The seed capabilities (`focus_window`, `pan_zoom`, `spawn_agent`, `run_in_terminal`,
  `open_diff`, `close_window`, `arrange`, `ask_user`, `open_connector`, …).

## Boundaries
- May depend on `@casprflowos/shared` only. Acts on the canvas/terminals/OS **through the
  ports** (`CanvasPort`, `TerminalPort`, `OsPort`) defined in `shared` — **never** imports
  `canvas-core`/`terminal`/`mcp` internals. This is what makes it unit-testable with fakes.
- The LLM call goes through the `LLMCompleting` seam (stubbed in tests, real in the app).

## Invariants
- FastRouter is synchronous and allocation-light; the planner is the only network on the
  dispatch path, and only on a miss.
- The capability registry feeds FastRouter, the planner catalog, **and** the command-bar
  autocomplete — never a second hand-maintained list.
- Never auto-send outward-facing/destructive actions — gate with `confirm`.

See [`../../docs/voice-and-intent.md`](../../docs/voice-and-intent.md) and
[`../../docs/reference/casprflow-architecture.md`](../../docs/reference/casprflow-architecture.md).
