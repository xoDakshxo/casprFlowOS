# Window Naming — Callsigns

Every terminal/agent window gets a stable, memorable **callsign** so you can target it by
voice ("focus Orion") or text without ambiguity. This is a load-bearing feature of the
voice layer, not decoration — `focus_window`, `close_window`, `open_diff`, and
`run_in_terminal` all resolve against the callsign.

## Rules

1. **Assigned on creation**, never reused while a window is alive; stable for the window's
   lifetime (survives canvas reload via the scene document).
2. **One word, easy to say, phonetically distinct.** Avoid names that sound alike in the
   same canvas (don't put *Vega* and *Vesta* on screen together — the allocator skips
   near-homophones of currently-live callsigns).
3. **Shown everywhere the window is referenced:** on the tile header, in the left rail
   session list, and in the HUD readout.
4. **Fuzzy-matched** in the router: case-insensitive, tolerant of minor mis-hearings
   (Whisper may return "Orion" as "oryan"). Resolve to the closest live callsign; if two
   are too close, `ask_user` to disambiguate.
5. **User-overridable.** A user can rename a window ("rename Orion to Backend"); the custom
   name becomes the callsign and the allocator won't reissue the freed sci-fi name until
   it's released.

## Name pool (sci-fi / celestial)

Curated for distinct phonetics. Allocator draws in shuffled order, skipping any that
collide phonetically with live callsigns. Keep this list in `packages/shared` as data.

```
Orion   Vega    Nova    Lyra    Atlas   Draco   Rigel   Cassia
Halcyon Zephyr  Onyx    Cygnus  Pollux  Sirius  Altair  Mirach
Echo    Helix   Aria    Polaris Maia    Triton  Caspian Aurelia
Kestrel Nyx     Calyx   Vesper  Tycho   Indra   Solace  Quill
```

> Tip: prefer two-syllable, hard-consonant names for voice — they survive noisy mics
> better than soft multi-syllable ones.

## Allocation contract

```ts
interface CallsignAllocator {
  /** issue a fresh callsign distinct (phonetically) from all live ones */
  allocate(live: string[]): string;
  /** return a callsign to the pool when a window closes */
  release(name: string): void;
  /** apply a user rename; frees the old, reserves the new */
  rename(windowId: string, name: string): void;
  /** resolve a (possibly mis-heard) spoken token to a live windowId */
  resolve(spoken: string, live: WindowSummary[]): Resolution;
}

type Resolution =
  | { kind: "match"; windowId: string }
  | { kind: "ambiguous"; candidates: string[] }   // → ask_user
  | { kind: "none" };
```

## Display

- Tile header: `◗ Orion` + agent badge (Claude Code / Codex / …) + status dot.
- Left rail: callsign as the primary label, project/worktree as secondary.
- HUD readout: always names the callsign it acted on ("Focused Orion").
