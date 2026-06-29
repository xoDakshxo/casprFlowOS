import { app, BrowserWindow, ipcMain, shell } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FileTreeWatcher } from "./file-tree-watcher";
import { copyFiles } from "./fs-copy";
import {
  addRemote,
  amendCommit,
  applyStash,
  checkoutGitRef,
  createBranch,
  createCommit,
  createStash,
  createTag,
  deleteBranch,
  deleteTag,
  discardFiles,
  dropStash,
  getBlame,
  getFileDiff,
  getGitBranches,
  getGitCommitDetail,
  getGitLog,
  getGitStatus,
  getMergeState,
  gitCherryPick,
  gitCherryPickAbort,
  gitFetch,
  gitMerge,
  gitMergeAbort,
  gitPull,
  gitPush,
  gitRebase,
  gitRebaseAbort,
  gitRebaseContinue,
  initGitRepo,
  isGitRepo,
  listRemotes,
  listStashes,
  listTags,
  popStash,
  removeRemote,
  renameBranch,
  renameRemote,
  stageFiles,
  stageHunk,
  unstageFiles,
  unstageHunk,
} from "./git-info";
import { parseNulSeparatedGitPaths } from "./git-paths";
import { GitFileWatcher } from "./git-watcher";
import { getProjectDiff } from "./git-diff";
import { ProjectScanner } from "./project-scanner";
import { selectProjectDirectory } from "./project-service";
import { TerminalService, type TerminalCreateInput } from "./terminal-service";
import { readFileTree, readWorkspaceFile } from "./workspace-service";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const terminalService = new TerminalService();
const projectScanner = new ProjectScanner();
const gitWatcher = new GitFileWatcher();
let mainWindow: BrowserWindow | null = null;

const HIDDEN_DIRS = new Set([".git"]);
const fileTreeWatcher = new FileTreeWatcher(HIDDEN_DIRS, (dirPath) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("fs:dir-changed", dirPath);
  }
});

const IMAGE_EXTS_FS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".ico",
  ".avif",
  ".apng",
]);
const MIME_MAP_FS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".apng": "image/apng",
};
const MAX_TEXT_FILE_SIZE = 512 * 1024;
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

const emitToWindows = (channel: string, ...args: readonly unknown[]): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, ...args);
  }
};

const runGitText = (
  cwd: string,
  args: readonly string[],
  options: { timeout?: number; maxBuffer?: number } = {},
): Promise<string> => {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...args],
      {
        cwd,
        timeout: options.timeout ?? 10_000,
        maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error instanceof Error ? error : new Error("Git command failed"));
          return;
        }
        resolve(stdout);
      },
    );
  });
};

const listAllFiles = async (
  dirPath: string,
): Promise<{ type: "git" | "dir"; paths: string[] }> => {
  try {
    const trackedOutput = await runGitText(dirPath, [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ]);
    return {
      type: "git",
      paths: parseNulSeparatedGitPaths(trackedOutput),
    };
  } catch {
    const paths: string[] = [];
    const visited = new Set<string>();

    const collect = (dir: string, prefix: string): number => {
      let added = 0;
      try {
        const realDir = fs.realpathSync(dir);
        if (visited.has(realDir)) {
          return 0;
        }
        visited.add(realDir);
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (HIDDEN_DIRS.has(entry.name)) {
            continue;
          }
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            added += collect(path.join(dir, entry.name), relativePath);
          } else {
            paths.push(relativePath);
            added += 1;
          }
        }
        if (added === 0 && prefix) {
          paths.push(`${prefix}/`);
        }
      } catch (error) {
        console.error(`[fs:list-all-files] failed to read ${dir}:`, error);
      }
      return added;
    };

    collect(dirPath, "");
    return { type: "dir", paths };
  }
};

const listIgnoredFiles = async (dirPath: string): Promise<string[]> => {
  try {
    const [filesOutput, dirsOutput] = await Promise.all([
      runGitText(dirPath, ["ls-files", "-z", "--others", "--ignored", "--exclude-standard"]),
      runGitText(dirPath, [
        "ls-files",
        "-z",
        "--others",
        "--ignored",
        "--exclude-standard",
        "--directory",
      ]),
    ]);
    return [
      ...new Set([
        ...parseNulSeparatedGitPaths(dirsOutput),
        ...parseNulSeparatedGitPaths(filesOutput),
      ]),
    ];
  } catch (error) {
    console.warn("[fs:list-ignored-files] failed:", error);
    return [];
  }
};

