import {
  pickWindowPlacement,
  type CanvasProject,
  type CanvasWindow,
} from "@casprflowos/canvas-core";
import {
  createId,
  type CanvasPoint,
  type CanvasWindowStatus,
  type Id,
} from "@casprflowos/shared";
import { GlassPill } from "@casprflowos/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiffView } from "./DiffView";
import { TerminalTile, type TerminalTileModel, type TerminalWriter } from "./TerminalTile";
import type { FileTreeNode, GitDiff, GitStatus, ProjectInfo } from "../electron/preload";
import logoUrl from "../../../assets/logo/logo-white.svg";

type WorkPanelTab = "files" | "diff" | "git";

interface SelectedFile {
  readonly projectPath: string;
  readonly relativePath: string;
  readonly content: string;
}

const CALLSIGNS = [
  "Orion",
  "Vega",
  "Nova",
  "Lyra",
  "Atlas",
  "Draco",
  "Rigel",
  "Cassia",
  "Halcyon",
  "Zephyr",
] as const;

const DEFAULT_TILE_SIZE = { width: 560, height: 360 } as const;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.8;

const asProjectId = (id: string): Id<"project"> => id as Id<"project">;
const asWorktreeId = (id: string): Id<"worktree"> => id as Id<"worktree">;

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const allocateCallsign = (windows: readonly TerminalTileModel[]): string => {
  const live = new Set(windows.map((entry) => entry.callsign));
  return CALLSIGNS.find((name) => !live.has(name)) ?? `Agent ${windows.length + 1}`;
};

const toCanvasProjects = (
  projects: readonly ProjectInfo[],
  windows: readonly TerminalTileModel[],
): readonly CanvasProject[] =>
  projects.map((project) => ({
    id: asProjectId(project.id),
    name: project.name,
    path: project.path,
    worktrees: project.worktrees.map((worktree) => ({
      id: asWorktreeId(worktree.id),
      name: worktree.name,
      path: worktree.path,
      isPrimary: worktree.isPrimary,
      windows: windows
        .filter(
          (entry) =>
            entry.projectName === project.name && entry.worktreeName === worktree.name,
        )
        .map<CanvasWindow>((entry) => ({
          id: entry.windowId,
          callsign: entry.callsign,
          agentLabel: entry.agentLabel,
          projectId: asProjectId(project.id),
          worktreeId: asWorktreeId(worktree.id),
          position: entry.position,
          size: entry.size,
          focused: entry.focused,
          minimized: false,
          stashed: false,
          status: entry.status,
        })),
    })),
  }));

