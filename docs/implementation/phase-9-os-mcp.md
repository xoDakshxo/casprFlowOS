# Phase 9 — OS surfaces & MCP connectors

**Goal:** make the right rail a real OS — automations, skills, profiles — and add the **MCP
connector framework** with the first beautiful app surface ("open spotify" → a glass player
bound to your account).

**Why here:** with canvas + agents + voice/text working, expand the "OS" surface. MCP is
explicitly a later phase per the vision; the seam was reserved in Phases 4/6.

## Tasks

### MCP connector framework → `packages/mcp`
- [ ] Define a `Connector` contract: identity, auth (OAuth/token, stored in keychain),
      capabilities it exposes, and a **surface** (the in-canvas UI it renders).
      ```ts
      interface Connector {
        id: string;                 // "spotify"
        label: string;
        connect(): Promise<Session>;        // OAuth/token → keychain
        disconnect(): Promise<void>;
        capabilities(): Capability[];        // contributed to the registry
        Surface: React.FC<{ session: Session }>;   // the glass app panel
      }
      ```
- [ ] **Registry + lifecycle.** Right-rail "MCP Connectors" section: install, connect,
      disconnect, status. A connected connector **contributes capabilities** to the intent
      registry (so "open spotify", "play X" route like any other command) and registers its
      surface.
- [ ] **Spotify reference connector.** OAuth to the user's account; an `open_connector`
      ("open spotify") opens a **glass player surface** (album art behind glass, transport
      controls, now-playing) docked on the right rail or floated on the canvas. Playback
      control capabilities (play/pause/next/search) where the API allows.
- [ ] Generalize so a second connector is mostly data + a Surface component, not new
      plumbing (prove the pattern even if only Spotify ships).

### OS objects (wire the Phase 4 stubs)
- [ ] **Automations.** Saved capability sequences with a trigger (manual, hotkey, or
      schedule). Run = feed the sequence through the Orchestrator. Edit in the right rail.
- [ ] **Skills.** Reusable agent instruction snippets attachable when spawning an agent (a
      Codex/Claude prompt preset). Selectable in the add-agent flow.
- [ ] **Profiles.** Consolidate preferences: theme, terminal opacity, hotkey binding, LLM
      model/keys, default agent, favourite project. Per-workspace overrides.

## Where

`packages/mcp` (framework + Spotify), `packages/agents` (connector-contributed
capabilities + `open_connector`), `packages/ui` (connector surfaces, OS section editors),
`apps/desktop` (OAuth flow, keychain, any connector network in main), right rail (Phase 4).

## Exit criterion

- Connect the Spotify connector via OAuth; say or type "open spotify" → a glass player
  surface bound to your account appears; basic transport works.
- Automations/Skills/Profiles are functional (create, edit, run/apply, persist).
- Adding a hypothetical second connector requires only its `Connector` data + a Surface —
  no changes to the framework.

## Watch-outs

- **Secrets to keychain, never the scene/OS store or git.** OAuth handled in main.
- Connector capabilities flow through the **same** registry — keep the single-source-of-
  truth rule; don't special-case connector commands in the router.
- Keep the Surface API small and declarative so connectors stay "data + a component."
- Respect "never auto-send": connector actions with outward effects are `confirm`.
- This phase is broad — split into MCP-framework, Spotify, and each OS-object as separate
  sub-efforts; don't try to land it in one PR.
