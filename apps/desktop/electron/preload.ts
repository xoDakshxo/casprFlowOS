import { contextBridge, ipcRenderer, webUtils } from "electron";

export interface WorktreeInfo {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly isPrimary: boolean;
}

export interface ProjectInfo {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly worktrees: readonly WorktreeInfo[];
}

export interface FileTreeNode {
  readonly name: string;
  readonly relativePath: string;
  readonly type: "directory" | "file";
  readonly children?: readonly FileTreeNode[];
}

export interface GitStatus {
  readonly isRepo: boolean;
  readonly branch: string | null;
  readonly entries: readonly string[];
  readonly raw: string;
}

export interface GitDiff {
  readonly stat: string;
  readonly patch: string;
}

export interface TerminalCreateInput {
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalCreateResult {
  readonly id: string;
}

export interface TerminalDataEvent {
  readonly id: string;
  readonly data: string;
}

export interface TerminalExitEvent {
  readonly id: string;
  readonly exitCode: number;
  readonly signal?: number;
}

export interface RepoChangedEvent {
  readonly repoPath: string;
}

export type Unsubscribe = () => void;

export interface CasprFlowOSApi {
  readonly project: {
    readonly selectDirectory: () => Promise<string | null>;
    readonly scan: (directoryPath: string) => Promise<ProjectInfo>;
  };
  readonly workspace: {
    readonly readTree: (rootPath: string) => Promise<FileTreeNode>;
    readonly readFile: (rootPath: string, relativePath: string) => Promise<string>;
  };
  readonly git: {
    readonly status: (repoPath: string) => Promise<GitStatus>;
    readonly diff: (repoPath: string) => Promise<GitDiff>;
  };
  readonly repo: {
    readonly watch: (repoPath: string) => Promise<string>;
    readonly unwatch: (watchId: string) => Promise<void>;
    readonly onChanged: (listener: (event: RepoChangedEvent) => void) => Unsubscribe;
  };
  readonly terminal: {
    readonly create: (input: TerminalCreateInput) => Promise<TerminalCreateResult>;
    readonly write: (id: string, data: string) => Promise<void>;
    readonly resize: (id: string, cols: number, rows: number) => Promise<void>;
    readonly kill: (id: string) => Promise<void>;
    readonly onData: (listener: (event: TerminalDataEvent) => void) => Unsubscribe;
    readonly onExit: (listener: (event: TerminalExitEvent) => void) => Unsubscribe;
  };
}

const api: CasprFlowOSApi = Object.freeze({
  project: {
    selectDirectory: () =>
      ipcRenderer.invoke("project:selectDirectory") as Promise<string | null>,
    scan: (directoryPath: string) =>
      ipcRenderer.invoke("project:scan", directoryPath) as Promise<ProjectInfo>,
  },
  workspace: {
    readTree: (rootPath: string) =>
      ipcRenderer.invoke("workspace:readTree", rootPath) as Promise<FileTreeNode>,
    readFile: (rootPath: string, relativePath: string) =>
      ipcRenderer.invoke("workspace:readFile", rootPath, relativePath) as Promise<string>,
  },
  git: {
    status: (repoPath: string) =>
      ipcRenderer.invoke("git:status", repoPath) as Promise<GitStatus>,
    diff: (repoPath: string) => ipcRenderer.invoke("git:diff", repoPath) as Promise<GitDiff>,
  },
  repo: {
    watch: (repoPath: string) => ipcRenderer.invoke("repo:watch", repoPath) as Promise<string>,
    unwatch: (watchId: string) => ipcRenderer.invoke("repo:unwatch", watchId) as Promise<void>,
    onChanged: (listener: (event: RepoChangedEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: RepoChangedEvent): void => {
        listener(payload);
      };
      ipcRenderer.on("repo:changed", handler);
      return () => ipcRenderer.off("repo:changed", handler);
    },
  },
  terminal: {
    create: (input: TerminalCreateInput) =>
      ipcRenderer.invoke("terminal:create", input) as Promise<TerminalCreateResult>,
    write: (id: string, data: string) =>
      ipcRenderer.invoke("terminal:write", id, data) as Promise<void>,
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", id, cols, rows) as Promise<void>,
    kill: (id: string) => ipcRenderer.invoke("terminal:kill", id) as Promise<void>,
    onData: (listener: (event: TerminalDataEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent): void => {
        listener(payload);
      };
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.off("terminal:data", handler);
    },
    onExit: (listener: (event: TerminalExitEvent) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: TerminalExitEvent | number,
      ): void => {
        if (typeof payload === "object" && payload !== null && "id" in payload) {
          listener(payload);
        }
      };
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.off("terminal:exit", handler);
    },
  },
});

