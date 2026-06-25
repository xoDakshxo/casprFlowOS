import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAppLauncherStore } from "../stores/appLauncherStore";
import { useDockStore } from "../stores/dockStore";
import { useProjectStore } from "../stores/projectStore";
import { ALL_AGENTS, AgentGlyph, spawnAgent } from "./agentIcons";

/*
 * App Launcher — a Cmd-P-style modal for spawning agents (and, later, apps).
 * Mirrors the command palette's scrim + card + search + list shell. Opened from
 * the dock's drawer button.
 */

const MONO = { fontFamily: '"Geist Mono", monospace' } as const;

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconPin({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 1.5h4l-.6 3.2 1.9 2.1H4.7l1.9-2.1L6 1.5Z M8 7v6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function AppLauncher() {
  const open = useAppLauncherStore((s) => s.open);
  const close = useAppLauncherStore((s) => s.closeLauncher);
  const hasProject = useProjectStore((s) => s.projects.length > 0);
  const pinned = useDockStore((s) => s.pinned);
  const togglePinned = useDockStore((s) => s.togglePinned);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_AGENTS;
    return ALL_AGENTS.filter((a) =>
      `${a.label} ${a.description} ${a.type}`.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const choose = (index: number) => {
    const agent = results[index];
    if (!agent) return;
    if (spawnAgent(agent.type)) close();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(selected);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: "var(--scrim)" }}
      onClick={(e) => {
        if (e.target === backdropRef.current) close();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="cf-enter-fade-up w-full max-w-xl mx-4 overflow-hidden rounded-lg border shadow-2xl"
        style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2.5 border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents & apps…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none"
            style={MONO}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd
            className="shrink-0 rounded border px-1.5 py-0.5 text-[10px]"
            style={{ ...MONO, borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            ESC
          </kbd>
        </div>

        {/* List */}
        <div className="max-h-[55vh] overflow-auto py-1">
          {results.length === 0 ? (
            <div
              className="px-4 py-10 text-center text-[12px]"
              style={{ ...MONO, color: "var(--text-faint)" }}
            >
              No matches
            </div>
          ) : (
            results.map((agent, i) => {
              const isSelected = i === selected;
              const isPinned = pinned.includes(agent.type);
              return (
                <div
                  key={agent.type}
                  className="flex w-full items-center gap-1 pr-2"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--surface-hover)"
                      : "transparent",
                  }}
                  onMouseMove={() => setSelected(i)}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                    onClick={() => choose(i)}
                  >
                    <span style={{ width: 30, height: 30, flex: "none" }}>
                      <AgentGlyph type={agent.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--text-primary)]">
                        {agent.label}
                      </span>
                      <span
                        className="block truncate text-[11px] text-[var(--text-muted)]"
                        style={MONO}
                      >
                        {agent.description}
                      </span>
                    </span>
                  </button>
                  <button
                    className="shrink-0 grid h-7 w-7 place-items-center rounded-md"
                    title={isPinned ? "Unpin from dock" : "Pin to dock"}
                    aria-label={isPinned ? "Unpin from dock" : "Pin to dock"}
                    aria-pressed={isPinned}
                    style={{
                      color: isPinned ? "var(--accent)" : "var(--text-faint)",
                      backgroundColor: isPinned
                        ? "var(--accent-soft)"
                        : "transparent",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinned(agent.type);
                    }}
                  >
                    <IconPin filled={isPinned} />
                  </button>
                  <button
                    className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--accent-soft)"
                        : "var(--surface)",
                      color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                    onClick={() => choose(i)}
                  >
                    Add
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-3 py-2 text-[10px]"
          style={{ ...MONO, borderColor: "var(--border)", color: "var(--text-faint)" }}
        >
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border px-1 py-0.5" style={{ borderColor: "var(--border)" }}>
                ↵
              </kbd>
              <span className="ml-1">Add</span>
            </span>
            <span>
              <kbd className="rounded border px-1 py-0.5" style={{ borderColor: "var(--border)" }}>
                ↑↓
              </kbd>
              <span className="ml-1">Navigate</span>
            </span>
          </div>
          <span>
            {hasProject ? `${results.length} apps` : "Open a project to add agents"}
          </span>
        </div>
      </div>
    </div>
  );
}