const readCasprFlowOSFile = (
  filePath: string,
): { type: string; content: string } | { type?: string; error?: string; size?: string } => {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isImage = IMAGE_EXTS_FS.has(ext);
    const ceiling = isImage ? MAX_IMAGE_FILE_SIZE : MAX_TEXT_FILE_SIZE;
    if (stat.size > ceiling) {
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
      return { error: "too-large", size: `${sizeMB} MB` };
    }

    if (isImage) {
      const buffer = fs.readFileSync(filePath);
      const mime = MIME_MAP_FS[ext] ?? "image/png";
      return {
        type: "image",
        content: `data:${mime};base64,${buffer.toString("base64")}`,
      };
    }

    const fd = fs.openSync(filePath, "r");
    const probe = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, probe, 0, 8192, 0);
    fs.closeSync(fd);
    if (probe.subarray(0, bytesRead).includes(0)) {
      return { type: "binary" };
    }

    return {
      type: ext === ".md" ? "markdown" : "text",
      content: fs.readFileSync(filePath, "utf-8"),
    };
  } catch {
    return { error: "read-error" };
  }
};

let nextCasprFlowOSPtyId = 1;
const casprFlowOSPtyIds = new Map<number, string>();

const resolvePtyId = (id: number | string): string => {
  if (typeof id === "number") {
    return casprFlowOSPtyIds.get(id) ?? String(id);
  }
  return id;
};

const isTerminalCreateInput = (input: unknown): input is TerminalCreateInput => {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<TerminalCreateInput>;
  return (
    typeof candidate.cwd === "string" &&
    typeof candidate.cols === "number" &&
    typeof candidate.rows === "number"
  );
};

