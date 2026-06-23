# Architecture — Agentic Orchestrator (v3)

## What changed and why

v2 routed every command by **classifying it into a fixed 8-case enum**, then ran a
**thin one-shot handler**. That is the wall CasprFlow hit in production:

- The deterministic router is **8 regex rules**. Anything phrased outside them misses.
- The LLM fallback only **re-classifies into the same fixed enum** — no planning, no
  multi-step, no decomposition. The long tail collapses to `.unknown` → "Didn't catch
  that."
- Handlers are **single-step programmatic shots**. There is no agent that can observe a
  result and decide the next action, and **no path at all** for apps without a URL
  scheme / AppleScript / CLI.

v3 replaces *classify→handler* with **plan→capabilities→agent**. The model interprets
an arbitrary spoken task, decides **which capability** does the job (programmatic first,
computer-use as the escape hatch, a sub-agent loop for multi-step work), and executes —
keeping the deterministic zero-network fast-path for the trivial common cases so latency
stays a feature.

## One-line model

```
hold hotkey → voice → FastRouter ──hit──→ execute one capability
                          │ miss
                          ▼
                       Planner (LLM) → Plan(ordered CapabilityCalls)
                          │
                          ▼
                     Orchestrator executes steps, threading results
                          │  (a step may be `run_task` → in-app TaskAgent loop)
                          ▼
              Capability execution:
                 programmatic (URL/app/shell/paste/swarm)  ← preferred
                 control_ui  (Accessibility-first, vision fallback)  ← escape hatch
                          ▼
                 ActionResult → HUD result / clarify / confirm
```

## The three execution tiers (this is the core idea)

Every task resolves to one of three execution strategies. The planner's main job is
choosing the **cheapest tier that can do the job**:

| Tier | Mechanism | When | Cost |
|---|---|---|---|
| **1. Programmatic** | URL scheme, AppleScript, deep link, CLI, paste, swarm spawn | A capability covers the action directly | ~instant, reliable |
| **2. Agentic** | In-app `TaskAgent` loop calling capabilities until the goal is met | Multi-step task; outcome depends on intermediate results | seconds, model in loop |
| **3. Computer-use** | `control_ui`: Accessibility-tree driving, vision (screenshot→model→click) fallback | No programmatic path exists for the target app | slowest, last resort |

Programmatic is always tried first. Computer-use is **only** reached when nothing
programmatic can do it — this preserves the latency contract while removing the v2
ceiling.

## Capability model (replaces ActionHandler)

A **Capability** is a typed tool the planner and agent can call. It is the single
extension point: adding ability = adding a capability, never new plumbing.

```swift
public protocol Capability: Sendable {
    /// Stable identifier the planner/agent calls by name, e.g. "open_app".
    var name: String { get }
    /// One-line description shown to the planner. Tells it WHEN to pick this.
    var summary: String { get }
    /// JSON-schema of arguments, surfaced in the planner catalog and used to validate.
    var parameters: CapabilitySchema { get }
    /// Outward-facing/irreversible (send a message, run destructive shell). Gated.
    var sideEffect: SideEffect { get }   // .readOnly | .local | .confirm
    /// Optional zero-network shortcut so trivial commands skip the planner.
    func fastMatch(_ text: String) -> CapabilityCall?
    /// Run the call. Reads args + prior results from context; returns a result.
    func execute(_ call: CapabilityCall, context: ExecutionContext) async throws -> CapabilityResult
}

public struct CapabilityCall: Equatable, Sendable {
    public let capability: String              // must match a registered name
    public let arguments: [String: JSONValue]  // validated against the schema
}

public struct CapabilityResult: Sendable {
    public let ok: Bool
    public let message: String?      // shown in the HUD
    public let observation: String?  // fed back to the TaskAgent as the next observation
    public let data: [String: JSONValue]  // structured output later steps can read
}
```

`ActionResult` is kept as the HUD-facing surface; `CapabilityResult` reduces to it for
display. Existing executors (`URLSchemeLauncher`, `AppLauncher`, `ShellRunner`,
`AppleScriptRunner`, `SwarmHost`, `PasteService`) are **reused unchanged** behind thin
capability wrappers.

### Seed capability set

| Capability | Tier | Backed by | Notes |
|---|---|---|---|
| `open_url` | 1 | `URLSchemeLauncher` | any URL / deep link |
| `open_app` | 1 | `AppLauncher` | launch/focus app |
| `web_search` | 1 | `URLSchemeLauncher` | search URL |
| `run_shell` | 1 | `ShellRunner` | allowlisted; `.confirm` for anything else |
| `run_applescript` | 1 | `AppleScriptRunner` | drive scriptable apps |
| `spawn_swarm` | 1 | `SwarmHost` (Ghostty) | terminal code agents (kept) |
| `paste_text` | 1 | `PasteService` | draft into focused app — **never auto-send** |
| `draft_artifact` | 1/2 | `ArtifactWindow` | stream output to floating panel, user acts |
| `control_ui` | 3 | `AccessibilityDriver` → `VisionComputerUse` | escape hatch |
| `run_task` | 2 | `TaskAgent` | open-ended multi-step desktop task |
| `ask_user` | — | clarifier hook | resolve a missing slot in the HUD |

The list is open-ended. The first six already have working executors; v3 wraps them and
adds the rest.

## Components

