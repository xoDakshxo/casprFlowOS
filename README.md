<div align="center">

<img src="assets/logo/logo-white.svg" width="96" alt="casprFlowOS logo" />

# casprFlowOS

**An agentic OS. An infinite canvas of AI coding agents — driven by voice and text.**

</div>

---

casprFlowOS opens straight into a living **agent canvas** for your favourite project:
multiple terminals — each running Claude Code, Codex, or another agent — arranged on an
infinite spatial canvas. A **left rail** gives you projects, worktrees, sessions, and a
live diff view (Codex-style). A **right rail** is the OS surface: projects, automations,
skills, MCP connectors, and profiles. You drive the whole thing **hands-free with voice**
(hold `Option+Space`, speak, watch the HUD) **or by typing** into a command bar.

> Built by extracting the genuinely-good parts of two prior projects:
> the canvas + terminal + diff substrate from **TermCanvas**, and the voice-dispatch
> design + logo/animations from **CasprFlow**. Nothing else came along for the ride.

## What it is (and is not)

- **Is:** a calm, dark, glass-surfaced shell around a canvas of agent terminals you
  command by voice or text. Every TermCanvas action (focus a window, spawn an agent,
  open a diff, pan/zoom) is reachable through the intent layer.
- **Is not:** a fork of TermCanvas with the logo swapped. We keep the bare-bones
  infra and delete the fluff. See [`docs/extraction-map.md`](docs/extraction-map.md).

## Repo layout

```
casprFlowOS/
├─ apps/
│  └─ desktop/          # the Electron app shell (main + preload + renderer host)
├─ packages/
│  ├─ canvas-core/      # infinite canvas, scene state, window placement/focus
│  ├─ terminal/         # pty terminal tiles (xterm/wterm), transparent surfaces
│  ├─ voice/            # global hotkey, voice HUD, on-device Whisper STT
│  ├─ agents/           # intent router + capability registry (voice/text → actions)
│  ├─ ui/               # glass design system (tokens, primitives, panes, rails)
│  ├─ mcp/              # MCP connector framework + app surfaces (Spotify, etc.)
│  └─ shared/           # cross-cutting types, ids, result shapes, logging
├─ assets/
│  ├─ logo/             # casprFlow logo (loading/white/black)
│  └─ themes/           # canvas theme presets
└─ docs/                # vision, architecture, design language, phased plan
```

## Start here (docs)

| Doc | What it covers |
|---|---|
| [`docs/vision.md`](docs/vision.md) | The product — what we're building and why |
| [`docs/architecture.md`](docs/architecture.md) | System layers, the voice/text → action pipeline |
| [`docs/design-language.md`](docs/design-language.md) | Dark + glass visual system, transparent terminals, canvas themes |
| [`docs/voice-and-intent.md`](docs/voice-and-intent.md) | Voice HUD UX + the capability/intent model |
| [`docs/window-naming.md`](docs/window-naming.md) | Sci-fi window callsigns for voice targeting |
| [`docs/extraction-map.md`](docs/extraction-map.md) | Exactly what to take from TermCanvas, and what to delete |
| [`docs/clean-code.md`](docs/clean-code.md) | Code guidelines this repo holds itself to |
| [`docs/implementation/`](docs/implementation/) | The phase-by-phase build queue (cleanup → rebrand → features) |

## Status

Scaffold + plan. Implementation is executed **phase by phase** per
[`docs/implementation/README.md`](docs/implementation/README.md). Phase 0 wires the
empty monorepo to a booting Electron window; phase 1 ports the canvas/terminal/diff core.

## Build (once phase 0 lands)

```sh
pnpm install
pnpm dev            # boots the Electron shell
```
