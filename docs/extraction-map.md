# Extraction Map — what to take from TermCanvas (and what to delete)

Source of truth for **Phase 1 (cleanup) and Phase 2 (port)**. The rule:
**extract the bare-bones canvas+terminal+diff infra; delete everything else.** When in
doubt, delete — it's easier to port one more file later than to carry fluff.

TermCanvas lives at `../termcanvas` (sibling of this repo). Do **not** edit it; copy
selectively into `casprFlowOS/packages/*`, rename, and rewrite imports as you go.

Legend: **KEEP** = port into casprFlowOS · **DROP** = do not bring · **TRIM** = port a
reduced version.

## Top-level directories

| Dir | Verdict | Notes |
|---|---|---|
| `src/` | KEEP (selective) | the renderer; see per-subdir table below |
| `electron/` | KEEP (selective) | main-process services; see table below |
| `shared/` | TRIM | bring only types/utils the kept code imports |
| `public/`, `index.html`, `vite.config.ts` | TRIM | reuse as the basis for `apps/desktop` config |
| `scripts/postinstall.mjs` | TRIM | keep electron-builder app-deps; drop the playwright install |
| `cli/`, `dist-cli/` | DROP | the `termcanvas`/`hydra`/`browse` CLIs are out of scope |
| `agent/` | DROP | standalone agent workspace package, not needed |
| `browse/` | DROP | the browser-automation product |
| `hydra/` | DROP | multi-agent orchestration product (we have our own intent layer) |
| `headless-runtime/`, `server/` | DROP | headless API server / container runtime |
| `eval/` | DROP | evaluation harness |
| `demo/`, `website/` | DROP | marketing + demo |
| `supabase/` | DROP | cloud auth/sync; casprFlowOS is local-first |
| `skills/` | DROP | TermCanvas-specific skills |
| `docs/` (theirs) | DROP | we write our own |
| `tests/` | TRIM | port only tests for the modules we keep (pty, git-diff, canvas scene, focus) |

## `src/` subdirectories (the renderer)

| Subdir | Verdict | What / why |
|---|---|---|
| `canvas/` | **KEEP** | the core: `XyFlowCanvas`, scene state/projection, focus/zoom/pan, placement, viewport. This is the heart. → `packages/canvas-core` |
| `terminal/` | **KEEP (TRIM)** | pty terminal tiles (`TerminalTile`, `WtermTile`, runtime store, focus scheduler, font loading). Drop: `ActivitySparkline`, telemetry/insights presentation, agent-reflow overlay if it's fluff. → `packages/terminal` |
| `stores/` | **KEEP (SELECTIVE)** | keep `projectStore`, `canvasStore`, `canvasRegistryStore`, `sessionStore`, `selectionStore`, `preferencesStore`, `terminalRuntime*`, `leftPanelRepoStore`. Drop: `agentBubbleStore`, `authStore`, `codexQuotaStore`/`quotaStore`, `hubStore`, `memoryStore`, `pinStore`/`pinDragStore`, `statusDigestStore`, `drawingStore`, `clusterStore`, `handoffDragStore`, `commandPaletteStore` (we build our own command bar), `snapshotHistoryStore` (TRIM). |
| `actions/` | **KEEP (TRIM)** | `terminalSceneActions`, `sceneCardActions`, `sceneSelectionActions`, `sceneDeleteActions`. Drop `annotationSceneActions`, `spatialWaypointActions`. |
| `components/` | **KEEP (SELECTIVE)** | KEEP: `LeftPanel`, `ProjectTree`, `SessionsPanel`, **the entire `RightPanel/` suite — `RightPanel.tsx` + `DiffContent` + `GitContent` + `FilesContent` + `gitContentLayout` + `repoContext`** (the Codex-style project/code panel, kept whole), `ErrorBoundary`, `NotificationToast`, `ComposerBar` (→ becomes the text command bar), `ContextMenu`, `FileEditorDrawer`. DROP: `Hub`, `AgentBubble`, `CommandPalette` (rebuild), `FamilyTreeOverlay`, `PinDrawer`/`PinDetailDrawer`, `SessionReplayView`, `SnapshotHistoryModal` (TRIM), `DiscoveryCue`, `CompletionGlow`, `UsageOverlay`. `RightPanel/MemoryContent` is **TRIM** — keep the tab only if cheap; its `memory-service` backend is dropped, so otherwise drop it. |
| `toolbar/` | **TRIM** | keep a minimal `Toolbar`/`BottomToolbar`; drop `DrawingPanel` and the drawing tool entirely. |
| `hooks/` | **KEEP (TRIM)** | keep `useKeyboardShortcuts` (trim to kept shortcuts); drop pin/usage/hub hooks. |
| `lib/`, `utils/` | **TRIM** | bring only what kept modules import (e.g. `panToTerminal`, `panelAnimation`, font/scroll helpers). Leave usage/telemetry/insights utils. |
| `i18n/` | **DROP** | casprFlowOS is English-only (per the earlier decision). Replace `useT()` calls with plain strings as you port. |
| `pet/` | **DROP** | the desktop pet. Pure fluff. |
| `migration/` | **DROP** | TermCanvas state migrations; we start clean. |
| `projects/` | **KEEP** | `projectCreation` — project/worktree onboarding. |
| `types/` | **TRIM** | port the canvas/terminal/project types the kept code uses; drop pet/insights/pin types. |

