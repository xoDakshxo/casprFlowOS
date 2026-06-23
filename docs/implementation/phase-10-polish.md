# Phase 10 — Polish & latency

**Goal:** the taste-and-performance pass that makes casprFlowOS feel like an OS, not a demo
— and the first shippable build.

**Why last:** polish is cheap to undo and expensive to do early. Once the surface is stable,
spend real effort on feel, speed, and a release.

## Tasks

### Feel / taste
- [ ] Motion pass: consistent springs for focus/spawn/HUD/rail; nothing janky or
      decorative. The focused agent always reads as the brightest thing on screen.
- [ ] Empty/edge states: no-agents canvas, no-connectors, no-API-key, permission-denied —
      all calm and instructive, on-brand.
- [ ] HUD micro-copy: result readouts are crisp, plain-English, and always present.
- [ ] Glass tuning: blur/opacity/borders dialed for depth without milkiness; verify on
      multiple backgrounds/themes.

### Performance / latency
- [ ] Verify the **latency contract** (`reference/casprflow-latency.md`): HUD `<16ms`,
      FastRouter `<2ms`, common voice path sub-second. Profile and fix regressions.
- [ ] Prewarm all hot windows/overlays; audit for accidental network on the common path.
- [ ] Canvas perf with 10+ agents: no dropped frames on pan/zoom; pty output throttled;
      `backdrop-filter` layers bounded.

### Robustness / a11y
- [ ] Keyboard reachability for every voice action (text command bar parity); focus rings;
      reduced-motion honored (disable Aurora drift, dampen springs).
- [ ] Crash/error boundaries around the canvas and each surface; a dead connector or agent
      never takes down the app.
- [ ] Contrast audit at terminal opacity floor and across themes.

### Ship
- [ ] `electron-builder`: signed/notarized macOS build (and others as desired), auto-update
      feed if wanted (re-introduce a trimmed updater), artifact naming.
- [ ] First-run experience: permissions, model download, pick favourite project + default
      agent.
- [ ] A short user guide in `docs/` (hotkey, command examples, themes, connectors).

## Exit criterion

A signed build launches to the favourite project's agent canvas, voice + text both drive it
within the latency budget, the UI is consistently dark-glass and calm, and nothing in the
DROP list from `extraction-map.md` survives. It feels like an OS you'd want to live in.

## Watch-outs

- Don't gold-plate — polish to "proud to show," not to infinity. Taste is right-sized.
- A latency regression introduced late is still a latency bug; the contract is
  non-negotiable.
- Notarization/signing needs an Apple Developer account + secrets in CI — not in git.
