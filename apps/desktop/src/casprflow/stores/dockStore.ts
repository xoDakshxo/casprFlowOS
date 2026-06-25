import { create } from "zustand";
import type { TerminalType } from "../types";

/**
 * Which apps are pinned to the AgentDock. Persisted to localStorage so the
 * user's dock survives restarts. Pinned from the App Launcher.
 */
const STORAGE_KEY = "casprflowos.dock.pinned";
const DEFAULT_PINNED: TerminalType[] = ["claude", "codex", "gemini", "shell"];

function load(): TerminalType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TerminalType[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore — fall back to defaults
  }
  return DEFAULT_PINNED;
}

function persist(pinned: TerminalType[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // ignore — non-fatal
  }
}

interface DockStore {
  pinned: TerminalType[];
  togglePinned: (type: TerminalType) => void;
}

export const useDockStore = create<DockStore>((set) => ({
  pinned: load(),
  togglePinned: (type) =>
    set((s) => {
      const next = s.pinned.includes(type)
        ? s.pinned.filter((t) => t !== type)
        : [...s.pinned, type];
      persist(next);
      return { pinned: next };
    }),
}));
