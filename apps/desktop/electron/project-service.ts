import { dialog, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

const stableId = (prefix: string, value: string): string => {
  const hash = createHash("sha1").update(value).digest("hex").slice(0, 12);
  return `${prefix}:${hash}`;
};

const basename = (directoryPath: string): string => {
  return path.basename(directoryPath) || directoryPath;
};

const parseWorktreeList = (stdout: string, rootPath: string): readonly WorktreeInfo[] => {
  const entries: Array<{ path: string; branch?: string; detached?: boolean }> = [];
  let current: { path: string; branch?: string; detached?: boolean } | null = null;

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) {
        entries.push(current);
      }
      current = { path: line.slice("worktree ".length) };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "detached") {
      current.detached = true;
    }
  }

  if (current) {
    entries.push(current);
  }

  if (entries.length === 0) {
    return [
      {
        id: stableId("worktree", rootPath),
        name: "main",
        path: rootPath,
        isPrimary: true,
      },
    ];
  }

  return entries.map((entry, index) => ({
    id: stableId("worktree", entry.path),
    name: entry.branch ?? (entry.detached ? "detached" : basename(entry.path)),
    path: entry.path,
    isPrimary: index === 0 || path.resolve(entry.path) === path.resolve(rootPath),
  }));
};

export const selectProjectDirectory = async (
  window: BrowserWindow,
): Promise<string | null> => {
  const result = await dialog.showOpenDialog(window, {
    title: "Add project",
    properties: ["openDirectory"],
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
};

export const scanProjectDirectory = async (directoryPath: string): Promise<ProjectInfo> => {
  const absolutePath = path.resolve(directoryPath);
  const stats = await fs.stat(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error("Selected path is not a directory.");
  }

  let worktrees: readonly WorktreeInfo[];
  try {
    const { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
      cwd: absolutePath,
    });
    worktrees = parseWorktreeList(stdout, absolutePath);
  } catch {
    worktrees = [
      {
        id: stableId("worktree", absolutePath),
        name: "main",
        path: absolutePath,
        isPrimary: true,
      },
    ];
  }

  return {
    id: stableId("project", absolutePath),
    name: basename(absolutePath),
    path: absolutePath,
    worktrees,
  };
};
