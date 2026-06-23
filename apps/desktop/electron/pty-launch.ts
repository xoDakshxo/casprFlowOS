import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface PtyLaunchOptions {
  readonly cwd: string;
  readonly shell?: string;
  readonly args?: readonly string[];
  readonly extraPathEntries?: readonly string[];
  readonly envOverrides?: Readonly<Record<string, string | undefined>>;
  readonly terminalId?: string;
  readonly theme?: "dark" | "light";
}

export interface PtyResolvedLaunchSpec {
  readonly cwd: string;
  readonly file: string;
  readonly args: string[];
  readonly env: Record<string, string>;
}

export interface LaunchResolverDeps {
  readonly platform: NodeJS.Platform;
  readonly pathDelimiter: string;
  readonly existsSync: (file: string) => boolean;
  readonly isExecutable: (file: string) => boolean;
  readonly getShellEnv: () => Promise<Record<string, string | undefined>>;
}

export class PtyLaunchError extends Error {
  readonly code: string;
  readonly command: string;

  constructor(code: string, message: string, command: string) {
    super(message);
    this.name = "PtyLaunchError";
    this.code = code;
    this.command = command;
  }
}

const LOGIN_SHELL_ENV_BLOCKLIST = new Set([
  "NO_COLOR",
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "TERM_SESSION_ID",
]);

const LOGIN_SHELL_ENV_BLOCKED_PREFIXES = ["CODEX_", "P9K_"] as const;

const CASPRFLOWOS_RUNTIME_ENV_BLOCKLIST = new Set([
  "CASPRFLOWOS_TERMINAL_ID",
  "CASPRFLOWOS_THEME",
]);

const getEnvVarCaseInsensitive = (
  env: Record<string, string | undefined>,
  key: string,
): string | undefined => {
  if (typeof env[key] === "string") {
    return env[key];
  }

  const found = Object.entries(env).find(([entryKey, entryValue]) => {
    return entryKey.toLowerCase() === key.toLowerCase() && typeof entryValue === "string";
  });
  return found?.[1];
};

const getPlatformPath = (platform: NodeJS.Platform): typeof path.posix => {
  return platform === "win32" ? path.win32 : path.posix;
};

const defaultPathEntriesForPlatform = (
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string[] => {
  const platformPath = getPlatformPath(platform);

  if (platform === "win32") {
    const localAppData = getEnvVarCaseInsensitive(env, "LOCALAPPDATA");
    const appData = getEnvVarCaseInsensitive(env, "APPDATA");
    const userProfile = getEnvVarCaseInsensitive(env, "USERPROFILE");
    return [
      "C:\\Windows\\System32",
      "C:\\Windows",
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
      localAppData ? platformPath.join(localAppData, "Microsoft", "WindowsApps") : "",
      appData ? platformPath.join(appData, "npm") : "",
      userProfile ? platformPath.join(userProfile, ".local", "bin") : "",
      userProfile ? platformPath.join(userProfile, "bin") : "",
    ].filter(Boolean);
  }

  return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
};

const mergePathValue = (
  pathValue: string | undefined,
  platform: NodeJS.Platform,
  delimiter: string,
  env: Record<string, string | undefined>,
): string => {
  const seen = new Set<string>();
  const merged: string[] = [];

  const addEntry = (value: string): void => {
    const trimmed = value.trim();
    const key = platform === "win32" ? trimmed.toLowerCase() : trimmed;
    if (!trimmed || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(trimmed);
  };

  const addEntries = (value: string | undefined): void => {
    if (!value) {
      return;
    }
    for (const entry of value.split(delimiter)) {
      addEntry(entry);
    }
  };

  addEntries(pathValue);
  for (const entry of defaultPathEntriesForPlatform(platform, env)) {
    addEntry(entry);
  }

  return merged.join(delimiter);
};

export const sanitizeEnv = (
  env: Record<string, string | undefined>,
  deps: Pick<LaunchResolverDeps, "platform" | "pathDelimiter">,
): Record<string, string> => {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      cleaned[key] = value;
    }
  }

  for (const key of CASPRFLOWOS_RUNTIME_ENV_BLOCKLIST) {
    delete cleaned[key];
  }

  cleaned.PATH = mergePathValue(
    getEnvVarCaseInsensitive(env, "PATH"),
    deps.platform,
    deps.pathDelimiter,
    env,
  );
  return cleaned;
};