const registerIpcHandlers = (): void => {
  ipcMain.handle("project:select-directory", async () => {
    if (!mainWindow) {
      return null;
    }

    return selectProjectDirectory(mainWindow);
  });

  ipcMain.handle("project:selectDirectory", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return null;
    }

    return selectProjectDirectory(window);
  });

  ipcMain.handle("project:scan", (_event, directoryPath: string) => {
    return projectScanner.scanAsync(directoryPath);
  });

  ipcMain.handle("project:list-child-git-repos", (_event, directoryPath: string) => {
    return projectScanner.listChildGitReposAsync(directoryPath);
  });

  ipcMain.handle("project:rescan-worktrees", (_event, directoryPath: string) => {
    return projectScanner.listWorktreesAsync(directoryPath);
  });

  ipcMain.handle("project:create-worktree", async (_event, repoPath: string, branch: string) => {
    const trimmedBranch = branch.trim();
    if (!trimmedBranch) {
      return { ok: false as const, error: "Branch name is required" };
    }
    if (/[\s~^:?*[\\]/.test(trimmedBranch) || trimmedBranch.startsWith("-")) {
      return { ok: false as const, error: "Invalid branch name" };
    }

    const worktreePath = path.join(path.dirname(repoPath), trimmedBranch);
    try {
      await runGitText(repoPath, ["worktree", "add", "-b", trimmedBranch, worktreePath], {
        timeout: 120_000,
      });
      return {
        ok: true as const,
        path: worktreePath,
        worktrees: await projectScanner.listWorktreesAsync(repoPath),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(
    "project:remove-worktree",
    async (_event, repoPath: string, worktreePath: string, force?: boolean) => {
      try {
        await runGitText(
          repoPath,
          ["worktree", "remove", ...(force ? ["--force"] : []), worktreePath],
          {
            timeout: 120_000,
          },
        );
        return {
          ok: true as const,
          worktrees: await projectScanner.listWorktreesAsync(repoPath),
        };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle("project:delete-folder", (_event, projectPath: string) => {
    try {
      fs.rmSync(projectPath, { recursive: true, force: true });
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("project:enable-hydra", () => {
    return { ok: true as const, changed: false };
  });

  ipcMain.handle("project:check-hydra", () => {
    return "missing";
  });

  ipcMain.handle("project:diff", async (_event, worktreePath: string) => {
    try {
      return await getProjectDiff(worktreePath);
    } catch {
      return { diff: "", files: [] };
    }
  });

  ipcMain.handle("workspace:readTree", (_event, rootPath: string) => {
    return readFileTree(rootPath);
  });

  ipcMain.handle("workspace:readFile", (_event, rootPath: string, relativePath: string) => {
    return readWorkspaceFile(rootPath, relativePath);
  });

  ipcMain.handle("git:watch", (_event, worktreePath: string) => {
    gitWatcher.watch(worktreePath, {
      onChanged: () => emitToWindows("git:changed", worktreePath),
      onLogChanged: () => emitToWindows("git:log-changed", worktreePath),
      onPresenceChanged: (isRepoState) => {
        emitToWindows("git:presence-changed", worktreePath, { isGitRepo: isRepoState });
      },
    });
  });

  ipcMain.handle("git:unwatch", (_event, worktreePath: string) => {
    gitWatcher.unwatch(worktreePath);
  });

  ipcMain.handle("git:is-repo", (_event, dirPath: string) => {
    return isGitRepo(dirPath);
  });

  ipcMain.handle("git:branches", async (_event, worktreePath: string) => {
    try {
      return await getGitBranches(worktreePath);
    } catch {
      return [];
    }
  });

  ipcMain.handle("git:log", async (_event, worktreePath: string, count?: number) => {
    try {
      return await getGitLog(worktreePath, count);
    } catch {
      return [];
    }
  });

  ipcMain.handle("git:commit-detail", (_event, worktreePath: string, hash: string) => {
    return getGitCommitDetail(worktreePath, hash);
  });
  ipcMain.handle("git:checkout", (_event, worktreePath: string, ref: string) => {
    return checkoutGitRef(worktreePath, ref);
  });
  ipcMain.handle("git:init", (_event, worktreePath: string) => initGitRepo(worktreePath));
  ipcMain.handle("git:status", async (_event, worktreePath: string) => {
    try {
      return await getGitStatus(worktreePath);
    } catch {
      return [];
    }
  });
  ipcMain.handle("git:stage", (_event, worktreePath: string, paths: string[]) =>
    stageFiles(worktreePath, paths),
  );
  ipcMain.handle("git:unstage", (_event, worktreePath: string, paths: string[]) =>
    unstageFiles(worktreePath, paths),
  );
  ipcMain.handle(
    "git:discard",
    (_event, worktreePath: string, tracked: string[], untracked: string[]) =>
      discardFiles(worktreePath, tracked, untracked),
  );
  ipcMain.handle("git:commit", (_event, worktreePath: string, message: string) =>
    createCommit(worktreePath, message),
  );
  ipcMain.handle("git:push", (_event, worktreePath: string) => gitPush(worktreePath));
  ipcMain.handle("git:pull", (_event, worktreePath: string) => gitPull(worktreePath));
  ipcMain.handle("git:amend", (_event, worktreePath: string, message: string) =>
    amendCommit(worktreePath, message),
  );
  ipcMain.handle("git:fetch", (_event, worktreePath: string, remote?: string) =>
    gitFetch(worktreePath, remote),
  );
  ipcMain.handle("git:stash-list", async (_event, worktreePath: string) => {
    try {
      return await listStashes(worktreePath);
    } catch {
      return [];
    }
  });
  ipcMain.handle(
    "git:stash-create",
    (_event, worktreePath: string, message: string, includeUntracked: boolean) =>
      createStash(worktreePath, message, includeUntracked),
  );
  ipcMain.handle("git:stash-apply", (_event, worktreePath: string, index: number) =>
    applyStash(worktreePath, index),
  );
  ipcMain.handle("git:stash-pop", (_event, worktreePath: string, index: number) =>
    popStash(worktreePath, index),
  );
  ipcMain.handle("git:stash-drop", (_event, worktreePath: string, index: number) =>
    dropStash(worktreePath, index),
  );
  ipcMain.handle(
    "git:branch-create",
    (_event, worktreePath: string, name: string, startPoint?: string) =>
      createBranch(worktreePath, name, startPoint),
  );
  ipcMain.handle(
    "git:branch-delete",
    (_event, worktreePath: string, name: string, force: boolean) =>
      deleteBranch(worktreePath, name, force),
  );
  ipcMain.handle(
    "git:branch-rename",
    (_event, worktreePath: string, oldName: string, newName: string) =>
      renameBranch(worktreePath, oldName, newName),
  );
  ipcMain.handle("git:tag-list", async (_event, worktreePath: string) => {
    try {
      return await listTags(worktreePath);
    } catch {
      return [];
    }
  });
  ipcMain.handle(
    "git:tag-create",
    (_event, worktreePath: string, name: string, ref: string, message?: string) =>
      createTag(worktreePath, name, ref, message),
  );
  ipcMain.handle("git:tag-delete", (_event, worktreePath: string, name: string) =>
    deleteTag(worktreePath, name),
  );
  ipcMain.handle("git:remote-list", async (_event, worktreePath: string) => {
    try {
      return await listRemotes(worktreePath);
    } catch {
      return [];
    }
  });
  ipcMain.handle("git:remote-add", (_event, worktreePath: string, name: string, url: string) =>
    addRemote(worktreePath, name, url),
  );
  ipcMain.handle("git:remote-remove", (_event, worktreePath: string, name: string) =>
    removeRemote(worktreePath, name),
  );
  ipcMain.handle(
    "git:remote-rename",
    (_event, worktreePath: string, oldName: string, newName: string) =>
      renameRemote(worktreePath, oldName, newName),
  );
  ipcMain.handle("git:merge", (_event, worktreePath: string, ref: string) =>
    gitMerge(worktreePath, ref),
  );
  ipcMain.handle("git:merge-abort", (_event, worktreePath: string) =>
    gitMergeAbort(worktreePath),
  );
  ipcMain.handle("git:rebase", (_event, worktreePath: string, ref: string) =>
    gitRebase(worktreePath, ref),
  );
  ipcMain.handle("git:rebase-abort", (_event, worktreePath: string) =>
    gitRebaseAbort(worktreePath),
  );
  ipcMain.handle("git:rebase-continue", (_event, worktreePath: string) =>
    gitRebaseContinue(worktreePath),
  );
  ipcMain.handle("git:cherry-pick", (_event, worktreePath: string, hash: string) =>
    gitCherryPick(worktreePath, hash),
  );
  ipcMain.handle("git:cherry-pick-abort", (_event, worktreePath: string) =>
    gitCherryPickAbort(worktreePath),
  );
  ipcMain.handle("git:merge-state", (_event, worktreePath: string) =>
    getMergeState(worktreePath),
  );
  ipcMain.handle(
    "git:file-diff",
    (_event, worktreePath: string, filePath: string, staged: boolean) =>
      getFileDiff(worktreePath, filePath, staged),
  );
  ipcMain.handle(
    "git:stage-hunk",
    (_event, worktreePath: string, filePath: string, hunkHeader: string) =>
      stageHunk(worktreePath, filePath, hunkHeader),
  );
  ipcMain.handle(
    "git:unstage-hunk",
    (_event, worktreePath: string, filePath: string, hunkHeader: string) =>
      unstageHunk(worktreePath, filePath, hunkHeader),
  );
  ipcMain.handle("git:blame", (_event, worktreePath: string, filePath: string) =>
    getBlame(worktreePath, filePath),
  );

  ipcMain.handle("fs:list-dir", (_event, dirPath: string) => {
    try {
      return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => !HIDDEN_DIRS.has(entry.name))
        .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
        .sort((left, right) => {
          if (left.isDirectory !== right.isDirectory) {
            return left.isDirectory ? -1 : 1;
          }
          return left.name.localeCompare(right.name);
        });
    } catch {
      return [];
    }
  });
  ipcMain.handle("fs:list-all-files", (_event, dirPath: string) => listAllFiles(dirPath));
  ipcMain.handle("fs:list-ignored-files", (_event, dirPath: string) => listIgnoredFiles(dirPath));
  ipcMain.handle("fs:read-file", (_event, filePath: string) => readCasprFlowOSFile(filePath));
  ipcMain.handle("fs:write-file", (_event, filePath: string, content: string) => {
    try {
      const existing = fs.readFileSync(filePath, "utf-8");
      if (existing === content) {
        return { changed: false };
      }
    } catch {
      // Missing files are created below.
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return { changed: true };
  });
  ipcMain.handle("fs:copy", (_event, sources: string[], destDir: string) =>
    copyFiles(sources, destDir),
  );
  ipcMain.handle("fs:rename", (_event, oldPath: string, newName: string) => {
    const basename = path.basename(newName);
    if (basename !== newName || !newName) {
      throw new Error("Invalid name");
    }
    fs.renameSync(oldPath, path.join(path.dirname(oldPath), newName));
  });
  ipcMain.handle("fs:move", (_event, oldPath: string, newPath: string) => {
    if (!oldPath || !newPath) {
      throw new Error("Invalid path");
    }
    if (fs.existsSync(newPath)) {
      throw new Error("Destination already exists");
    }
    fs.renameSync(oldPath, newPath);
  });
  ipcMain.handle("fs:delete", (_event, targetPath: string) => {
    fs.rmSync(targetPath, { recursive: true, force: true });
  });
  ipcMain.handle("fs:mkdir", (_event, dirPath: string, name: string) => {
    const basename = path.basename(name);
    if (basename !== name || !name) {
      throw new Error("Invalid name");
    }
    fs.mkdirSync(path.join(dirPath, name), { recursive: true });
  });
  ipcMain.handle("fs:create-file", (_event, dirPath: string, name: string) => {
    const basename = path.basename(name);
    if (basename !== name || !name) {
      throw new Error("Invalid name");
    }
    const filePath = path.join(dirPath, name);
    if (fs.existsSync(filePath)) {
      throw new Error("File already exists");
    }
    fs.writeFileSync(filePath, "", "utf-8");
  });
  ipcMain.handle("fs:reveal", (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath);
  });
  ipcMain.handle("fs:watch-dir", (_event, dirPath: string) => {
    fileTreeWatcher.watch(dirPath);
  });
  ipcMain.handle("fs:unwatch-dir", (_event, dirPath: string) => {
    fileTreeWatcher.unwatch(dirPath);
  });
  ipcMain.handle("fs:unwatch-all-dirs", () => {
    fileTreeWatcher.unwatchAll();
  });

  ipcMain.handle("memory:scan", () => {
    return { nodes: [], edges: [] };
  });
  ipcMain.handle("memory:watch", () => undefined);
  ipcMain.handle("memory:unwatch", () => undefined);

  ipcMain.handle("sessions:load-replay", () => ({ turns: [] }));
  ipcMain.handle("sessions:fork-session", () => ({ newSessionId: "", newFilePath: "" }));

  ipcMain.handle("pins:list", () => []);
  ipcMain.handle("pins:create", () => {
    throw new Error("Pins are not available in casprFlowOS yet.");
  });
  ipcMain.handle("pins:update", () => {
    throw new Error("Pins are not available in casprFlowOS yet.");
  });
  ipcMain.handle("pins:remove", () => undefined);
  ipcMain.handle("pins:open-preview", () => undefined);
  ipcMain.handle("pins:save-attachment", () => {
    throw new Error("Pin attachments are not available in casprFlowOS yet.");
  });
  ipcMain.handle("pins:dispatch-to-terminal", () => ({
    ok: false,
    error: "Pins are not available yet.",
  }));

  ipcMain.handle("terminal:create", async (event, input: unknown) => {
    if (isTerminalCreateInput(input)) {
      return terminalService.create(input, event.sender);
    }

    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { cwd?: unknown }).cwd !== "string"
    ) {
      throw new Error("Invalid terminal create payload.");
    }

    const casprFlowOSPtyId = nextCasprFlowOSPtyId;
    nextCasprFlowOSPtyId += 1;
    const options = input as {
      cwd: string;
      shell?: string;
      args?: readonly string[];
      terminalId?: string;
      theme?: "dark" | "light";
    };
    const result = await terminalService.create(
      {
        cwd: options.cwd,
        shell: options.shell,
        args: options.args,
        terminalId: options.terminalId,
        theme: options.theme,
        cols: 100,
        rows: 28,
        casprFlowOSPtyId,
      },
      event.sender,
    );
    casprFlowOSPtyIds.set(casprFlowOSPtyId, result.id);
    return casprFlowOSPtyId;
  });

  ipcMain.handle("terminal:write", (_event, id: string, data: string) => {
    terminalService.write(id, data);
  });

  ipcMain.handle("terminal:kill", (_event, id: string) => {
    terminalService.kill(id);
  });

  ipcMain.handle("terminal:destroy", (_event, id: number | string) => {
    terminalService.kill(resolvePtyId(id));
  });
  ipcMain.handle("terminal:input", (_event, id: number | string, data: string) => {
    terminalService.write(resolvePtyId(id), data);
  });
  ipcMain.handle("terminal:resize", (_event, id: number | string, cols: number, rows: number) => {
    terminalService.resize(resolvePtyId(id), cols, rows);
  });
  ipcMain.handle("terminal:get-pid", () => null);
  ipcMain.handle("terminal:notify-theme-changed", () => undefined);
  ipcMain.handle("terminal:detect-cli", () => null);
};

const createMainWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    // Transparent so the macOS vibrancy material (set below) shows through.
    // An opaque backgroundColor here would bury the glass effect entirely.
    backgroundColor: "#00000000",
    show: false,
    title: "casprOS",
    icon: path.join(dirname, "../resources/casprlogo.png"),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(dirname, "preload.cjs"),
      sandbox: true,
      // Enables the <webview> tag used by the in-app browser (right-panel
      // Browser tab + canvas browser cards).
      webviewTag: true,
    },
  });
  mainWindow = window;

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levels = ["debug", "info", "warning", "error"] as const;
    const label = levels[level] ?? "log";
    console.log(`[renderer:${label}] ${message} (${sourceId}:${line})`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer:gone]", details);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  // Global responsive UI scale. A true page-level zoom driven by window size so
  // the whole app — panels, text, AND terminals — scales uniformly and stays
  // crisp (zoom re-rasterizes, unlike CSS transform). Page zoom is transparent
  // to layout coordinates, so the canvas pan/zoom/placement math is unaffected.
  // Anchored to 1.0 at ~1440x900, easing to ~0.9 on small windows and ~1.25 on
  // large displays — that's the "it was too small on a big screen" fix.
  const applyResponsiveZoom = () => {
    if (window.isDestroyed()) return;
    const { width, height } = window.getContentBounds();
    const ratio = Math.min(width / 1440, height / 900);
    const factor = Math.max(0.9, Math.min(1.25, 0.5 + ratio * 0.5));
    window.webContents.setZoomFactor(factor);
    pushToolbarMetrics();
  };

  // The macOS traffic lights sit at a fixed SCREEN position (16px) and are NOT
  // affected by the page zoom — but the toolbar IS. So a fixed CSS gutter (and
  // the toolbar's vertical centring) drift away from the lights as the zoom
  // changes. Compute both the left gutter and a vertical nudge here, where the
  // zoom + fullscreen state are known, and push the exact CSS values. In
  // fullscreen the lights are hidden, so the gutter collapses and the nudge is 0.
  const TRAFFIC_LIGHT_INSET = 88; // screen px: clears the 3 stoplights + an even gap
  const TOOLBAR_HALF = 22; // css px: half of the h-11 (44px) toolbar
  const LIGHT_HALF = 6; // half the stoplight height (y:16 centres them at zoom 1)
  const pushToolbarMetrics = () => {
    if (window.isDestroyed()) return;
    const zoom = window.webContents.getZoomFactor() || 1;
    const fs = window.isFullScreen();
    const left = fs ? 12 : Math.ceil(TRAFFIC_LIGHT_INSET / zoom);
    window.webContents.send("window:toolbar-metrics", { left });
    // The toolbar + its icons are zoomed but the native traffic lights are NOT,
    // so at zoom ≠ 1 the lights drift off the toolbar's centre line. Move the
    // lights ONTO that line so the whole top bar reads as a single row.
    if (process.platform === "darwin" && !fs) {
      const y = Math.max(0, Math.round(TOOLBAR_HALF * zoom - LIGHT_HALF));
      try {
        window.setWindowButtonPosition({ x: 16, y });
      } catch {
        // Older Electron: fall back to the deprecated alias.
        (
          window as unknown as {
            setTrafficLightPosition?: (p: { x: number; y: number }) => void;
          }
        ).setTrafficLightPosition?.({ x: 16, y });
      }
    }
  };
  window.webContents.on("did-finish-load", applyResponsiveZoom);
  window.on("resize", applyResponsiveZoom);

  // Recompute the toolbar gutter when the lights appear/disappear or the page
  // first loads (resize is already covered via applyResponsiveZoom).
  window.on("enter-full-screen", pushToolbarMetrics);
  window.on("leave-full-screen", pushToolbarMetrics);
  window.webContents.on("did-finish-load", pushToolbarMetrics);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(dirname, "../dist/index.html"));
};

app.setName("casprOS");
registerIpcHandlers();

void app.whenReady().then(async () => {
  // Dock icon (macOS dev): replace the default blue Electron icon with the
  // casprOS mark. Packaged builds use the bundle icon.
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(path.join(dirname, "../resources/casprlogo.png"));
    } catch {
      // non-fatal
    }
  }
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  terminalService.killAll();
  gitWatcher.unwatchAll();
  fileTreeWatcher.unwatchAll();
});
