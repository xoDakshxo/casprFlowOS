# Vision — casprFlowOS

## One sentence

casprFlowOS is an **agentic operating system**: you open it and you are already inside a
living canvas of AI coding agents working on your project, and you command that canvas the
way you'd command a person — by **speaking** or **typing**, not by hunting through menus.

## The feeling we're building

You sit down. The app is already open to the **agent canvas for your favourite project** —
no project picker, no empty state, no setup. Several terminals float on an infinite dark
canvas, each one a named agent (Claude Code, Codex, …) with a sci-fi callsign so you can
refer to it out loud. A left rail shows your projects, worktrees, live sessions, and a
running **diff** of what the agents are changing. A right rail is the **OS** — your
automations, skills, MCP connectors, and profiles.

You hold `Option+Space`. A glass pill rises from the bottom of the screen. You say:

> "Focus Orion and tell it to fix the failing auth test."

Orion's terminal smoothly takes center stage; the command streams into it; a line appears
in the HUD telling you what just happened. You let go of the key and keep working. You
never touched the mouse.

That is the whole product: **a canvas of agents you run by voice or text, that feels less
like an app and more like an operating system for getting work done with agents.**

## Why this, why now

- Coding agents are good enough to run many at once — but **managing** many is the new
  bottleneck. Tabs and split panes don't scale to ten agents.
- A **spatial canvas** scales: agents have a place, you build a mental map, you glance
  instead of alt-tab.
- **Voice + text** beats clicking for orchestration verbs ("focus X", "spawn 3 agents on
  Y", "show me the diff for Z") — they're short, frequent, and spatial.
- We already have the two halves proven separately: TermCanvas proved the canvas;
  CasprFlow proved the voice dispatcher. casprFlowOS fuses them.

## Pillars

1. **Agent-first canvas.** The default surface is agents on a canvas, not a blank editor.
   Opens straight to your favourite project. Adding an agent (Claude Code / Codex / other)
   is one voice command or one click.
2. **Voice or text, never menus.** Every action the canvas can do is reachable through the
   intent layer. `Option+Space` to speak; a command bar to type. The HUD always tells you
   what it did.
3. **Two rails frame the canvas.**
   - **Left rail** — the *work*: projects, worktrees, sessions, plus the **entire
     Codex-style project & code panel kept whole from TermCanvas** — the project/file
     structure tree, the live diffs, git status, and the file editor. Not a reduced
     diff-only view: the full panel and all its parts.
   - **Right rail** — the *OS*: projects, automations, skills, MCP connectors, profiles.
4. **MCP apps as first-class surfaces.** Connect a connector (e.g. Spotify) and "open
   spotify" renders a beautiful in-canvas surface bound to your account. Connectors are a
   later phase, but the architecture reserves the seam now.
5. **Calm, dark, glass.** A quiet dark plane with hints of glass / gradient-glass for
   panes and rails. Terminals are translucent. The canvas background is themeable, not a
   fixed dotted grid. See [`design-language.md`](design-language.md).
6. **Latency is a feature.** Inherited from CasprFlow: the common voice command path is
   deterministic and never waits on the network. The planner LLM is only for the long
   tail. See [`reference/casprflow-latency.md`](reference/casprflow-latency.md).

## What we keep vs. cut (high level)

**Keep (bare-bones infra):** the infinite canvas, terminal tiles, window focus/zoom/pan,
the left work sidebar with projects + sessions + the **whole TermCanvas project/code panel**
(file-structure tree, diffs, git status, file editor), and the git/file watching that feeds
it.

**Cut (fluff):** the desktop pet, usage heatmaps/insights dashboards, telemetry, the
hydra/headless-runtime/eval/browse/website/demo subtrees, Supabase auth/cloud sync,
session-replay extras, and every feature that isn't "agents on a canvas you command."

The precise file-level manifest is [`extraction-map.md`](extraction-map.md).

## North-star scenarios

1. **Open to work.** Launch → favourite project's agent canvas is already there, agents
   named, diff rail live. Zero clicks to context.
2. **Voice orchestration.** "Focus Vega." "Spawn two Codex agents on casprflowos for the
   theme system and the MCP layer." "Show me Nova's diff." Each resolves instantly.
3. **Text orchestration.** Same verbs typed into the command bar for quiet rooms / precise
   strings (paths, branch names).
4. **MCP surface (later).** "Open Spotify" → a glass player panel bound to your account,
   living on the right rail. Same pattern for other connectors.

## Non-goals (for now)

- Not a general computer-use agent driving arbitrary GUI apps (CasprFlow's tier-3 vision
  path is explicitly out of scope for v1 of casprFlowOS).
- Not a cloud product. Local-first; no account required to use the canvas.
- Not a TermCanvas superset — we are **subtracting** to a clean core, then growing in a
  new direction.
