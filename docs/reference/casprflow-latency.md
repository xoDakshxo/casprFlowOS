# Latency contract

**Ultra-low latency is the spine of CasprFlow, not a polish item.** Every feature in v3
bends to it. If a capability can't hit its tier budget, change the approach — never the
budget. The agentic model (planner, task agent, computer-use) is added *under* this
contract, not as an excuse to relax it.

## The one rule that protects latency

**The common path must never touch the network.** The deterministic **FastRouter** has
to cover the *majority* of real spoken commands at zero network cost — not a handful of
regex shapes. The planner exists for the genuine long tail only. If everyday commands
start falling through to the planner, that is a latency bug: widen the FastRouter, don't
accept the round-trip.

## Budget by tier (hard targets, common path)

| Stage | Target | Mechanism |
|---|---|---|
| hotkey → HUD visible | < 16 ms | panel allocated once at launch; invoke = `orderFrontRegardless` only |
| voice transcript ready | ~0 network | on-device `SFSpeechRecognizer`; partials stream while holding |
| **FastRouter (tier 1)** | **< 2 ms** | pure-Swift match → `CapabilityCall`; no allocation churn, no network |
| programmatic dispatch (URL / app / AppleScript / paste) | < 100 ms | `NSWorkspace.open`, `osascript`, deep links |
| **end-to-end, FastRouter path** | **sub-second wall clock** | the overwhelming common case; excludes target app's own launch |
| Planner (tier 2, miss path only) | ~300–600 ms *added*, **hidden by speculation** | warm TLS + smallest structured output + low reasoning; started during speech |
| TaskAgent step | < 600 ms / hop | nano model, tiny outputs; cap total steps |
| Computer-use AX action (tier 3) | < 150 ms | local `AXUIElement`, no pixels |
| Computer-use vision action (tier 3) | seconds, **acknowledged-slow** | screenshot→model→`CGEvent`; rare, last resort, HUD says "working" |

Tier 3 vision is the **only** path allowed to be visibly slow, and only because it is
reached rarely and by necessity. It must never sit on a path a tier-1 capability could
have handled.

## Tactics (build in, not after)

1. **Prewarm the window.** The HUD `FloatingPanel` is allocated once in
   `AppCoordinator`; invoke = `orderFrontRegardless` only. Never allocate on the hotkey
   path. (Same for `ArtifactWindow` if it becomes hot.)
2. **Optimistic spinner.** Show the spinner the instant the user releases, before the
   orchestrator returns.
3. **Wide deterministic fast-path.** FastRouter covers the common command families
   (open / search / run / app-control / swarm / paste phrasings, with synonym + slot
   tolerance) at zero network. Measure its hit-rate; treat a low hit-rate as a defect.
4. **Speculative planning (the big v3 win).** The planner round-trip must overlap the
   user's speech, not follow it. When STT yields a **stable partial** mid-hold and the
   FastRouter does *not* claim it, fire the planner request immediately against that
   partial. On release, if the transcript is unchanged, the plan is already back —
   perceived planner latency ≈ 0. Cancel/refire if the partial changes materially.
5. **Warm TLS.** `LLMClient.preconnect()` at launch; one long-lived `URLSession`. Add a
   preconnect for the vision endpoint too once `control_ui` ships.
6. **On-device STT.** No audio leaves the machine; no network on the voice path.
7. **Plan up front, don't iterate.** Prefer the planner emitting a complete multi-step
   `Plan` over a `TaskAgent` that round-trips per step. Use `run_task` only when the next
   action genuinely depends on a runtime observation. Every avoided hop is saved latency.
8. **AX before vision, always.** `control_ui` tries the local Accessibility path first;
   vision is the fallback for that capability, never the entry point.
9. **Tiny model outputs.** Planner and agent request the smallest structured output that
   works, `reasoning.effort = low`, small `max_output_tokens`.

## How to measure (per-phase acceptance gate)

Log timestamps per dispatch: `release`, `route-done`, `plan-done` (if planned),
`dispatch-done`, plus the **tier taken** and whether speculation hit. Print deltas in
debug builds. Every phase that touches the hot path must show:

- FastRouter paths: `release → dispatch-done` well under **150 ms** (excl. app launch).
- Planner paths with speculation hit: feel sub-second end-to-end.
- A regression in FastRouter hit-rate or tier-1 timing **fails the phase**.

## Anti-patterns

- Do **not** let the planner become the default path. Widen FastRouter instead.
- Do **not** add a network hop to the tier-1 common path for any feature.
- Do **not** rebuild the panel per invocation.
- Do **not** enter `control_ui` (computer-use) when a programmatic capability exists for
  the target — vision is the last tier, not a convenience.
- Do **not** iterate a `TaskAgent` where a single up-front `Plan` would do.
- Do **not** block the main thread on network; run off-main, keep the HUD live.
