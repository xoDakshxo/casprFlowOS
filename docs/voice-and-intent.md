# Voice & Intent — casprFlowOS

How spoken or typed commands become canvas actions, and how the voice model knows every
command the canvas supports. Design carried from CasprFlow
([`reference/casprflow-architecture.md`](reference/casprflow-architecture.md),
[`reference/casprflow-latency.md`](reference/casprflow-latency.md)); rebuilt in TypeScript.

## The loop

```
hold Option+Space ─▶ HUD appears (prewarmed) ─▶ on-device Whisper streams partials
        │                                                        │
   release key ───────────────────────────────────────▶ final transcript
                                                                 ▼
                                  ┌─────────────────────────────────────────┐
                                  │ Orchestrator.handle(transcript, source)  │
                                  └─────────────────────────────────────────┘
                                                                 ▼
                FastRouter.match  ──hit──▶  CapabilityCall  ──▶  execute  ──▶  HUD result
                       │ miss
                       ▼
                Planner(LLM) ──▶ ordered Plan ──▶ Orchestrator executes, threads results
```

The **text command bar** enters at `Orchestrator.handle(transcript, "text")` — identical
downstream behaviour, no Whisper.

## Latency contract (inherited, non-negotiable)

- **The common path never touches the network.** FastRouter must cover the *majority* of
  real commands deterministically. If everyday commands fall through to the planner, that
  is a latency bug — widen FastRouter, don't accept the round-trip.
- **HUD is prewarmed.** Allocate the HUD window/overlay once at launch; the hotkey only
  shows it. Never construct on the hot path.
- **Optimistic spinner.** Show processing the instant the key is released.
- **Speculative planning.** On a likely miss, start warming the planner request while the
  user is still speaking.

Target: FastRouter path is **sub-second wall clock**, excluding the target's own work
(e.g. an agent's compile time). The planner is the long-tail-only escape hatch.

## How the voice model knows every command

This is the requirement: *"the voice model should have access to all the commands; it
should know how to handle this terminal canvas."* Two complementary mechanisms:

### 1. FastRouter — deterministic, wide, zero-network

A pure-TypeScript matcher over the **command families**, generated from the capability
registry. Each capability contributes `fastMatch(text)` patterns (verbs + synonyms + slot
extraction). This owns the common case:

- focus / go to / show me **<callsign>** → `focus_window { target }`
- zoom out / fit / show everything → `pan_zoom { mode }`
- spawn / start / new **<agent>** on **<project>** → `spawn_agent { agent, project }`
- close / kill **<callsign>** → `close_window { target }`
- show **<callsign>**'s diff → `open_diff { target }`
- tidy / arrange / clean up → `arrange {}`

FastRouter is **wide by design** (synonyms, loose word order, fuzzy callsign match), not a
few regexes — that's what keeps the planner off the common path.

### 2. Planner — the capability catalog as the model's "API"

On a FastRouter miss, the Planner LLM is called with:

- the transcript,
- the **capability catalog**: every capability's `name`, `summary`, and `parameters`
  JSON-schema (auto-built from the registry — so the model literally has the full,
  current list of what the canvas can do),
- light context: the current set of windows + callsigns, focused window, active project,
  available connectors.

It returns a strict-JSON ordered `Plan` of `CapabilityCall`s. Because the catalog is
generated from the same registry FastRouter and the Orchestrator use, **the model can
never drift out of sync with the canvas's real abilities** — add a capability and it
appears in the model's catalog automatically.

> Design rule: **the capability registry is the single source of truth.** FastRouter
> patterns, the planner catalog, the command-bar autocomplete, and the executor all read
> from it. Never hand-maintain a second list of "what voice can do."

## ExecutionContext

Each dispatch carries a context object the capabilities read/write:

```ts
interface ExecutionContext {
  rawText: string;
  source: "voice" | "text";
  windows: WindowSummary[];      // callsign, project, agent, focused, status
  focusedWindowId: string | null;
  activeProjectId: string | null;
  connectors: ConnectorSummary[];
  priorResults: CapabilityResult[];   // threaded across multi-step plans
  confirm(prompt: string): Promise<boolean>;   // HUD confirm gate
  clarify(slot: string, prompt: string): Promise<string>;  // ask_user
  log: Logger;
}
```

## Side-effect gating (never auto-send)

Capabilities declare a side-effect level: `readOnly` | `local` | `confirm`.

- `readOnly` (open a diff) and `local` (focus, zoom, arrange) run immediately.
- `confirm` (destructive shell, closing unsaved work, anything outward-facing) pauses for
  an explicit confirm in the HUD.
- Commands *into* an agent terminal are queued/typed, surfaced in the HUD readout, and —
  for anything destructive — confirmed. We don't silently fire risky actions. Carried from
  CasprFlow's "never auto-send."

## The result readout ("write what it did")

Every dispatch ends by rendering a one-line, plain-English summary in the HUD of what
happened — e.g. `Focused Orion · queued: npm test`. For multi-step plans, summarize the
chain. Errors and clarifications render in the same surface. This is a hard requirement,
not optional polish: the user must always see what the system did on their behalf.

## STT: on-device Whisper

- Hidden behind a `Transcriber` interface in `packages/voice` so the engine is swappable.
- whisper.cpp via a native binding; model files are downloaded on first run into a
  git-ignored `models/` dir (never committed).
- Streams partial transcripts to the HUD while the key is held; emits a final transcript on
  release.
- Mic + (where relevant) speech permissions handled with a clear first-run prompt, same
  spirit as CasprFlow's permission flow.

## Testing the pipeline

- FastRouter: table-driven tests of utterance → expected `CapabilityCall` (include
  synonyms, word-order variants, fuzzy callsigns). This is the latency-critical surface —
  test it hard.
- Planner: stub the LLM behind an `LLMCompleting` seam; assert plans for representative
  long-tail utterances; never hit the network in tests.
- Orchestrator: assert result threading, confirm/clarify gating, and HUD readout text.
- Capabilities: unit-test `execute` against fake canvas/terminal ports.
