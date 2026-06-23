# @casprflowos/voice

The voice front-end: global hotkey, the HUD controller, and on-device speech-to-text.

## Responsibility
- Push-to-talk hotkey glue (`Option+Space`: press = listen, release = finalize). The
  binding's source of truth; rebindable via Profiles.
- HUD controller: drives the prewarmed glass HUD through listening → processing → result →
  error/clarify states (the HUD *view* lives in `ui`).
- `Transcriber` interface + the **on-device Whisper** (whisper.cpp) implementation. Streams
  partial transcripts while held, emits a final on release. Engine is swappable behind the
  interface.

## Boundaries
- May depend on `@casprflowos/shared` and `@casprflowos/ui`. **Does not** know about routing
  — it hands the final transcript to the Orchestrator in `agents` and is done.
- Audio capture + the whisper binding run in `apps/desktop` main; this package coordinates
  through IPC. Model files download to a git-ignored `models/` dir.

## Invariants
- Prewarm the HUD at launch; the hotkey only shows it (`<16ms`).
- The Orchestrator must not care whether a transcript is voice or text (only a `source`
  tag). See [`../../docs/voice-and-intent.md`](../../docs/voice-and-intent.md).
