# Decisions log

Locked technical choices. v3 revises the routing/dispatch decisions (D2, D3, D4) for the
agentic orchestrator and adds D9–D13. The latency, native-stack, voice, swarm,
artifact, and never-send decisions stay as-is. Carry these into the build; revisit only
with reason.

## D0 — Ultra-low latency is the governing constraint (overrides feature scope)

Latency is the spine, not a feature among features. Every decision below is subordinate
to it. The common path stays **zero-network and sub-second**; the agentic additions
(planner, task agent, computer-use) live *under* this constraint via a wide deterministic
fast-path and speculative planning. If a capability cannot meet its tier budget, change
the approach, not the budget. See [`latency.md`](latency.md).

## D1 — Native Swift / AppKit, not Electron or web

The hotkey, window, Accessibility, synthetic paste, on-device speech, AX-driving, and
`CGEvent` synthesis all want the native path. Keep the existing SwiftPM native app.

## D2 — Programmatic first; computer-use is the last tier, never the default *(revised)*

v2 banned vision outright. v3 keeps that bias but adds a **gated escape hatch** so apps
with no URL scheme / AppleScript / CLI are still reachable:

- **Tier 1 (programmatic)** — URL schemes, AppleScript, deep links, CLI, paste, swarm.
  Always tried first. Covers the overwhelming majority.
- **Tier 3 (computer-use, `control_ui`)** — reached **only** when nothing programmatic
  fits. **Accessibility-first** (local `AXUIElement`, fast), **vision fallback**
  (screenshot→model→`CGEvent`) only when AX can't reach the element.

The latency contract is preserved because tier 3 is rare by construction and AX is
local. Vision is allowed but is the slow, last-resort path — it must never sit where a
tier-1 capability could have run. See architecture "three execution tiers".

## D2b — Universal by design; reference flows are examples, not the scope

CasprFlow is a **general dispatcher**, not a launcher for a fixed app list. The design is
a small set of **app-agnostic primitives** and **thin capabilities** composed over them.
Adding ability = adding a capability, never new plumbing. No app-specific knowledge in
the core — keep it at the edge (a capability, a config entry).

## D3 — Plan over a wide deterministic fast-path *(revised)*

Routing is no longer "classify into a fixed enum". It is:

- **FastRouter (tier 1, deterministic, zero network)** — matches the common command
  families to a single `CapabilityCall`. Must be **wide** (synonyms, slot tolerance),
  not a handful of regexes, so the planner stays off the common path.
- **Planner (LLM, miss path only)** — interprets the long tail into an ordered,
  multi-step `Plan` of capability calls, choosing the cheapest tier that works.

The deterministic path still owns the common case; the planner adds interpretation and
decomposition for everything else, hidden behind speculative planning.

## D4 — Planner + agent model = OpenAI nano; vision = Anthropic computer-use *(revised)*

- **Planner / TaskAgent:** reuse the existing OpenAI client (`LLMClient`, default
  `gpt-5.4-nano`) with strict structured output, `reasoning.effort = low`, tiny
  `max_output_tokens`. Zero new setup; fast enough for speculative planning.
- **Vision computer-use:** a separate `ComputerUseModel` seam, default impl
  **Anthropic computer-use** (best tool-use for screen control), gated on an optional
  config key. No key → `control_ui` runs **AX-only** and reports when it can't reach a
  target. Both seams are swappable (Groq/Cerebras/local classifier for the planner; any
  vision provider) without touching capabilities.

## D5 — Input: voice only, on-device STT

Push-to-talk via `SFSpeechRecognizer`, `requiresOnDeviceRecognition = true`, streaming
partials into the HUD. No command text box. On-device keeps the voice path off the
network — and the streaming partials are what make **speculative planning** possible.

## D6 — Agent swarm via a swappable `SwarmHost` (Ghostty default)

`spawn_swarm` talks to a `SwarmHost` protocol; the terminal is an implementation detail
(Ghostty default; tmux/Warp/iTerm alternates). This is the **out-of-process, terminal,
coding-agent** path (external `codex`/`claude` CLI) — distinct from the in-app
`TaskAgent`. Codex is the default tool; Claude is an explicit option. Don't let any
single terminal leak into the core.

## D7 — Floating artifact window is a first-class primitive

The "get this doc ready for Prachi" flow (skill-loaded agent → stream output into a
floating always-on-top window → user clicks Run) is in the design. Its building block —
`ArtifactWindow` on the `FloatingPanel` shell, streaming output + Run/Copy/Dismiss — is a
reusable primitive backing the `draft_artifact` capability.

## D8 — Never auto-send

Outward-facing capabilities (`paste_text`, anything that sends, destructive `run_shell`)
are marked `.confirm` and paste-not-send. The user presses send. Human stays in the loop
on irreversible/outward actions.

## D9 — Capability is the single extension point *(new)*

`ActionHandler`'s fixed-enum coupling is replaced by `Capability`: a typed tool with a
name, summary, JSON-schema arguments, a `sideEffect` class, and an optional `fastMatch`.
The same capability object serves **both** the deterministic FastRouter (`fastMatch`) and
the planner/agent (catalog entry). One registry; adding ability = registering a
capability. No `IntentKind` enum, no bespoke plumbing per action.

## D10 — Planner emits a complete plan; iterate only when forced *(new)*

The planner returns an **ordered multi-step `Plan`** up front whenever the steps are
knowable from the request — one round-trip, then local execution. The iterative
`TaskAgent` loop (`run_task`) is used **only** when the next action genuinely depends on a
runtime observation. Fewer model hops = lower latency (D0).

## D11 — Computer-use is hybrid: Accessibility-first, vision fallback *(new)*

`control_ui` always attempts the **Accessibility** path first (read AX tree, match
element, `AXPress` / set `AXValue`) — local and fast. **Vision** (screenshot → model →
`CGEvent` click/type) is the fallback within the same capability, entered only when AX
cannot reach the element. The existing Accessibility + Screen Recording permissions (and
the drag-into-Settings flow) become load-bearing.

## D12 — In-app `TaskAgent` ≠ terminal swarm *(new)*

Two separate agent concepts, kept distinct:
- `spawn_swarm` → external CLI coding agents in Ghostty panes (D6).
- `run_task` → in-app LLM loop driving the live machine via capabilities (incl.
  `control_ui`) to do a multi-step desktop task on the user's behalf.

The planner selects between them by task type. The `TaskAgent` cannot spawn another
`TaskAgent` (recursion guard).

## D13 — Confirm/clarify gates are part of dispatch *(new)*

The orchestrator has two interactive hooks, surfaced in the HUD, that any capability can
trigger:
- **clarify (`ask_user`)** — a missing required argument (e.g. ambiguous project) prompts
  once; the answer (alias) is remembered.
- **confirm** — a `.confirm` side-effect pauses for explicit user approval before
  running. Never auto-perform outward/irreversible actions (D8).

These gates are the only allowed interruptions; they must not appear on the tier-1 happy
path.
