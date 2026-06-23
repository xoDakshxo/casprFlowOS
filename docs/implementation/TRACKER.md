# Phase Tracker

Live status of the casprFlowOS build. **Update this as you work** — flip the status when
you start/finish a phase, and check off items as they land. This is the single place to see
where the build is.

Status legend: ⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked

## Phase status

| # | Phase | Status | Exit criterion met? | Notes |
|---|---|---|---|---|
| 0 | [Foundations](phase-0-foundations.md) | ✅ | ✅ | `pnpm dev` boots a dark glass window; `pnpm verify` green |
| 1 | [Cleanup & extract core](phase-1-cleanup-extract.md) | 🟡 | — | CanvasPort + pure canvas-core scene slice started; pty/panel pending |
| 2 | [Rebrand](phase-2-rebrand.md) | ⬜ | — | no `termcanvas` strings; casprFlow logo + name |
| 3 | [Design system & glass](phase-3-design-glass.md) | ⬜ | — | glass UI, translucent terminals, canvas themes |
| 4 | [Rails](phase-4-rails.md) | ⬜ | — | left work rail + right OS rail; favourite project opens on launch |
| 5 | [Agents on the canvas](phase-5-agents.md) | ⬜ | — | add Claude Code/Codex; callsigns + status |
| 6 | [Intent layer (text)](phase-6-intent-text.md) | ⬜ | — | typed commands drive canvas; HUD readout |
| 7 | [Voice](phase-7-voice.md) | ⬜ | — | Option+Space → Whisper → same pipeline |
| 8 | [Planner (long tail)](phase-8-planner.md) | ⬜ | — | LLM planner on FastRouter miss |
| 9 | [OS surfaces & MCP](phase-9-os-mcp.md) | ⬜ | — | connectors + Spotify surface; automations/skills/profiles |
| 10 | [Polish & latency](phase-10-polish.md) | ⬜ | — | taste + latency budget + shippable build |

**Current phase:** Phase 1 — Cleanup & extract core
**Last updated:** 2026-06-24

---

## Detailed checklists

Mirror of each phase doc's tasks. Check items here as they land; the phase doc remains the
full spec. Keep them in sync.

### Phase 0 — Foundations
- [x] Root toolchain (prettier/eslint/ts); `pnpm -r build/typecheck/lint/test`
- [x] Per-package `tsconfig.json` extending base, with project references
- [x] `packages/shared`: core types/result/logger/event-bus stubs
- [x] `packages/ui`: tokens.css + `.glass` + `GlassPane`/`GlassPill`
- [x] `apps/desktop`: minimal main + empty typed preload + logo splash renderer
- [x] `pnpm dev` boots; `pnpm verify` green

### Phase 1 — Cleanup & extract core
- [ ] Port `src/canvas/` → `canvas-core` (drop drawing/annotation/cluster/waypoint)
- [ ] Port kept stores; define + implement `CanvasPort`
- [ ] Port terminal tiles → `terminal`; pty host into `apps/desktop` main
- [ ] Live pty round-trip in a tile
- [ ] Port git/file watchers (diff/files/git) into main behind IPC
- [ ] Port the **whole `RightPanel/` suite** (file tree + diffs + git + editor), mount in
      left work sidebar, rename (e.g. `WorkPanel`)
- [ ] Port sessions (discovery/list/scanner/watcher) + `sessionStore` + left rail
- [ ] Delete everything marked DROP in extraction-map; strip i18n/`useT()`

### Phase 2 — Rebrand
- [ ] Identity sweep (`termcanvas`→`casprflowos`, appId, userData, IPC prefixes, titles)
- [ ] Logo wired; `<LogoSpinner>` port of `logo-loading.svg` in accent
- [ ] App icon generated for electron-builder
- [ ] Custom frameless dark glass title bar
- [ ] i18n removed entirely
- [ ] electron-builder product/appId/artifacts updated

