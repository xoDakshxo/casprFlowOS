import fs from "node:fs/promises";
import path from "node:path";

export type FileTreeNodeType = "directory" | "file";

export interface FileTreeNode {
  readonly name: string;
  readonly relativePath: string;
  readonly type: FileTreeNodeType;
  readonly children?: readonly FileTreeNode[];
}

const IGNORED_NAMES = new Set([
  ".git",
  ".DS_Store",
  "node_modules",
  "dist",
  "dist-electron",
  "dist-types",
  "build",
  "out",
]);

const assertInsideRoot = (rootPath: string, relativePath: string): string => {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path escapes workspace root.");
  }

  return target;
};

const readNode = async (
  rootPath: string,
  relativePath: string,
  depth: number,
): Promise<FileTreeNode | null> => {
  const absolutePath = assertInsideRoot(rootPath, relativePath);
  const name = relativePath ? path.basename(relativePath) : path.basename(rootPath);

  if (IGNORED_NAMES.has(name)) {
    return null;
  }

  const stats = await fs.stat(absolutePath);
  if (!stats.isDirectory()) {
    return {
      name,
      relativePath,
      type: "file",
    };
  }

  if (depth <= 0) {
    return {
      name,
      relativePath,
      type: "directory",
      children: [],
    };
  }

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const sorted = entries
    .filter((entry) => !IGNORED_NAMES.has(entry.name))
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 240);

  const children = await Promise.all(
    sorted.map((entry) => readNode(rootPath, path.join(relativePath, entry.name), depth - 1)),
  );

  return {
    name,
    relativePath,
    type: "directory",
    children: children.filter((child): child is FileTreeNode => child !== null),
  };
};

export const readFileTree = async (rootPath: string): Promise<FileTreeNode> => {
  const node = await readNode(rootPath, "", 5);
  if (!node) {
    throw new Error("Unable to read workspace tree.");
  }

  return node;
};

export const readWorkspaceFile = async (
  rootPath: string,
  relativePath: string,
): Promise<string> => {
  const absolutePath = assertInsideRoot(rootPath, relativePath);
  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    throw new Error("Selected path is not a file.");
  }

  return fs.readFile(absolutePath, "utf8");
};