const platform =
  process.platform === "win32" ? "win32" : process.platform === "linux" ? "linux" : "darwin";

const noopUnsubscribe = (): void => undefined;

const casprFlowOSBridge = Object.freeze({
  terminal: {
    create: (options: {
      cwd: string;
      shell?: string;
      args?: string[];
      terminalId?: string;
      terminalType?: string;
      theme?: "dark" | "light";
    }) => ipcRenderer.invoke("terminal:create", options) as Promise<number>,
    destroy: (ptyId: number) => ipcRenderer.invoke("terminal:destroy", ptyId) as Promise<void>,
    getPid: (ptyId: number) =>
      ipcRenderer.invoke("terminal:get-pid", ptyId) as Promise<number | null>,
    input: (ptyId: number, data: string) => {
      void ipcRenderer.invoke("terminal:input", ptyId, data);
    },
    resize: (ptyId: number, cols: number, rows: number) => {
      void ipcRenderer.invoke("terminal:resize", ptyId, cols, rows);
    },
    notifyThemeChanged: (ptyId: number) => {
      void ipcRenderer.invoke("terminal:notify-theme-changed", ptyId);
    },
    onOutput: (callback: (ptyId: number, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, ptyId: number, data: string): void => {
        callback(ptyId, data);
      };
      ipcRenderer.on("terminal:output", handler);
      return () => ipcRenderer.off("terminal:output", handler);
    },
    onExit: (callback: (ptyId: number, exitCode: number) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        ptyId: number,
        exitCode: number,
      ): void => {
        if (typeof ptyId === "number") {
          callback(ptyId, exitCode);
        }
      };
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.off("terminal:exit", handler);
    },
    detectCli: (ptyId: number) =>
      ipcRenderer.invoke("terminal:detect-cli", ptyId) as Promise<null>,
  },
  session: {
    getCodexLatest: () => Promise.resolve(null),
    findCodex: () => Promise.resolve(null),
    findClaude: () => Promise.resolve(null),
    findWuu: () => Promise.resolve(null),
    getPermissionMode: () => Promise.resolve(null),
    getBypassState: () => Promise.resolve(false),
    getClaudeByPid: () => Promise.resolve(null),
    findKimi: () => Promise.resolve(null),
    findOpenCode: () => Promise.resolve(null),
    watch: () => Promise.resolve({ ok: false, reason: "Sessions are not available yet." }),
    unwatch: () => Promise.resolve(),
    onTurnComplete: () => noopUnsubscribe,
  },
  telemetry: {
    attachSession: () => Promise.resolve({ ok: false, sessionFile: null }),
    detachSession: () => Promise.resolve(),
    updateTerminal: () =>
      Promise.resolve({
        terminalId: "",
        provider: "unknown",
        cwd: "",
        sessionId: null,
        shellPid: null,
        ptyId: null,
        attachedAt: null,
        lastSeenAt: null,
        metrics: null,
      }),
    getTerminal: () => Promise.resolve(null),
    getWorkflow: () => Promise.resolve(null),
    listEvents: () => Promise.resolve({ events: [], nextCursor: null }),
    onSnapshotChanged: () => noopUnsubscribe,
  },
  diagnostics: {
    recordRenderEvent: () => Promise.resolve(),
    getRenderLogInfo: () => Promise.resolve({ path: null, exists: false, sizeBytes: 0 }),
  },
  lifecycle: {
    onVisible: () => noopUnsubscribe,
  },
  project: {
    selectDirectory: () =>
      ipcRenderer.invoke("project:select-directory") as Promise<string | null>,
    scan: (dirPath: string) => ipcRenderer.invoke("project:scan", dirPath),
    listChildGitRepos: (dirPath: string) =>
      ipcRenderer.invoke("project:list-child-git-repos", dirPath),
    rescanWorktrees: (dirPath: string) => ipcRenderer.invoke("project:rescan-worktrees", dirPath),
    createWorktree: (repoPath: string, branch: string) =>
      ipcRenderer.invoke("project:create-worktree", repoPath, branch),
    removeWorktree: (repoPath: string, worktreePath: string, force?: boolean) =>
      ipcRenderer.invoke("project:remove-worktree", repoPath, worktreePath, force),
    deleteFolder: (projectPath: string) =>
      ipcRenderer.invoke("project:delete-folder", projectPath),
    enableHydra: (dirPath: string) => ipcRenderer.invoke("project:enable-hydra", dirPath),
    checkHydra: (dirPath: string) => ipcRenderer.invoke("project:check-hydra", dirPath),
    diff: (worktreePath: string) => ipcRenderer.invoke("project:diff", worktreePath),
  },
  git: {
    watch: (worktreePath: string) =>
      ipcRenderer.invoke("git:watch", worktreePath) as Promise<void>,
    unwatch: (worktreePath: string) =>
      ipcRenderer.invoke("git:unwatch", worktreePath) as Promise<void>,
    branches: (worktreePath: string) => ipcRenderer.invoke("git:branches", worktreePath),
    log: (worktreePath: string, count = 200) =>
      ipcRenderer.invoke("git:log", worktreePath, count),
    isRepo: (dirPath: string) => ipcRenderer.invoke("git:is-repo", dirPath) as Promise<boolean>,
    commitDetail: (worktreePath: string, hash: string) =>
      ipcRenderer.invoke("git:commit-detail", worktreePath, hash),
    checkout: (worktreePath: string, ref: string) =>
      ipcRenderer.invoke("git:checkout", worktreePath, ref),
    init: (worktreePath: string) => ipcRenderer.invoke("git:init", worktreePath),
    status: (worktreePath: string) => ipcRenderer.invoke("git:status", worktreePath),
    stage: (worktreePath: string, paths: string[]) =>
      ipcRenderer.invoke("git:stage", worktreePath, paths),
    unstage: (worktreePath: string, paths: string[]) =>
      ipcRenderer.invoke("git:unstage", worktreePath, paths),
    discard: (worktreePath: string, trackedPaths: string[], untrackedPaths: string[]) =>
      ipcRenderer.invoke("git:discard", worktreePath, trackedPaths, untrackedPaths),
    commit: (worktreePath: string, message: string) =>
      ipcRenderer.invoke("git:commit", worktreePath, message),
    push: (worktreePath: string) => ipcRenderer.invoke("git:push", worktreePath),
    pull: (worktreePath: string) => ipcRenderer.invoke("git:pull", worktreePath),
    amend: (worktreePath: string, message: string) =>
      ipcRenderer.invoke("git:amend", worktreePath, message),
    fetch: (worktreePath: string, remote?: string) =>
      ipcRenderer.invoke("git:fetch", worktreePath, remote),
    stashList: (worktreePath: string) => ipcRenderer.invoke("git:stash-list", worktreePath),
    stashCreate: (worktreePath: string, message: string, includeUntracked: boolean) =>
      ipcRenderer.invoke("git:stash-create", worktreePath, message, includeUntracked),
    stashApply: (worktreePath: string, index: number) =>
      ipcRenderer.invoke("git:stash-apply", worktreePath, index),
    stashPop: (worktreePath: string, index: number) =>
      ipcRenderer.invoke("git:stash-pop", worktreePath, index),
    stashDrop: (worktreePath: string, index: number) =>
      ipcRenderer.invoke("git:stash-drop", worktreePath, index),
    branchCreate: (worktreePath: string, name: string, startPoint?: string) =>
      ipcRenderer.invoke("git:branch-create", worktreePath, name, startPoint),
    branchDelete: (worktreePath: string, name: string, force: boolean) =>
      ipcRenderer.invoke("git:branch-delete", worktreePath, name, force),
    branchRename: (worktreePath: string, oldName: string, newName: string) =>
      ipcRenderer.invoke("git:branch-rename", worktreePath, oldName, newName),
    tagList: (worktreePath: string) => ipcRenderer.invoke("git:tag-list", worktreePath),
    tagCreate: (worktreePath: string, name: string, ref: string, message?: string) =>
      ipcRenderer.invoke("git:tag-create", worktreePath, name, ref, message),
    tagDelete: (worktreePath: string, name: string) =>
      ipcRenderer.invoke("git:tag-delete", worktreePath, name),
    remoteList: (worktreePath: string) => ipcRenderer.invoke("git:remote-list", worktreePath),
    remoteAdd: (worktreePath: string, name: string, url: string) =>
      ipcRenderer.invoke("git:remote-add", worktreePath, name, url),
    remoteRemove: (worktreePath: string, name: string) =>
      ipcRenderer.invoke("git:remote-remove", worktreePath, name),
    remoteRename: (worktreePath: string, oldName: string, newName: string) =>
      ipcRenderer.invoke("git:remote-rename", worktreePath, oldName, newName),
    merge: (worktreePath: string, ref: string) =>
      ipcRenderer.invoke("git:merge", worktreePath, ref),
    mergeAbort: (worktreePath: string) => ipcRenderer.invoke("git:merge-abort", worktreePath),
    rebase: (worktreePath: string, ref: string) =>
      ipcRenderer.invoke("git:rebase", worktreePath, ref),
    rebaseAbort: (worktreePath: string) => ipcRenderer.invoke("git:rebase-abort", worktreePath),
    rebaseContinue: (worktreePath: string) =>
      ipcRenderer.invoke("git:rebase-continue", worktreePath),
    cherryPick: (worktreePath: string, hash: string) =>
      ipcRenderer.invoke("git:cherry-pick", worktreePath, hash),
    cherryPickAbort: (worktreePath: string) =>
      ipcRenderer.invoke("git:cherry-pick-abort", worktreePath),
    mergeState: (worktreePath: string) => ipcRenderer.invoke("git:merge-state", worktreePath),
    fileDiff: (worktreePath: string, filePath: string, staged: boolean) =>
      ipcRenderer.invoke("git:file-diff", worktreePath, filePath, staged),
    stageHunk: (worktreePath: string, filePath: string, hunkHeader: string) =>
      ipcRenderer.invoke("git:stage-hunk", worktreePath, filePath, hunkHeader),
    unstageHunk: (worktreePath: string, filePath: string, hunkHeader: string) =>
      ipcRenderer.invoke("git:unstage-hunk", worktreePath, filePath, hunkHeader),
    blame: (worktreePath: string, filePath: string) =>
      ipcRenderer.invoke("git:blame", worktreePath, filePath),
    onChanged: (callback: (worktreePath: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, worktreePath: string): void =>
        callback(worktreePath);
      ipcRenderer.on("git:changed", handler);
      return () => ipcRenderer.off("git:changed", handler);
    },
    onLogChanged: (callback: (worktreePath: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, worktreePath: string): void =>
        callback(worktreePath);
      ipcRenderer.on("git:log-changed", handler);
      return () => ipcRenderer.off("git:log-changed", handler);
    },
    onPresenceChanged: (
      callback: (worktreePath: string, payload: { isGitRepo: boolean }) => void,
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        worktreePath: string,
        payload: { isGitRepo: boolean },
      ): void => callback(worktreePath, payload);
      ipcRenderer.on("git:presence-changed", handler);
      return () => ipcRenderer.off("git:presence-changed", handler);
    },
  },
  fs: {
    listDir: (dirPath: string) => ipcRenderer.invoke("fs:list-dir", dirPath),
    listAllFiles: (dirPath: string) => ipcRenderer.invoke("fs:list-all-files", dirPath),
    listIgnoredFiles: (dirPath: string) => ipcRenderer.invoke("fs:list-ignored-files", dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke("fs:read-file", filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke("fs:write-file", filePath, content),
    copy: (sources: string[], destDir: string) => ipcRenderer.invoke("fs:copy", sources, destDir),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    rename: (oldPath: string, newName: string) =>
      ipcRenderer.invoke("fs:rename", oldPath, newName),
    move: (oldPath: string, newPath: string) => ipcRenderer.invoke("fs:move", oldPath, newPath),
    delete: (targetPath: string) => ipcRenderer.invoke("fs:delete", targetPath),
    mkdir: (dirPath: string, name: string) => ipcRenderer.invoke("fs:mkdir", dirPath, name),
    createFile: (dirPath: string, name: string) =>
      ipcRenderer.invoke("fs:create-file", dirPath, name),
    reveal: (targetPath: string) => ipcRenderer.invoke("fs:reveal", targetPath),
    watchDir: (dirPath: string) => ipcRenderer.invoke("fs:watch-dir", dirPath),
    unwatchDir: (dirPath: string) => ipcRenderer.invoke("fs:unwatch-dir", dirPath),
    unwatchAllDirs: () => ipcRenderer.invoke("fs:unwatch-all-dirs"),
    onDirChanged: (callback: (dirPath: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, dirPath: string): void =>
        callback(dirPath);
      ipcRenderer.on("fs:dir-changed", handler);
      return () => ipcRenderer.off("fs:dir-changed", handler);
    },
  },
  memory: {
    scan: (worktreePath: string) => ipcRenderer.invoke("memory:scan", worktreePath),
    watch: (worktreePath: string) => ipcRenderer.invoke("memory:watch", worktreePath),
    unwatch: (worktreePath: string) => ipcRenderer.invoke("memory:unwatch", worktreePath),
    onChanged: () => noopUnsubscribe,
  },
  app: {
    homePath: "",
    platform,
    requestClose: () => window.close(),
    setQuitOnLastWindowClosed: () => undefined,
  },
  hooks: {
    getSocketPath: () => Promise.resolve(null),
    getHealth: () =>
      Promise.resolve({ socketPath: null, lastEventAt: null, eventsReceived: 0, parseErrors: 0 }),
    onSessionStarted: () => noopUnsubscribe,
    onTurnComplete: () => noopUnsubscribe,
    onStopFailure: () => noopUnsubscribe,
  },
  sessions: {
    onListChanged: () => noopUnsubscribe,
    onHistoryChanged: () => noopUnsubscribe,
    loadReplay: (filePath: string) => ipcRenderer.invoke("sessions:load-replay", filePath),
    forkSession: (
      sourceFilePath: string,
      turnIndex: number,
      targetProvider?: "claude" | "codex",
    ) => ipcRenderer.invoke("sessions:fork-session", sourceFilePath, turnIndex, targetProvider),
  },
  pins: {
    list: (repo: string) => ipcRenderer.invoke("pins:list", repo),
    create: (input: unknown) => ipcRenderer.invoke("pins:create", input),
    update: (repo: string, id: string, patch: unknown) =>
      ipcRenderer.invoke("pins:update", repo, id, patch),
    remove: (repo: string, id: string) => ipcRenderer.invoke("pins:remove", repo, id),
    openPreview: (repo: string, id: string) => ipcRenderer.invoke("pins:open-preview", repo, id),
    saveAttachment: (repo: string, id: string, fileName: string, data: ArrayBuffer) =>
      ipcRenderer.invoke("pins:save-attachment", repo, id, fileName, data),
    dispatchToTerminal: (repo: string, pinId: string, target: unknown) =>
      ipcRenderer.invoke("pins:dispatch-to-terminal", repo, pinId, target),
    subscribe: () => noopUnsubscribe,
  },
  updater: {
    check: () => Promise.resolve({ status: "not-available" }),
    install: () => undefined,
    getVersion: () => Promise.resolve("0.0.0"),
    onUpdateAvailable: () => noopUnsubscribe,
    onDownloadProgress: () => noopUnsubscribe,
    onUpdateDownloaded: () => noopUnsubscribe,
    onError: () => noopUnsubscribe,
    onLocationWarning: () => noopUnsubscribe,
  },
  menu: {
    onOpenFolder: () => noopUnsubscribe,
    onSelectAll: () => noopUnsubscribe,
  },
  search: {
    fileContents: () => Promise.resolve([]),
    sessionContents: () => Promise.resolve([]),
    listSessions: () => Promise.resolve([]),
    listSessionsPage: () => Promise.resolve({ entries: [], nextCursor: null }),
  },
  workspace: {
    load: () => Promise.resolve(null),
    save: () => Promise.resolve(),
    setTitle: () => Promise.resolve(),
  },
  state: {
    load: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  },
  snapshots: {
    list: () => Promise.resolve([]),
    read: () => Promise.resolve(null),
    append: () =>
      Promise.resolve({
        id: "",
        savedAt: Date.now(),
        terminalCount: 0,
        projectCount: 0,
        label: null,
      }),
  },
  fonts: {
    getPath: () => Promise.resolve(""),
    listDownloaded: () => Promise.resolve([]),
    check: () => Promise.resolve(false),
    download: () => Promise.resolve({ ok: false, error: "Font downloads are unavailable." }),
  },
  quota: {
    fetch: () => Promise.resolve({ ok: false }),
  },
  codexQuota: {
    fetch: () => Promise.resolve({ ok: false }),
  },
  summary: {
    generate: () => Promise.resolve({ ok: false, error: "Unavailable" }),
  },
  insights: {
    generate: () =>
      Promise.resolve({
        ok: false,
        jobId: "",
        error: { code: "unavailable", message: "Unavailable" },
      }),
    onProgress: () => noopUnsubscribe,
    openReport: () => Promise.resolve(),
    getLastReport: () => Promise.resolve(null),
  },
  secure: {
    isAvailable: () => Promise.resolve(false),
    encrypt: (plaintext: string) => Promise.resolve(plaintext),
    decrypt: (base64: string) => Promise.resolve(base64),
  },
  agent: {
    start: () => Promise.resolve({ slashCommands: [] }),
    send: () => Promise.resolve(),
    abort: () => Promise.resolve(),
    clear: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    approve: () => Promise.resolve(),
    deny: () => Promise.resolve(),
    onEvent: () => noopUnsubscribe,
  },
  auth: {
    getUser: () => Promise.resolve(null),
    getDeviceId: () => Promise.resolve(""),
    login: () => Promise.resolve({ ok: false }),
    logout: () => Promise.resolve(),
    onAuthStateChange: () => noopUnsubscribe,
  },
  cli: {
    isRegistered: () => Promise.resolve(false),
    register: () => Promise.resolve({ ok: false, skillInstalled: false }),
    unregister: () => Promise.resolve(false),
    validateCommand: () => Promise.resolve({ ok: false, error: "Unavailable" }),
  },
  composer: {
    submit: () => Promise.resolve({ ok: false, error: "Composer unavailable" }),
  },
  usage: {
    query: () => Promise.resolve({ totalTokens: 0, totalCost: 0, byModel: [] }),
    queryRange: () => Promise.resolve({ days: [], totalTokens: 0, totalCost: 0 }),
    heatmap: () => Promise.resolve({}),
    queryCloud: () => Promise.resolve({ totalTokens: 0, totalCost: 0, byModel: [] }),
    queryRangeCloud: () => Promise.resolve({ days: [], totalTokens: 0, totalCost: 0 }),
    heatmapCloud: () => Promise.resolve({}),
  },
});

contextBridge.exposeInMainWorld(
  "casprFlowOS",
  Object.freeze({
    ...api,
    ...casprFlowOSBridge,
  }),
);
