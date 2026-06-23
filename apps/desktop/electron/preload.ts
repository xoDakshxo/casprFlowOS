import { contextBridge, ipcRenderer } from "electron";

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
    selectDirectory: () => ipcRenderer.invoke("project:selectDirectory") as Promise<string | null>,
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
    status: (repoPath: string) => ipcRenderer.invoke("git:status", repoPath) as Promise<GitStatus>,
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
      const handler = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent): void => {
        listener(payload);
      };
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.off("terminal:exit", handler);
    },
  },
});

contextBridge.exposeInMainWorld("casprFlowOS", api);
