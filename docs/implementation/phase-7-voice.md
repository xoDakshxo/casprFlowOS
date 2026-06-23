# Phase 7 — Voice

**Goal:** `Option+Space` → glass HUD → on-device Whisper → the **same** intent pipeline
from Phase 6. Speaking and typing become two front-ends to one Orchestrator.

**Why here:** the pipeline is proven deterministically (Phase 6). Voice only adds the
transcript front-end + the live HUD. Keep them isolated so STT issues never touch routing.

## Tasks

- [ ] **Global hotkey.** Register `Option+Space` (Electron `globalShortcut`) for
      push-to-talk: press = start listening, release = finalize. Source of truth for the
      hotkey in one place; make it rebindable later via Profiles.
- [ ] **Prewarmed HUD.** Allocate the voice HUD overlay **once at launch**; the hotkey only
      shows it (`< 16ms` to visible). Never construct on the hot path. States: listening /
      processing / result / error / clarify (see `design-language.md` HUD anatomy).
- [ ] **`packages/voice` STT.** `Transcriber` interface; whisper.cpp implementation via a
      native binding running in main (audio capture → partial + final transcripts).
      Model files download on first run into git-ignored `models/`. Stream partials to the
      HUD while held; emit final on release.
- [ ] **Wire to the pipeline.** On release: final transcript →
      `Orchestrator.handle(transcript, "voice")`. The processing spinner is the
      `LogoSpinner`; the result line reuses the Phase 6 readout surface.
- [ ] **Permissions.** Mic (+ speech where relevant) first-run prompt with a clear guide,
      same spirit as CasprFlow's permission flow.
- [ ] **Optimistic spinner.** Show processing the instant the key is released, before the
      orchestrator returns.
- [ ] **Latency check.** Verify the FastRouter voice path is sub-second wall clock on common
      commands; if everyday commands miss to a (future) planner, widen FastRouter.

## Where

`packages/voice` (hotkey glue, Transcriber, HUD controller), `apps/desktop` (globalShortcut,
audio capture + whisper.cpp in main, model download), `packages/ui` (HUD view + states),
`packages/agents` (unchanged — just receives transcripts).

## Exit criterion

Hold `Option+Space`, say "focus Orion," release — Orion focuses and the HUD shows
"Focused Orion." Partial transcript streams live while speaking; processing shows the logo
spinner; result shows the readout. Common commands meet the latency budget. Voice and text
produce identical actions.

## Watch-outs

- whisper.cpp model size vs latency: pick a small/quantized model for the push-to-talk loop;
  make the model configurable in Profiles.
- Keep STT entirely behind the `Transcriber` seam — the Orchestrator must not know whether a
  transcript came from voice or text (except for the `source` tag).
- Don't block the UI thread on audio/STT; capture + transcribe in main, stream results.
- The HUD must always end in a truthful state — success, clarify, or a plain error — never
  spin forever.