## `electron/` (main process)

| Area | Files | Verdict |
|---|---|---|
| **pty / terminals** | `pty-manager`, `pty-launch`, `process-detector`, `render-throttling-coordinator` | **KEEP** → the pty host in `apps/desktop` main |
| **git / files / diff panel** | `git-diff`, `git-info`, `git-paths`, `git-watcher`, `file-tree-watcher`, `file-url`, `fs-copy` | **KEEP** → backs the whole left-rail project/code panel (file tree + diffs + git), not just diffs |
| **agents** | `agent-service`, `agent-shims`, `claude-code-driver`, `cli-launchers`, `cli-registration`, `cli-integration`, `opencode-session`, `composer-submit` | **KEEP (TRIM)** → the "add Claude Code / Codex / other agent" surface; trim to the adapters we support |
| **sessions** | `session-discovery`, `session-list`, `session-scanner`, `session-watcher`, `session-history-events`, `session-search-index`, `session-fork` | **KEEP (TRIM)** → left-rail sessions; drop fork/search-index if unused in v1 |
| **app shell** | `main`, `preload`, `menu`, `window-events`, `state-persistence`, `workspace-save-path`, `reload-shortcut`, `select-all-shortcut`, `search-handlers`, `external-url` | **KEEP (TRIM)** → basis for `apps/desktop` |
| **slash / hooks** | `slash-commands`, `hook-receiver` | **KEEP (TRIM)** if used by the agent terminals |
| **snapshots** | `snapshot-history` | **TRIM** → keep scene persistence, drop history UI |
| **updater** | `auto-updater`, `mac-updater` | **DROP** for now (no release pipeline yet) |
| **auth / cloud** | `auth`, `oauth-callback-server` | **DROP** (local-first) |
| **telemetry / usage / insights** | `telemetry-service`, `usage-collector`, `usage-record-hash`, `usage-sync`, `insights-engine`, `insights-cli`, `insights-report`, `insights-shared`, `codex-quota-fetcher`, `quota-fetcher`, `render-diagnostics` | **DROP** (all of it) |
| **memory** | `memory-service`, `memory-index-generator`, `summary-service` | **DROP** (TRIM `summary-service` back only if the diff rail needs summaries) |
| **pins** | `pin-store`, `pin-dispatch`, `pin-render*`, `pin-instructions`, `pin-project-resolver` | **DROP** (entire pins feature) |
| **hydra** | `hydra-project` | **DROP** |

## From CasprFlow (`../CasprFlow`)

Native Swift — **do not port code**, port **design + assets**:

| Take | As |
|---|---|
| `Assets/logo/*.svg` | already copied → `assets/logo/` |
| `docs/architecture.md`, `docs/latency.md`, `docs/decisions.md` | already copied → `docs/reference/` (design source for the intent layer) |
| Voice HUD UX (`TranscriptHUDView`, `VoiceHUDController`) | **reference only** — rebuild in React per `design-language.md` |
| Capability / FastRouter / Planner / Orchestrator **design** | **reference only** — rebuild in TS in `packages/agents` |
| `LLMClient` config pattern (env → local json → app-support) | reuse the *pattern* for the planner's LLM config |

## Rebrand checklist (Phase 3)

After the core boots, sweep for the old identity:

- `termcanvas` / `TermCanvas` → `casprflowos` / `casprFlowOS` (package names, window title,
  app id, bundle id, user-data dir, IPC channel prefixes, telemetry strings removed).
- App icon + logo → casprFlow logo assets.
- Remove the Chinese locale + `i18n` entirely.
- Update `electron-builder` product name / appId / artifact names.
- Strip any TermCanvas URLs, websites, update feeds, analytics keys.

> Grep targets: `termcanvas`, `TermCanvas`, `blueberrycongee`, `supabase`, `insights`,
> `usage`, `telemetry`, `pet`, `hydra`, `pin`, `i18n`, `useT(`.
