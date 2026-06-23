import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readGitDiff, readGitStatus, RepoWatcherRegistry } from "./git-service";
import { scanProjectDirectory, selectProjectDirectory } from "./project-service";
import { TerminalService, type TerminalCreateInput } from "./terminal-service";
import { readFileTree, readWorkspaceFile } from "./workspace-service";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const terminalService = new TerminalService();
const repoWatchers = new RepoWatcherRegistry();

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
  ipcMain.handle("project:selectDirectory", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return null;
    }

    return selectProjectDirectory(window);
  });

  ipcMain.handle("project:scan", (_event, directoryPath: string) => {
    return scanProjectDirectory(directoryPath);
  });

  ipcMain.handle("workspace:readTree", (_event, rootPath: string) => {
    return readFileTree(rootPath);
  });

  ipcMain.handle("workspace:readFile", (_event, rootPath: string, relativePath: string) => {
    return readWorkspaceFile(rootPath, relativePath);
  });

  ipcMain.handle("git:status", (_event, repoPath: string) => {
    return readGitStatus(repoPath);
  });

  ipcMain.handle("git:diff", (_event, repoPath: string) => {
    return readGitDiff(repoPath);
  });

  ipcMain.handle("repo:watch", (_event, repoPath: string) => {
    return repoWatchers.watch(repoPath);
  });

  ipcMain.handle("repo:unwatch", (_event, watchId: string) => {
    repoWatchers.unwatch(watchId);
  });

  ipcMain.handle("terminal:create", (event, input: unknown) => {
    if (!isTerminalCreateInput(input)) {
      throw new Error("Invalid terminal create payload.");
    }

    return terminalService.create(input, event.sender);
  });

  ipcMain.handle("terminal:write", (_event, id: string, data: string) => {
    terminalService.write(id, data);
  });

  ipcMain.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => {
    terminalService.resize(id, cols, rows);
  });

  ipcMain.handle("terminal:kill", (_event, id: string) => {
    terminalService.kill(id);
  });
};

const createMainWindow = async (): Promise<void> => {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    // Transparent so the macOS vibrancy material (set below) shows through.
    // An opaque backgroundColor here would bury the glass effect entirely.
    backgroundColor: "#00000000",
    show: false,
    title: "casprFlowOS",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadFile(path.join(dirname, "../dist/index.html"));
};

app.setName("casprFlowOS");
registerIpcHandlers();

void app.whenReady().then(async () => {
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
  repoWatchers.closeAll();
});
