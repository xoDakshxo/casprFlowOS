# @casprflowos/mcp

The MCP connector framework and the in-canvas app surfaces it renders. **Later phase
(Phase 9)** — the seam is reserved now, built then.

## Responsibility
- The `Connector` contract: identity, auth (OAuth/token → keychain), the capabilities it
  contributes to the intent registry, and its **Surface** (the glass app panel).
- Connector registry + lifecycle (install / connect / disconnect / status), surfaced in the
  right-rail "MCP Connectors" section.
- The first reference connector: **Spotify** → a glass player surface bound to the user's
  account ("open spotify").

## Boundaries
- May depend on `@casprflowos/shared` and `@casprflowos/ui`. A connected connector
  **contributes capabilities to the `agents` registry** (so its commands route like any
  other) — it does not special-case the router.
- OAuth + any connector network/secrets run in `apps/desktop` main; tokens go to the
  keychain, **never** the scene/OS store or git.

## Design goal
Adding a connector = its `Connector` data + a `Surface` component. No new plumbing. Keep the
Surface API small and declarative.

See [`../../docs/implementation/phase-9-os-mcp.md`](../../docs/implementation/phase-9-os-mcp.md).
