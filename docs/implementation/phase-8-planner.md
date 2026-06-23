# Phase 8 — Planner (the long tail)

**Goal:** an LLM **Planner** on the FastRouter miss path that turns arbitrary phrasing into
an ordered, multi-step `Plan` of capability calls — using the auto-generated capability
catalog so the model always knows exactly what the canvas can do.

**Why here:** FastRouter (Phase 6) owns the common path; now cover everything else without
sacrificing the latency contract (planner is miss-path only, hidden by speculation).

## Tasks

- [ ] **Capability catalog.** Auto-build from the registry: every capability's `name`,
      `summary`, and `parameters` JSON-schema. This is the model's "API" — it can never
      drift from real abilities because it's generated from the same registry.
- [ ] **Planner.** `plan(transcript, catalog, context) → Plan` via an LLM behind an
      `LLMCompleting` seam (stub in tests; never hit network in tests). Strict structured
      JSON output, low reasoning effort, tiny max tokens (reuse CasprFlow's config pattern:
      env → local json → app-support). Context includes live windows+callsigns, focused
      window, active project, available connectors.
- [ ] **Orchestrator multi-step.** Execute a `Plan`'s calls in order, threading each
      `CapabilityResult.data` into the next call's `ExecutionContext`. Confirm/clarify gates
      apply per step. Summarize the chain in the HUD readout.
- [ ] **Speculative planning.** On a likely FastRouter miss, warm the planner request while
      the user is still speaking; discard if FastRouter ends up hitting.
- [ ] **Honest fallback.** If the planner can't form a valid plan, the HUD says so plainly
      ("I didn't catch a clear action") — never a silent no-op.
- [ ] **Model config in Profiles.** API key + model selectable in the right-rail Profiles
      section; with no key, the app runs FastRouter-only and says so.

## Where

`packages/agents` (catalog builder, Planner, multi-step Orchestrator), `packages/shared`
(`LLMCompleting` seam, Plan types), `apps/desktop` (LLM HTTP in main behind IPC),
right-rail Profiles (Phase 4) for config.

## Exit criterion

Long-tail utterances that FastRouter misses — e.g. "split Orion's work: have it run tests
while Vega lints, then show me both diffs" — produce a sensible multi-step plan that
executes with results threaded, and the HUD summarizes the chain. Tests cover planning with
a stubbed LLM. Common commands still never touch the planner.

## Watch-outs

- The catalog is generated, not written — adding a capability must surface it to the model
  automatically. Never maintain a hand-written tool list.
- Keep the planner strictly off the common path; watch for "everyday command fell to the
  planner" regressions — that's a latency bug, widen FastRouter.
- Validate the LLM's plan against the capability schemas before executing; reject/clarify
  malformed plans rather than executing garbage.
- Side-effect gating is per-step — a multi-step plan with a destructive step still confirms.
