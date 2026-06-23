# @casprflowos/desktop

The Electron application — the only place the whole system is wired together.

## Responsibility
- **main**: window lifecycle + custom chrome, `globalShortcut` (Option+Space), the pty
  host (node-pty), git/file watchers feeding the diff rail, on-device Whisper capture,
  LLM HTTP (planner), keychain, all IPC handlers.
- **preload**: a narrow, typed `contextBridge` surface — one validated function per
  capability. No raw `ipcRenderer`, no `nodeIntegration`.
- **renderer** (`src/`): the React host that mounts the canvas, rails, voice HUD, and
  command bar, and runs the intent pipeline.

## Boundaries
- **May import** any `@casprflowos/*` package. **Nothing imports this app.**
- Anything touching fs / pty / network / shell lives here in main, behind a named IPC
  channel with validated payloads. The renderer never touches Node directly.

## Layout (target)
```
electron/   main.ts, preload.ts, pty host, watchers, ipc
src/        main.tsx, App.tsx, renderer wiring
```

See [`../../docs/architecture.md`](../../docs/architecture.md) and
[`../../docs/clean-code.md`](../../docs/clean-code.md).
