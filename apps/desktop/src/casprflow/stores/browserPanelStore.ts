import { create } from "zustand";

/**
 * Per-worktree state for the right-panel Browser tab. Each worktree remembers
 * its own URL (the address that's loaded / being typed), so switching the
 * focused terminal/worktree swaps the browser to that repo's page — the same
 * worktree-scoped model the Files/Diff/Git/Memory tabs use.
 */
const DEFAULT_KEY = "__default__";

export function browserKey(worktreePath: string | null): string {
  return worktreePath ?? DEFAULT_KEY;
}

interface BrowserPanelStore {
  urlByWorktree: Record<string, string>;
  getUrl: (worktreePath: string | null) => string;
  setUrl: (worktreePath: string | null, url: string) => void;
}

export const useBrowserPanelStore = create<BrowserPanelStore>((set, get) => ({
  urlByWorktree: {},
  getUrl: (worktreePath) => get().urlByWorktree[browserKey(worktreePath)] ?? "",
  // Always commits — falls back to a default key when there's no active
  // worktree, so the browser works even before a project/agent is focused.
  setUrl: (worktreePath, url) => {
    set((state) => ({
      urlByWorktree: {
        ...state.urlByWorktree,
        [browserKey(worktreePath)]: url,
      },
    }));
  },
}));
