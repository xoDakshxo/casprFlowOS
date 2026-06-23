import { BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

const runGit = async (repoPath: string, args: readonly string[]): Promise<string> => {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: repoPath,
    maxBuffer: 1024 * 1024 * 12,
  });
  return stdout;
};

export const readGitStatus = async (repoPath: string): Promise<GitStatus> => {
  try {
    const raw = await runGit(repoPath, ["status", "--short", "--branch"]);
    const lines = raw.trimEnd().split("\n").filter(Boolean);
    const branchLine = lines[0] ?? "";
    const branch = branchLine.startsWith("## ")
      ? branchLine.slice(3).split("...")[0] ?? null
      : null;

    return {
      isRepo: true,
      branch,
      entries: branchLine.startsWith("## ") ? lines.slice(1) : lines,
      raw,
    };
  } catch {
    return {
      isRepo: false,
      branch: null,
      entries: [],
      raw: "",
    };
  }
};

export const readGitDiff = async (repoPath: string): Promise<GitDiff> => {
  try {
    const [stat, patch] = await Promise.all([
      runGit(repoPath, ["diff", "--stat"]),
      runGit(repoPath, ["diff", "--"]),
    ]);

    return { stat, patch };
  } catch {
    return { stat: "", patch: "" };
  }
};

export class RepoWatcherRegistry {
  readonly #watchers = new Map<string, fs.FSWatcher>();
  #nextWatchId = 1;

  watch(repoPath: string): string {
    const absolutePath = path.resolve(repoPath);
    const existing = [...this.#watchers.entries()].find(
      ([, watcher]) => watcher.listenerCount("change") >= 0 && watcherPath(watcher) === absolutePath,
    );
    if (existing) {
      return existing[0];
    }

    const watchId = `repo-watch:${this.#nextWatchId}`;
    this.#nextWatchId += 1;
    let timer: NodeJS.Timeout | null = null;

    const watcher = fs.watch(absolutePath, { recursive: true }, (_event, filename) => {
      if (filename && shouldIgnorePath(String(filename))) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send("repo:changed", { repoPath: absolutePath });
        }
      }, 120);
    });

    Object.defineProperty(watcher, "__casprflowosPath", {
      value: absolutePath,
      enumerable: false,
    });
    this.#watchers.set(watchId, watcher);
    return watchId;
  }

  unwatch(watchId: string): void {
    const watcher = this.#watchers.get(watchId);
    if (!watcher) {
      return;
    }

    watcher.close();
    this.#watchers.delete(watchId);
  }

  closeAll(): void {
    for (const watcher of this.#watchers.values()) {
      watcher.close();
    }
    this.#watchers.clear();
  }
}

const watcherPath = (watcher: fs.FSWatcher): string | null => {
  const candidate = (watcher as { readonly __casprflowosPath?: unknown }).__casprflowosPath;
  return typeof candidate === "string" ? candidate : null;
};

const shouldIgnorePath = (relativePath: string): boolean => {
  return relativePath
    .split(path.sep)
    .some((part) => part === ".git" || part === "node_modules" || part === "dist");
};