| Component | Responsibility | State |
|---|---|---|
| `VoiceHUDController` / `VoiceInputService` | Push-to-talk, on-device STT, transcript→spinner HUD | **kept** (phase 1) |
| `Capability` / `CapabilityRegistry` | Typed-tool protocol + registry; build planner catalog; dispatch by name | **new** (phase 8) |
| `ExecutionContext` | Per-run state: rawText, frontmost app, prior results, clarifier/confirmer hooks, logger | **new** (phase 8) |
| `FastRouter` | Deterministic zero-network shortcuts → single-step `Plan` | **new**, replaces `DeterministicRouter` (phase 9) |
| `Planner` | LLM → multi-step `Plan` from the capability catalog; strict JSON | **new**, replaces `LLMRouter` (phase 10) |
| `Orchestrator` | fast-path → plan → execute steps, thread results, confirm/clarify gates | **new**, replaces `routeAndDispatch` (phase 11) |
| `TaskAgent` | In-app observe→think→act loop over a capability subset; step budget | **new** (phase 12) |
| `AccessibilityDriver` | Read AX tree, find element, press/set value, list windows | **new** (phase 13) |
| `VisionComputerUse` / `ComputerUseModel` | Screenshot→model→CGEvent loop; AX-first fallback | **new** (phase 14) |
| `ArtifactWindow` | Floating always-on-top panel; stream output; Run/Copy/Dismiss | **new** (phase 15) |
| Executors (`URLSchemeLauncher`, `AppLauncher`, `ShellRunner`, `AppleScriptRunner`, `SwarmHost`, `PasteService`) | Programmatic primitives | **kept** |
| `LLMClient` | OpenAI Responses client (planner). Anthropic client added for vision (phase 14) | **kept / extended** |
| `ProjectResolver` | Resolve spoken project names for the swarm | **kept** |
| Permission stack | Accessibility + Screen Recording — now load-bearing for `control_ui` | **kept** |

## Data flow (one dispatch)

1. Hotkey **press** → prewarmed HUD, on-device capture, live partials.
2. **Release** → final transcript → `Orchestrator.handle(transcript)`.
3. **FastRouter** tries each capability's `fastMatch`. A hit returns a one-step `Plan`
   with confidence 1, **zero network** — the v2 common path is preserved exactly.
4. On a miss, the **Planner** is called with the transcript, the **capability catalog**
   (names + summaries + schemas), and light context (frontmost app, time). It returns an
   ordered `Plan` of `CapabilityCall`s plus a short rationale. It is told to **prefer
   tier 1**, use `run_task` for multi-step, and `control_ui` only when nothing
   programmatic fits.
5. The **Orchestrator** executes steps in order, threading each `CapabilityResult.data`
   into the next step's `ExecutionContext`. A `run_task` step hands control to a
   **TaskAgent** loop. A `.confirm` side-effect (send, destructive shell) pauses for an
   explicit confirm in the HUD. A missing required arg triggers `ask_user`.
6. The HUD shows the final result / clarify prompt / confirm prompt. **Outward-facing
   actions are never auto-performed** — drafts are pasted, the user sends.

## Computer-use: hybrid, Accessibility-first

`control_ui` is the tier-3 escape hatch. It runs an inner loop:

1. **Accessibility first.** `AccessibilityDriver` reads the focused app's AX element tree
   (`AXUIElement`), finds the target by role/title/identifier/value, and acts
   (`AXPress`, set `AXValue`). Local, fast, no pixels — covers most native + many web
   UIs. Requires the existing **Accessibility** permission.
2. **Vision fallback.** When AX can't reach the element, capture a screenshot (existing
   **Screen Recording** permission), send it to a `ComputerUseModel` (Anthropic
   computer-use), receive a click/type/scroll action in screen coordinates, perform it
   with `CGEvent`, screenshot again, loop until done or the step budget is hit.

Both permissions already exist in the kept permission stack, including the
drag-into-Settings flow — v3 makes them load-bearing rather than optional. Vision is
gated on a config key; with no key, `control_ui` runs AX-only and reports honestly when
it cannot reach a target.

## In-app TaskAgent vs the terminal swarm

Two distinct "agent" concepts — do not conflate them:

- **`spawn_swarm` (kept):** launches external `codex`/`claude` **CLI** processes in
  Ghostty panes. For **coding** tasks across a repo. Out-of-process, terminal-visible.
- **`run_task` / `TaskAgent` (new):** an **in-app** LLM loop that calls capabilities
  (programmatic + `control_ui`) to accomplish a **desktop** task in realtime on the
  user's behalf. In-process, drives the live machine.

The planner picks `spawn_swarm` for "spin up N agents on \<repo>", and `run_task` for
"go do \<multi-step thing> on my computer".

## Design invariants (carried from v2, still locked)

- **Latency is the product.** Tier 1 fast-path stays zero-network and synchronous. The
  planner is only on the miss path. See [`latency.md`](latency.md).
- **Universal by design.** Capabilities compose app-agnostic primitives; no app-specific
  knowledge in the core. See [`decisions.md`](decisions.md) D2b.
- **Never auto-send.** Outward-facing capabilities are `.confirm` and paste-not-send.
- **Programmatic before vision.** Computer-use is the last tier, never the default — see
  the revised [`decisions.md`](decisions.md) D2.

See [`connectors.md`](connectors.md) for the kept file map and
[`implementation/README.md`](implementation/README.md) for the phase queue.