const shouldStripFromLoginShellSeed = (key: string): boolean => {
  if (LOGIN_SHELL_ENV_BLOCKLIST.has(key)) {
    return true;
  }

  return LOGIN_SHELL_ENV_BLOCKED_PREFIXES.some((prefix) => key.startsWith(prefix));
};

const sanitizeLoginShellSeedEnv = (
  env: Record<string, string | undefined>,
  deps: Pick<LaunchResolverDeps, "platform" | "pathDelimiter">,
): Record<string, string> => {
  const cleaned = sanitizeEnv(env, deps);
  for (const key of Object.keys(cleaned)) {
    if (shouldStripFromLoginShellSeed(key)) {
      delete cleaned[key];
    }
  }
  return cleaned;
};

const hasPathSeparator = (command: string): boolean => {
  return command.includes("/") || command.includes("\\");
};

const pathEntryExists = (
  entries: readonly string[],
  target: string,
  platform: NodeJS.Platform,
): boolean => {
  const normalizedTarget = platform === "win32" ? target.toLowerCase() : target;
  return entries.some((entry) => {
    return (platform === "win32" ? entry.toLowerCase() : entry) === normalizedTarget;
  });
};

const getWindowsCommandCandidates = (command: string): string[] => {
  const lower = command.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat")) {
    return [command];
  }
  return [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command];
};

const getWindowsPathCandidates = (target: string): string[] => {
  const lower = target.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat")) {
    return [target];
  }
  return [`${target}.exe`, `${target}.cmd`, `${target}.bat`, target];
};

const resolveExactExecutable = (
  target: string,
  deps: Pick<LaunchResolverDeps, "existsSync" | "isExecutable">,
): string | null => {
  if (!deps.existsSync(target)) {
    return null;
  }
  if (!deps.isExecutable(target)) {
    return null;
  }
  return target;
};

