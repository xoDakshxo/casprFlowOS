import {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { usePanelHoverStore } from "../stores/panelHoverStore";
import { useProjectStore } from "../stores/projectStore";
import { useT } from "../i18n/useT";
import { useNotificationStore } from "../stores/notificationStore";
import { FilesContent } from "./RightPanel/FilesContent";
import { DiffContent } from "./RightPanel/DiffContent";
import { GitContent } from "./RightPanel/GitContent";
import { MemoryContent } from "./RightPanel/MemoryContent";
import { BrowserContent } from "./RightPanel/BrowserContent";
import { panToTerminal } from "../utils/panToTerminal";
import {
  PANEL_TRANSITION_DURATION_MS,
  PANEL_TRANSITION_EASING_FN,
} from "../utils/panelAnimation";
import { useSidebarDragStore } from "../stores/sidebarDragStore";
import { useViewportFocusStore } from "../stores/viewportFocusStore";
import type { RightPanelTab } from "../stores/canvasStore";
import {
  resolveRepoContext,
  type RepoContextOption,
} from "./RightPanel/repoContext";

// ── Tab icon SVGs (14×14, matching the minimal aesthetic) ──

function IconFiles({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1.5h5l3.5 3.5v9.5h-8.5z" />
      <path d="M9 1.5v3.5h3.5" />
    </svg>
  );
}

function IconDiff({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M5 4h6M5 8h6M5 12h6" />
      <circle cx="3" cy="4" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPreview({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5h12v9H2z" />
      <path d="M2 6h12" />
    </svg>
  );
}

function IconGit({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="3.5" r="1.5" />
      <circle cx="5" cy="12.5" r="1.5" />
      <circle cx="11" cy="6.5" r="1.5" />
      <path d="M5 5v6M11 8v-0.5c0-1.5-1-2.5-3-2.5H5" />
    </svg>
  );
}

function IconMemory({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="3.5" />
      <path d="M4 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <circle cx="8" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBrowser({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.8 1.6 2.8 3.7 2.8 6S9.8 12.4 8 14M8 2C6.2 3.6 5.2 5.7 5.2 8S6.2 12.4 8 14" />
    </svg>
  );
}

const TAB_CONFIG: { id: RightPanelTab; icon: typeof IconFiles; labelKey: "left_panel_files" | "left_panel_diff" | "left_panel_git" | "left_panel_memory" | "left_panel_browser" }[] = [
  { id: "files", icon: IconFiles, labelKey: "left_panel_files" },
  { id: "diff", icon: IconDiff, labelKey: "left_panel_diff" },
  { id: "git", icon: IconGit, labelKey: "left_panel_git" },
  { id: "memory", icon: IconMemory, labelKey: "left_panel_memory" },
  { id: "browser", icon: IconBrowser, labelKey: "left_panel_browser" },
];

export function RightPanel() {
  const t = useT();
  const collapsed = useCanvasStore((s) => s.rightPanelCollapsed);
  const width = useCanvasStore((s) => s.rightPanelWidth);
  const activeTab = useCanvasStore((s) => s.rightPanelActiveTab);
  const setCollapsed = useCanvasStore((s) => s.setRightPanelCollapsed);
  const setWidth = useCanvasStore((s) => s.setRightPanelWidth);
  const setActiveTab = useCanvasStore((s) => s.setRightPanelActiveTab);

  // Sliding tab thumb — measured to hug the active tab (see LeftPanel).
  const segTabsRef = useRef<HTMLDivElement>(null);
  const [segThumb, setSegThumb] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = segTabsRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (el) setSegThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab, width]);
  const notify = useNotificationStore((s) => s.notify);

  const focusedWorktreeId = useProjectStore((s) => s.focusedWorktreeId);
  const projects = useProjectStore((s) => s.projects);
  const [hydraEnabling, setHydraEnabling] = useState(false);
  const [directoryIsGitRepo, setDirectoryIsGitRepo] = useState(false);
  const [childRepos, setChildRepos] = useState<RepoContextOption[]>([]);
  const [selectedChildRepoPath, setSelectedChildRepoPath] = useState<string | null>(null);
  const [repoContextReadyPath, setRepoContextReadyPath] = useState<string | null>(null);
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const preferredRepoPathRef = useRef<Map<string, string>>(new Map());
  const repoContextCacheRef = useRef<
    Map<
      string,
      {
        childRepos: RepoContextOption[];
        directoryIsGitRepo: boolean;
        selectedRepoPath: string | null;
      }
    >
  >(new Map());
  const repoMenuRef = useRef<HTMLDivElement>(null);

  // When the panel collapses or expands, re-centre the focused
  // terminal in the canvas. Use the same duration / easing as the
  // panel width transition so the viewport pan stays in lockstep
  // with the CSS-animated panel + canvas edges.
  const prevCollapsedRef = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsedRef.current === collapsed) return;
    prevCollapsedRef.current = collapsed;
    const tid = projects
      .flatMap((p) => p.worktrees)
      .flatMap((w) => w.terminals)
      .find((t) => t.focused)?.id;
    if (tid) {
      panToTerminal(tid, {
        duration: PANEL_TRANSITION_DURATION_MS,
        easing: PANEL_TRANSITION_EASING_FN,
      });
    }
  }, [collapsed, projects]);

  const focusedProject = useMemo(() => {
    if (!focusedWorktreeId) return null;
    for (const p of projects) {
      const wt = p.worktrees.find((w) => w.id === focusedWorktreeId);
      if (wt) return p;
    }
    return null;
  }, [focusedWorktreeId, projects]);

  const worktreePath = useMemo(() => {
    if (!focusedWorktreeId) return null;
    for (const p of projects) {
      const wt = p.worktrees.find((w) => w.id === focusedWorktreeId);
      if (wt) return wt.path;
    }
    return null;
  }, [focusedWorktreeId, projects]);

  // Keep the last active worktree path so the left panel stays populated
  const lastWorktreePathRef = useRef<string | null>(null);
  if (worktreePath) {
    lastWorktreePathRef.current = worktreePath;
  }
  const effectiveWorktreePath = worktreePath ?? lastWorktreePathRef.current;
  const repoScopedTabs = activeTab === "diff" || activeTab === "git" || activeTab === "memory";

  useEffect(() => {
    if (!effectiveWorktreePath || !window.casprFlowOS) {
      setDirectoryIsGitRepo(false);
      setChildRepos([]);
      setSelectedChildRepoPath(null);
      setRepoContextReadyPath(null);
      return;
    }

    let cancelled = false;
    const preferredRepoPath =
      preferredRepoPathRef.current.get(effectiveWorktreePath) ?? null;
    const cached = repoContextCacheRef.current.get(effectiveWorktreePath);

    if (cached) {
      setDirectoryIsGitRepo(cached.directoryIsGitRepo);
      setChildRepos(cached.childRepos);
      setSelectedChildRepoPath(cached.selectedRepoPath);
      setRepoContextReadyPath(effectiveWorktreePath);
    } else {
      setDirectoryIsGitRepo(false);
      setChildRepos([]);
      setSelectedChildRepoPath(null);
      setRepoContextReadyPath(null);
    }

    Promise.all([
      window.casprFlowOS.git.isRepo(effectiveWorktreePath),
      window.casprFlowOS.project.listChildGitRepos(effectiveWorktreePath),
    ])
      .then(([isGitRepo, repos]) => {
        if (cancelled) return;
        setDirectoryIsGitRepo(isGitRepo);
        setChildRepos(repos);

        const resolution = resolveRepoContext({
          childRepos: repos,
          directoryIsGitRepo: isGitRepo,
          directoryPath: effectiveWorktreePath,
          preferredRepoPath,
        });
        setSelectedChildRepoPath(resolution.selectedRepoPath);
        repoContextCacheRef.current.set(effectiveWorktreePath, {
          childRepos: repos,
          directoryIsGitRepo: isGitRepo,
          selectedRepoPath: resolution.selectedRepoPath,
        });
        setRepoContextReadyPath(effectiveWorktreePath);
      })
      .catch(() => {
        if (cancelled) return;
        setDirectoryIsGitRepo(false);
        setChildRepos([]);
        setSelectedChildRepoPath(null);
        repoContextCacheRef.current.set(effectiveWorktreePath, {
          childRepos: [],
          directoryIsGitRepo: false,
          selectedRepoPath: null,
        });
        setRepoContextReadyPath(effectiveWorktreePath);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveWorktreePath]);

  const repoContext = useMemo(
    () =>
      resolveRepoContext({
        childRepos,
        directoryIsGitRepo,
        directoryPath: effectiveWorktreePath,
        preferredRepoPath: selectedChildRepoPath,
      }),
    [childRepos, directoryIsGitRepo, effectiveWorktreePath, selectedChildRepoPath],
  );
  const repoContextPath = repoScopedTabs
    ? repoContext.targetPath
    : effectiveWorktreePath;
  const repoContextResolved =
    !repoScopedTabs ||
    !effectiveWorktreePath ||
    repoContextReadyPath === effectiveWorktreePath;
  const showRepoContextPlaceholder = repoScopedTabs && !repoContextResolved;

  const handleSelectChildRepo = useCallback(
    (repoPath: string) => {
      if (!effectiveWorktreePath) return;
      preferredRepoPathRef.current.set(effectiveWorktreePath, repoPath);
      repoContextCacheRef.current.set(effectiveWorktreePath, {
        childRepos,
        directoryIsGitRepo,
        selectedRepoPath: repoPath,
      });
      setSelectedChildRepoPath(repoPath);
      setRepoMenuOpen(false);
    },
    [childRepos, directoryIsGitRepo, effectiveWorktreePath],
  );

  useEffect(() => {
    if (!repoMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (repoMenuRef.current?.contains(event.target as Node)) return;
      setRepoMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRepoMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [repoMenuOpen]);

  useEffect(() => {
    if (repoContext.selectorKind !== "dropdown") {
      setRepoMenuOpen(false);
    }
  }, [repoContext.selectorKind]);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget as HTMLElement;
      const pid = e.pointerId;
      handle.setPointerCapture(pid);
      const startX = e.clientX;
      const origW = width;
      useSidebarDragStore.getState().setActive(true);
      const handleMove = (ev: PointerEvent) => {
        // Handle lives on the LEFT edge of the right panel, so dragging
        // the cursor RIGHT (clientX increases) SHRINKS the panel and
        // dragging LEFT GROWS it — inverse of the left panel.
        // Cap relative to the window (leave ~320px for the left rail + a sliver
        // of canvas) instead of a hard 600px, so the panel — and the Browser
        // tab inside it — can expand much wider.
        const maxW = Math.max(400, window.innerWidth - 320);
        setWidth(Math.max(259, Math.min(maxW, origW - (ev.clientX - startX))));
      };
      const cleanup = () => {
        handle.removeEventListener("pointermove", handleMove);
        handle.removeEventListener("pointerup", cleanup);
        handle.removeEventListener("pointercancel", cleanup);
        handle.removeEventListener("lostpointercapture", cleanup);
        try { handle.releasePointerCapture(pid); } catch {}
        useSidebarDragStore.getState().setActive(false);
        const tid = useProjectStore.getState().projects
          .flatMap((p) => p.worktrees)
          .flatMap((w) => w.terminals)
          .find((t) => t.focused)?.id;
        if (tid) {
          // Only re-fit the viewport when we're in zoom-focus mode. In plain
          // (panned) focus mode the user has explicitly broken away from
          // fit-scale, so a sidebar resize must not yank them back into a
          // forced zoom.
          const inZoomFocus =
            useViewportFocusStore.getState().zoomedOutTerminalId === null;
          panToTerminal(tid, {
            immediate: true,
            preserveScale: !inZoomFocus,
          });
        }
      };
      handle.addEventListener("pointermove", handleMove);
      handle.addEventListener("pointerup", cleanup);
      handle.addEventListener("pointercancel", cleanup);
      handle.addEventListener("lostpointercapture", cleanup);
    },
    [width, setWidth]
  );

  const openFileEditor = useCanvasStore((s) => s.openFileEditor);

  const handleFileClick = useCallback(
    (filePath: string) => {
      // Files now open in the full-canvas FileEditorDrawer (Monaco),
      // not a preview tab. Keeps readable width and makes save/edit
      // first-class.
      openFileEditor(filePath);
    },
    [openFileEditor]
  );

  const handleEnableHydra = useCallback(async () => {
    if (!focusedProject) {
      notify("warn", t.hydra_enable_missing_target);
      return;
    }

    setHydraEnabling(true);
    try {
      const result = await window.casprFlowOS.project.enableHydra(focusedProject.path);
      if (!result.ok) {
        notify("error", t.hydra_enable_failed(result.error));
        return;
      }

      notify(
        "info",
        result.changed
          ? t.hydra_enable_success(focusedProject.name)
          : t.hydra_enable_already_current(focusedProject.name),
      );
    } catch (error) {
      notify("error", t.hydra_enable_failed(String(error)));
    } finally {
      setHydraEnabling(false);
    }
  }, [focusedProject, notify, t]);

  const dragging = useSidebarDragStore((s) => s.active);
  // Animate the outer width on expand/collapse; pause the transition
  // while the resize handle drags so width tracks the pointer 1:1.
  // The inner surface is conditionally rendered — only one of the
  // two states is ever in the DOM, so there are no persistent
  // compositor layers that can get stuck unpainted after a
  // foreground/background switch.
  // pinned = clicked open (insets canvas, glass bg). preview = hover overlay
  // (floats over the canvas, opaque bg, auto-closes). Visible when either.
  const pinned = !collapsed;
  const preview = usePanelHoverStore((s) => s.rightPreview);
  const openPreview = usePanelHoverStore((s) => s.openPreview);
  const closePreviewSoon = usePanelHoverStore((s) => s.closePreviewSoon);
  const visible = pinned || preview;
  const isOverlay = preview && !pinned;
  const displayedWidth = visible ? width : 0;
  const widthTransition = dragging
    ? undefined
    : "width 240ms cubic-bezier(0.22, 0.61, 0.36, 1)";

  return (
    <>
    <div
      className="caspr-rail caspr-rail--right fixed right-0 z-40 overflow-hidden"
      data-overlay={isOverlay ? "true" : undefined}
      style={{
        top: 44,
        height: "calc(100vh - 44px)",
        width: displayedWidth,
        transition: widthTransition,
      }}
      onMouseEnter={() => openPreview("right")}
      onMouseLeave={() => closePreviewSoon("right")}
      onDragOver={(e) => {
        if (pinned) return;
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setActiveTab("files");
        setCollapsed(false);
      }}
    >
      {/* Expanded surface — always mounted (preserves FilesContent's tree
          model, scroll, ignored-stream cache across open/close) and laid out at
          the user-configured width so content does not reflow while the outer
          width animates; the outer overflow-hidden clips it during the slide. */}
      <div style={{ display: "contents" }}>
        <div
          className="absolute inset-y-0 right-0 flex flex-col"
          style={{ width }}
        >
      <div className="shrink-0 px-2 pt-2 pb-2">
        <div className="caspr-seg">
          <div className="caspr-seg-tabs" ref={segTabsRef}>
            <div
              className="caspr-seg-thumb"
              style={{
                width: segThumb.width,
                transform: `translateX(${segThumb.left}px)`,
                opacity: segThumb.width ? 1 : 0,
                // Track the panel instantly while resizing; keep the springy
                // slide for tab switches.
                transition: dragging ? "none" : undefined,
              }}
            />
            {TAB_CONFIG.map(({ id, icon: Icon, labelKey }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  className="caspr-seg-tab"
                  data-active={isActive}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={13} />
                  {width > 260 && <span>{t[labelKey]}</span>}
                </button>
              );
            })}
          </div>
          <button
            className="cf-row-icon flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] ml-0.5 shrink-0"
            onClick={() => setCollapsed(true)}
            title={t.right_panel_collapse}
          >
            {/* Points RIGHT — clicking collapses the right panel rightward. */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {repoScopedTabs && repoContext.selectorKind !== "none" && (
          <div className="shrink-0 px-2 pb-2">
            <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
              <div className="cf-eyebrow cf-mono">
                {t.left_panel_repo}
              </div>
              {repoContext.selectorKind === "single" ? (
                <div
                  className="cf-meta cf-mono mt-2 truncate rounded-md border border-[var(--border)] px-2.5 py-1.5"
                  style={{ color: "var(--text-primary)" }}
                  title={childRepos[0]?.name}
                >
                  {childRepos[0]?.name}
                </div>
              ) : repoContext.selectorKind === "inline" ? (
                <div className="mt-2 flex items-center gap-1 rounded-md bg-[var(--surface)] p-1">
                  {childRepos.map((repo) => {
                    const isActive = repo.path === repoContext.targetPath;
                    return (
                      <button
                        key={repo.path}
                        className={`cf-row-icon cf-meta cf-mono min-w-0 flex-1 rounded-md px-2.5 py-1.5 ${
                          isActive
                            ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                        onClick={() => handleSelectChildRepo(repo.path)}
                        title={repo.name}
                      >
                        <span className="block truncate">{repo.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="relative mt-2" ref={repoMenuRef}>
                  <button
                    className="cf-row-icon cf-meta cf-mono flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--text-primary)" }}
                    onClick={() => setRepoMenuOpen((open) => !open)}
                    aria-label={t.left_panel_repo}
                    aria-haspopup="menu"
                    aria-expanded={repoMenuOpen}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {childRepos.find((repo) => repo.path === repoContext.targetPath)?.name}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      className={`shrink-0 text-[var(--text-faint)] ${
                        repoMenuOpen ? "rotate-180" : ""
                      }`}
                      style={{
                        transition:
                          "transform var(--duration-quick) var(--ease-out-soft)",
                      }}
                    >
                      <path
                        d="M2.2 3.5L5 6.3L7.8 3.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {repoMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                      {childRepos.map((repo) => {
                        const isActive = repo.path === repoContext.targetPath;
                        return (
                          <button
                            key={repo.path}
                            className={`cf-row-icon cf-meta cf-mono flex w-full items-center gap-2 px-2.5 py-1.5 text-left ${
                              isActive
                                ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                            }`}
                            onClick={() => handleSelectChildRepo(repo.path)}
                            title={repo.name}
                          >
                            <span className="min-w-0 flex-1 truncate">{repo.name}</span>
                            <span
                              className={`shrink-0 text-[10px] ${
                                isActive ? "text-[var(--accent)]" : "text-transparent"
                              }`}
                            >
                              ●
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Always-mounted so the file tree's model state, expansion, scroll
            position and ignored stream survive Git/Diff tab toggles. The
            store-backed watcher keeps this in sync even while hidden, so
            switching back is instant rather than a fresh load. */}
        <div style={{ display: activeTab === "files" ? "contents" : "none" }}>
          <FilesContent
            worktreePath={effectiveWorktreePath}
            onFileClick={handleFileClick}
          />
        </div>
        {/* Browser stays mounted so the page survives tab switches; scoped to
            the active worktree (like the other tabs). */}
        <div
          className="min-h-0 flex-1"
          style={{ display: activeTab === "browser" ? "flex" : "none" }}
        >
          <BrowserContent worktreePath={effectiveWorktreePath} />
        </div>
        {showRepoContextPlaceholder ? (
          <div className="flex flex-1 items-center justify-center">
            <div
              className="h-4 w-4 animate-pulse rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
              title={t.loading}
            />
          </div>
        ) : (
          <>
            {activeTab === "diff" && <DiffContent worktreePath={repoContextPath} />}
            {activeTab === "git" && (
              <GitContent
                worktreePath={repoContextPath}
                onEnableHydra={focusedProject ? handleEnableHydra : undefined}
                hydraEnabling={hydraEnabling}
              />
            )}
            {activeTab === "memory" && (
              <MemoryContent worktreePath={repoContextPath} onFileClick={handleFileClick} />
            )}
          </>
        )}
      </div>

      <div
        className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize group/resize"
        onPointerDown={handleResizeStart}
      >
        <div
          className="absolute left-0 top-0 w-px h-full bg-[var(--border)] group-hover/resize:bg-[var(--accent)] group-hover/resize:opacity-70"
          style={{
            transition:
              "background-color var(--duration-quick) var(--ease-out-soft), opacity var(--duration-quick) var(--ease-out-soft)",
          }}
        />
      </div>
        </div>
      </div>
    </div>
    </>
  );
}