export const App = () => {
  const [projects, setProjects] = useState<readonly ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeWorktreeId, setActiveWorktreeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkPanelTab>("files");
  const [fileTrees, setFileTrees] = useState<Record<string, FileTreeNode | null>>({});
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus | null>>({});
  const [gitDiffs, setGitDiffs] = useState<Record<string, GitDiff | null>>({});
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [terminalWindows, setTerminalWindows] = useState<readonly TerminalTileModel[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [statusLine, setStatusLine] = useState("Add a project to begin.");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const canvasSurfaceRef = useRef<HTMLDivElement | null>(null);

  const projectsRef = useRef(projects);
  const termWritersRef = useRef(new Map<string, TerminalWriter>());
  const termBuffersRef = useRef(new Map<string, string>());
  const panRef = useRef<{ pointerId: number; x: number; y: number; vx: number; vy: number } | null>(
    null,
  );

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );
  const activeWorktree = useMemo(
    () => activeProject?.worktrees.find((worktree) => worktree.id === activeWorktreeId) ?? null,
    [activeProject, activeWorktreeId],
  );

  const refreshProject = useCallback(async (project: ProjectInfo) => {
    try {
      const [tree, status, diff] = await Promise.all([
        window.casprFlowOS.workspace.readTree(project.path),
        window.casprFlowOS.git.status(project.path),
        window.casprFlowOS.git.diff(project.path),
      ]);
      setFileTrees((current) => ({ ...current, [project.path]: tree }));
      setGitStatuses((current) => ({ ...current, [project.path]: status }));
      setGitDiffs((current) => ({ ...current, [project.path]: diff }));
    } catch (error) {
      setStatusLine(`Refresh failed: ${toErrorMessage(error)}`);
    }
  }, []);

  // Route pty output to the right xterm writer; buffer until the tile mounts.
  const registerWriter = useCallback((ptyId: string, writer: TerminalWriter) => {
    termWritersRef.current.set(ptyId, writer);
    const buffered = termBuffersRef.current.get(ptyId);
    if (buffered) {
      writer(buffered);
      termBuffersRef.current.delete(ptyId);
    }
    return () => {
      termWritersRef.current.delete(ptyId);
    };
  }, []);

  useEffect(() => {
    const offData = window.casprFlowOS.terminal.onData((event) => {
      const writer = termWritersRef.current.get(event.id);
      if (writer) {
        writer(event.data);
      } else {
        termBuffersRef.current.set(
          event.id,
          `${termBuffersRef.current.get(event.id) ?? ""}${event.data}`,
        );
      }
    });
    const offExit = window.casprFlowOS.terminal.onExit((event) => {
      const nextStatus: CanvasWindowStatus = event.exitCode === 0 ? "done" : "error";
      setTerminalWindows((current) =>
        current.map((entry) =>
          entry.ptyId === event.id ? { ...entry, status: nextStatus } : entry,
        ),
      );
    });
    return () => {
      offData();
      offExit();
    };
  }, []);

  useEffect(
    () =>
      window.casprFlowOS.repo.onChanged((event) => {
        const project = projectsRef.current.find((entry) => entry.path === event.repoPath);
        if (project) {
          void refreshProject(project);
        }
      }),
    [refreshProject],
  );

  const addProject = async (): Promise<void> => {
    const directoryPath = await window.casprFlowOS.project.selectDirectory();
    if (!directoryPath) {
      return;
    }
    try {
      const project = await window.casprFlowOS.project.scan(directoryPath);
      setProjects((current) =>
        current.some((entry) => entry.id === project.id) ? current : [...current, project],
      );
      setActiveProjectId(project.id);
      setActiveWorktreeId(project.worktrees[0]?.id ?? null);
      await window.casprFlowOS.repo.watch(project.path);
      await refreshProject(project);
      setStatusLine(`Added ${project.name}.`);
    } catch (error) {
      setStatusLine(`Project add failed: ${toErrorMessage(error)}`);
    }
  };

  const selectProject = (project: ProjectInfo): void => {
    setActiveProjectId(project.id);
    setActiveWorktreeId(project.worktrees[0]?.id ?? null);
    void refreshProject(project);
  };

  const readFile = async (project: ProjectInfo, node: FileTreeNode): Promise<void> => {
    if (node.type !== "file") {
      return;
    }
    try {
      const content = await window.casprFlowOS.workspace.readFile(project.path, node.relativePath);
      setSelectedFile({ projectPath: project.path, relativePath: node.relativePath, content });
    } catch (error) {
      setStatusLine(`File read failed: ${toErrorMessage(error)}`);
    }
  };

  const spawnTerminal = async (): Promise<void> => {
    if (!activeProject || !activeWorktree) {
      setStatusLine("Add a project and select a worktree first.");
      return;
    }
    try {
      const terminal = await window.casprFlowOS.terminal.create({
        cwd: activeWorktree.path,
        cols: 80,
        rows: 24,
      });
      const placement = pickWindowPlacement({
        projects: toCanvasProjects(projects, terminalWindows),
        projectId: asProjectId(activeProject.id),
        worktreeId: asWorktreeId(activeWorktree.id),
        size: { ...DEFAULT_TILE_SIZE },
        viewportRect: {
          x: -viewport.x / viewport.zoom,
          y: -viewport.y / viewport.zoom,
          width: 1100 / viewport.zoom,
          height: 720 / viewport.zoom,
        },
      });
      const callsign = allocateCallsign(terminalWindows);
      setTerminalWindows((current) => [
        ...current.map((entry) => ({ ...entry, focused: false })),
        {
          windowId: createId("window", terminal.id),
          ptyId: terminal.id,
          callsign,
          agentLabel: "Shell",
          projectName: activeProject.name,
          worktreeName: activeWorktree.name,
          position: placement.position,
          size: { ...DEFAULT_TILE_SIZE },
          focused: true,
          status: "running",
        },
      ]);
      setStatusLine(`Spawned ${callsign} in ${activeWorktree.name}.`);
    } catch (error) {
      setStatusLine(`Terminal spawn failed: ${toErrorMessage(error)}`);
    }
  };

  const focusTerminal = useCallback((windowId: Id<"window">): void => {
    setTerminalWindows((current) =>
      current.map((entry) => ({ ...entry, focused: entry.windowId === windowId })),
    );
  }, []);

  const moveTerminal = useCallback((windowId: Id<"window">, position: CanvasPoint): void => {
    setTerminalWindows((current) =>
      current.map((entry) => (entry.windowId === windowId ? { ...entry, position } : entry)),
    );
  }, []);

  const closeTerminal = useCallback((model: TerminalTileModel): void => {
    void window.casprFlowOS.terminal.kill(model.ptyId);
    setTerminalWindows((current) => current.filter((entry) => entry.windowId !== model.windowId));
  }, []);

  // Trackpad two-finger pan + pinch-zoom on the canvas (native non-passive
  // listener so pinch can preventDefault the browser page-zoom).
  useEffect(() => {
    const surface = canvasSurfaceRef.current;
    if (!surface) {
      return;
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;

      if (event.ctrlKey) {
        // pinch → zoom toward the cursor
        setViewport((current) => {
          const nextZoom = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, current.zoom * (1 - event.deltaY * 0.01)),
          );
          const worldX = (cx - current.x) / current.zoom;
          const worldY = (cy - current.y) / current.zoom;
          return { zoom: nextZoom, x: cx - worldX * nextZoom, y: cy - worldY * nextZoom };
        });
        return;
      }
      // two-finger scroll → pan
      setViewport((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, []);

  const onPanStart = (event: React.PointerEvent<HTMLDivElement>): void => {
    // Tiles stopPropagation on their own pointerdown, so any event that reaches
    // here is on empty canvas → start a pan.
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      vx: viewport.x,
      vy: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPanMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) {
      return;
    }
    setViewport((current) => ({
      ...current,
      x: pan.vx + event.clientX - pan.x,
      y: pan.vy + event.clientY - pan.y,
    }));
  };
  const onPanEnd = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
  };
  const zoomBy = (delta: number): void =>
    setViewport((current) => ({
      ...current,
      zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.zoom + delta)),
    }));

  const activeTree = activeProject ? fileTrees[activeProject.path] : null;
  const activeStatus = activeProject ? gitStatuses[activeProject.path] : null;
  const activeDiff = activeProject ? gitDiffs[activeProject.path] : null;

  const gridTemplateColumns = `${
    leftCollapsed ? "0px" : "var(--work-rail-w)"
  } minmax(0, 1fr) ${rightCollapsed ? "0px" : "var(--os-rail-w)"}`;

  return (
    <div className="app-shell" style={{ gridTemplateColumns }}>
      <header className="titlebar">
        <div className="titlebar-brand">
          <img src={logoUrl} className="titlebar-logo" alt="" aria-hidden="true" />
          <span>casprFlowOS</span>
        </div>
        <div className="titlebar-spacer" />
        <div className="titlebar-actions">
          <button
            type="button"
            className={leftCollapsed ? "rail-toggle" : "rail-toggle is-active"}
            aria-label="Toggle work sidebar"
            aria-pressed={!leftCollapsed}
            onClick={() => setLeftCollapsed((value) => !value)}
          >
            <SidebarIcon side="left" />
          </button>
          <button
            type="button"
            className={rightCollapsed ? "rail-toggle" : "rail-toggle is-active"}
            aria-label="Toggle OS sidebar"
            aria-pressed={!rightCollapsed}
            onClick={() => setRightCollapsed((value) => !value)}
          >
            <SidebarIcon side="right" />
          </button>
        </div>
      </header>

      {leftCollapsed ? null : (
      <aside className="work-rail glass" aria-label="Work">
        <button className="primary-action" type="button" onClick={() => void addProject()}>
          Add project
        </button>

        <section className="rail-section" aria-label="Projects">
          <h2 className="rail-heading">Projects</h2>
          {projects.length === 0 ? (
            <p className="muted-copy">No project added yet.</p>
          ) : (
            <div className="rail-list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={project.id === activeProjectId ? "rail-row is-active" : "rail-row"}
                  onClick={() => selectProject(project)}
                >
                  <span className="rail-row-title">{project.name}</span>
                  <small className="rail-row-sub">{project.path}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        {activeProject ? (
          <section className="rail-section" aria-label="Worktrees">
            <h2 className="rail-heading">Worktrees</h2>
            <div className="rail-list">
              {activeProject.worktrees.map((worktree) => (
                <button
                  key={worktree.id}
                  type="button"
                  className={
                    worktree.id === activeWorktreeId ? "rail-row is-active" : "rail-row"
                  }
                  onClick={() => setActiveWorktreeId(worktree.id)}
                >
                  <span className="rail-row-title">{worktree.name}</span>
                  <small className="rail-row-sub">
                    {worktree.isPrimary ? "primary" : worktree.name}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rail-section work-panel" aria-label="Code panel">
          <div className="tab-list" role="tablist">
            {(["files", "diff", "git"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "tab is-active" : "tab"}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="panel-body">
            {activeTab === "files" ? (
              activeProject && activeTree ? (
                <>
                  <FileTreeView
                    node={activeTree}
                    project={activeProject}
                    selectedPath={selectedFile?.relativePath ?? null}
                    onSelectFile={readFile}
                  />
                  {selectedFile ? (
                    <section className="file-editor" aria-label="File">
                      <header>{selectedFile.relativePath}</header>
                      <pre>{selectedFile.content}</pre>
                    </section>
                  ) : null}
                </>
              ) : (
                <p className="muted-copy">Add a project to browse files.</p>
              )
            ) : null}

            {activeTab === "diff" ? (
              activeDiff ? (
                <DiffView stat={activeDiff.stat} patch={activeDiff.patch} />
              ) : (
                <p className="muted-copy">Select a project to see its diff.</p>
              )
            ) : null}

            {activeTab === "git" ? <GitStatusView status={activeStatus} /> : null}
          </div>
        </section>
      </aside>
      )}

      <section className="canvas-shell" aria-label="Agent canvas">
        <GlassPill className="canvas-toolbar">
          <button type="button" onClick={() => void spawnTerminal()}>
            New terminal
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">
            –
          </button>
          <span className="toolbar-zoom">{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(0.1)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}>
            Reset
          </button>
        </GlassPill>

        <div
          ref={canvasSurfaceRef}
          className="canvas-surface"
          onPointerDown={onPanStart}
          onPointerMove={onPanMove}
          onPointerUp={onPanEnd}
        >
          <div
            className="canvas-world"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            }}
          >
            {terminalWindows.map((model) => (
              <TerminalTile
                key={model.windowId}
                model={model}
                zoom={viewport.zoom}
                onFocus={focusTerminal}
                onClose={closeTerminal}
                onDragMove={moveTerminal}
                registerWriter={registerWriter}
              />
            ))}
          </div>

          {terminalWindows.length === 0 ? (
            <div className="empty-canvas">
              <img src={logoUrl} alt="" aria-hidden="true" />
              <h2>{activeProject ? "Spawn an agent" : "Add a project"}</h2>
              <p>
                {activeProject
                  ? "Open a terminal tile and drag it anywhere on the canvas."
                  : "Add a repository to populate worktrees, files, git, and agents."}
              </p>
            </div>
          ) : null}
        </div>

        <GlassPill className="status-pill" aria-live="polite">
          {statusLine}
        </GlassPill>
      </section>

      {rightCollapsed ? null : (
        <aside className="os-rail glass" aria-label="OS">
          <OsSection title="Automations" hint="Saved command sequences and triggers." />
          <OsSection title="Skills" hint="Reusable agent instruction presets." />
          <OsSection title="Connectors" hint="MCP apps — Spotify, and more." />
          <OsSection title="Profiles" hint="Theme, hotkey, model, and defaults." />
        </aside>
      )}
    </div>
  );
};

const SidebarIcon = ({ side }: { readonly side: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect
      x="1.5"
      y="2.5"
      width="13"
      height="11"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <line
      x1={side === "left" ? "6" : "10"}
      y1="2.5"
      x2={side === "left" ? "6" : "10"}
      y2="13.5"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);

const OsSection = ({ title, hint }: { readonly title: string; readonly hint: string }) => (
  <section className="rail-section" aria-label={title}>
    <h2 className="rail-heading">{title}</h2>
    <p className="muted-copy">{hint}</p>
  </section>
);

interface FileTreeViewProps {
  readonly node: FileTreeNode;
  readonly project: ProjectInfo;
  readonly selectedPath: string | null;
  readonly onSelectFile: (project: ProjectInfo, node: FileTreeNode) => Promise<void>;
}

const FileTreeView = ({ node, project, selectedPath, onSelectFile }: FileTreeViewProps) => {
  if (node.type === "file") {
    return (
      <button
        type="button"
        className={node.relativePath === selectedPath ? "file-node is-active" : "file-node"}
        onClick={() => void onSelectFile(project, node)}
      >
        {node.name}
      </button>
    );
  }

  return (
    <div className="tree-group">
      {node.relativePath ? <span className="tree-directory">{node.name}</span> : null}
      <div className="tree-children">
        {node.children?.map((child) => (
          <FileTreeView
            key={child.relativePath || child.name}
            node={child}
            project={project}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
};

const GitStatusView = ({ status }: { readonly status: GitStatus | null | undefined }) => {
  if (!status) {
    return <p className="muted-copy">No project selected.</p>;
  }
  if (!status.isRepo) {
    return <p className="muted-copy">Selected project is not a git repository.</p>;
  }
  return (
    <div className="git-status">
      <p className="git-branch">
        Branch <strong>{status.branch ?? "unknown"}</strong>
      </p>
      {status.entries.length === 0 ? (
        <p className="muted-copy">Working tree clean.</p>
      ) : (
        <ul className="git-entries">
          {status.entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
