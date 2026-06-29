import { create } from "zustand";
import type { AppId } from "../types";

/**
 * Which apps are pinned to the AgentDock. Persisted to localStorage so the
 * user's dock survives restarts. Pinned from the App Launcher.
 */
const STORAGE_KEY = "casprflowos.dock.pinned";
const DEFAULT_PINNED: AppId[] = ["claude", "codex", "gemini", "shell", "browser"];

function load(): AppId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppId[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore — fall back to defaults
  }
  return DEFAULT_PINNED;
}

function persist(pinned: AppId[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // ignore — non-fatal
  }
}

interface DockStore {
  pinned: AppId[];
  togglePinned: (type: AppId) => void;
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