export const resolveExecutable = (
  command: string,
  env: Record<string, string>,
  deps: Pick<LaunchResolverDeps, "platform" | "pathDelimiter" | "existsSync" | "isExecutable">,
): string | null => {
  if (!command) {
    return null;
  }

  const platformPath = getPlatformPath(deps.platform);

  if (platformPath.isAbsolute(command) || hasPathSeparator(command)) {
    const candidates = deps.platform === "win32" ? getWindowsPathCandidates(command) : [command];

    for (const candidate of candidates) {
      const resolved = resolveExactExecutable(candidate, deps);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  const pathEntries = (env.PATH ?? "")
    .split(deps.pathDelimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const commandNames =
    deps.platform === "win32" ? getWindowsCommandCandidates(command) : [command];

  for (const dir of pathEntries) {
    for (const name of commandNames) {
      const candidate = platformPath.join(dir, name);
      const resolved = resolveExactExecutable(candidate, deps);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

const isWindowsBatchScript = (file: string, platform: NodeJS.Platform): boolean => {
  if (platform !== "win32") {
    return false;
  }
  const lower = file.toLowerCase();
  return lower.endsWith(".cmd") || lower.endsWith(".bat");
};

const resolveUserShell = (
  env: Record<string, string>,
  deps: Pick<LaunchResolverDeps, "platform" | "pathDelimiter" | "existsSync" | "isExecutable">,
): string => {
  const candidates =
    deps.platform === "win32"
      ? [env.ComSpec, "pwsh.exe", "powershell.exe", "cmd.exe"]
      : [env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = resolveExecutable(candidate, env, deps);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error("Could not resolve a usable shell executable");
};

const parseNullDelimitedEnv = (output: Buffer): Record<string, string> => {
  const parsed: Record<string, string> = {};
  for (const entry of output.toString("utf-8").split("\0")) {
    if (!entry) {
      continue;
    }
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = entry.slice(0, separatorIndex);
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      continue;
    }
    parsed[key] = entry.slice(separatorIndex + 1);
  }
  return parsed;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
};

const captureLoginShellEnv = (
  shell: string,
  baseEnv: Record<string, string>,
): Promise<Record<string, string>> => {
  return new Promise((resolve, reject) => {
    execFile(
      shell,
      ["-lic", "/usr/bin/env -0"],
      {
        env: baseEnv,
        encoding: "buffer",
        maxBuffer: 1024 * 1024 * 4,
        timeout: 10_000,
      },
      (error, stdout) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          return;
        }
        resolve(parseNullDelimitedEnv(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)));
      },
    );
  });
};

let cachedShellEnvPromise: Promise<Record<string, string>> | null = null;

const isExecutable = (file: string): boolean => {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const defaultDeps: LaunchResolverDeps = {
  platform: process.platform,
  pathDelimiter: path.delimiter,
  existsSync: (file) => fs.existsSync(file),
  isExecutable,
  getShellEnv: async () => {
    if (cachedShellEnvPromise) {
      return cachedShellEnvPromise;
    }

    const baseEnv = sanitizeLoginShellSeedEnv(process.env, {
      platform: process.platform,
      pathDelimiter: path.delimiter,
    });

    if (process.platform === "win32") {
      return baseEnv;
    }

    const shell = resolveUserShell(baseEnv, {
      platform: process.platform,
      pathDelimiter: path.delimiter,
      existsSync: (file) => fs.existsSync(file),
      isExecutable,
    });

    cachedShellEnvPromise = captureLoginShellEnv(shell, baseEnv)
      .then((loginEnv) =>
        sanitizeEnv(loginEnv, {
          platform: process.platform,
          pathDelimiter: path.delimiter,
        }),
      )
      .catch((error: unknown) => {
        console.warn(
          `[casprFlowOS] Failed to capture login shell environment via ${shell}; falling back to process env.`,
          error,
        );
        return baseEnv;
      });

    return cachedShellEnvPromise;
  },
};

const applyThemeHints = (
  env: Record<string, string>,
  theme: "dark" | "light" | undefined,
): void => {
  if (!theme) {
    return;
  }

  env.CASPRFLOWOS_THEME = theme;
  env.COLORFGBG = theme === "dark" ? "15;0" : "0;15";
};

export const buildLaunchSpec = async (
  options: PtyLaunchOptions,
  deps: LaunchResolverDeps = defaultDeps,
): Promise<PtyResolvedLaunchSpec> => {
  if (!deps.existsSync(options.cwd)) {
    throw new Error(`Directory does not exist: ${options.cwd}`);
  }

  const shellEnv = sanitizeEnv(await deps.getShellEnv(), deps);

  if (options.terminalId) {
    shellEnv.CASPRFLOWOS_TERMINAL_ID = options.terminalId;
  }
  applyThemeHints(shellEnv, options.theme);

  if (options.envOverrides) {
    for (const [key, value] of Object.entries(options.envOverrides)) {
      if (value === undefined) {
        delete shellEnv[key];
      } else {
        shellEnv[key] = value;
      }
    }
  }

  const launchArgs = [...(options.args ?? [])];

  if (options.extraPathEntries?.length) {
    const entries = (shellEnv.PATH ?? "").split(deps.pathDelimiter);
    for (const dir of options.extraPathEntries) {
      if (!pathEntryExists(entries, dir, deps.platform)) {
        entries.unshift(dir);
      }
    }
    shellEnv.PATH = entries.join(deps.pathDelimiter);
  }

  if (options.shell) {
    const executable = resolveExecutable(options.shell, shellEnv, deps);
    if (!executable) {
      throw new PtyLaunchError(
        "executable-not-found",
        `Executable not found: ${options.shell}`,
        options.shell,
      );
    }

    if (isWindowsBatchScript(executable, deps.platform)) {
      const commandShell = resolveExecutable(shellEnv.ComSpec ?? "cmd.exe", shellEnv, deps);
      if (!commandShell) {
        throw new Error("Could not resolve cmd.exe for Windows batch launch");
      }

      return {
        cwd: options.cwd,
        file: commandShell,
        args: ["/d", "/s", "/c", executable, ...launchArgs],
        env: shellEnv,
      };
    }

    return {
      cwd: options.cwd,
      file: executable,
      args: launchArgs,
      env: shellEnv,
    };
  }

  const shell = resolveUserShell(shellEnv, deps);
  return {
    cwd: options.cwd,
    file: shell,
    args: deps.platform === "win32" ? launchArgs : ["-l", ...launchArgs],
    env: shellEnv,
  };
};
