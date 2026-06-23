# Reference — source material (do not edit)

These are **historical design documents copied from CasprFlow**, kept as the source of the
intent-layer design. casprFlowOS rebuilds these ideas in TypeScript (CasprFlow itself is
native Swift). Read them for the *why*; don't treat them as casprFlowOS's own decisions
where they conflict (e.g. CasprFlow D1 mandates native Swift — casprFlowOS deliberately
chose Electron/TS; see [`../architecture.md`](../architecture.md)).

| File | Use it for |
|---|---|
| `casprflow-architecture.md` | The capability model + FastRouter→Planner→Orchestrator + three execution tiers. Port the *design*. |
| `casprflow-latency.md` | The latency contract: zero-network common path, prewarming, speculation. Non-negotiable, carried over verbatim in spirit. |
| `casprflow-decisions.md` | Locked choices (never-auto-send, programmatic-first, universal-by-design). Carry the principles; ignore the native-stack mandate. |

> Do **not** rebrand or rewrite these files — they're a snapshot. casprFlowOS's own
> architecture and decisions live one level up in `docs/`.