### Phase 3 — Design system & glass
- [ ] Finalize tokens; reconcile `--accent` once
- [ ] `ui` primitives (GlassPane/Rail/Pill, Button, ContextMenu, status dots, …)
- [ ] Translucent terminals + opacity preference (clamped floor); focused tile lifts
- [ ] Canvas theme layer (Void/Grid/Dots/Aurora/Carbon) + `canvasThemeStore` + switcher
- [ ] Glass on all chrome; standardized motion constants

### Phase 4 — Rails
- [ ] Left work rail hosting the whole project/code panel (Sessions/Files/Diff/Git)
- [ ] Rows show callsign + agent badge + status dot; click-to-pan / click-to-open
- [ ] Right OS rail: Projects / Automations / Skills / MCP Connectors / Profiles
- [ ] `OsObject` model + `OsStore` in `shared`; persist locally; secrets → keychain
- [ ] Favourite project opens on launch; rails collapsible/resizable + remembered

### Phase 5 — Agents on the canvas
- [ ] `AgentAdapter` interface + registry (Claude Code, Codex, …)
- [ ] "Add agent" UI (toolbar + canvas context menu)
- [ ] `CallsignAllocator` (phonetic-distinct) in `shared`; assign on spawn; rename
- [ ] Per-agent status model surfaced to tile + rail
- [ ] Spawn exposed as a `TerminalPort` function (callable headlessly)
- [ ] Launch restores favourite project's agent canvas

### Phase 6 — Intent layer (text)
- [ ] Intent types + ports in `shared`
- [ ] Capability registry (single source of truth)
- [ ] Seed capabilities (focus/pan_zoom/spawn_agent/run_in_terminal/open_diff/close/arrange/ask_user)
- [ ] FastRouter (wide, zero-network) + table-driven tests
- [ ] Orchestrator (route → execute → thread → confirm/clarify → readout)
- [ ] Glass command bar → `Orchestrator.handle(text,"text")`; autocomplete from registry
- [ ] HUD result pill

### Phase 7 — Voice
- [ ] `Option+Space` push-to-talk via globalShortcut
- [ ] Prewarmed HUD (listening/processing/result/error/clarify)
- [ ] `Transcriber` + whisper.cpp in main; partials stream; model → git-ignored `models/`
- [ ] Final transcript → `Orchestrator.handle(t,"voice")`; LogoSpinner on processing
- [ ] Mic/speech permission first-run flow; optimistic spinner
- [ ] Latency check: common voice path sub-second

### Phase 8 — Planner
- [ ] Capability catalog auto-built from registry
- [ ] Planner via `LLMCompleting` seam, strict JSON, low effort (stubbed in tests)
- [ ] Orchestrator multi-step execution + result threading + per-step gating
- [ ] Speculative planning on likely miss
- [ ] Honest fallback when no valid plan
- [ ] Model config in Profiles; FastRouter-only without a key

### Phase 9 — OS surfaces & MCP
- [ ] `Connector` contract + registry/lifecycle in `packages/mcp`
- [ ] Connectors contribute capabilities to the registry
- [ ] Spotify reference connector: OAuth + glass player surface + transport
- [ ] Second-connector pattern proven (data + Surface only)
- [ ] Automations (saved sequences + triggers) wired through Orchestrator
- [ ] Skills (agent instruction presets) selectable on spawn
- [ ] Profiles consolidated (theme/opacity/hotkey/model/default agent/favourite project)

### Phase 10 — Polish & latency
- [ ] Motion + empty/edge states + HUD micro-copy + glass tuning
- [ ] Latency contract verified (HUD<16ms, FastRouter<2ms, common path sub-second)
- [ ] Canvas perf with 10+ agents; bounded blur layers
- [ ] Keyboard parity, focus rings, reduced-motion, contrast audit, crash boundaries
- [ ] Signed/notarized build; first-run experience; short user guide
