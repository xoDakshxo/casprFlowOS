import type { WebContents } from "electron";
import * as pty from "node-pty";

import { buildLaunchSpec } from "./pty-launch";

export interface TerminalCreateInput {
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
  readonly shell?: string;
  readonly args?: readonly string[];
  readonly terminalId?: string;
  readonly theme?: "dark" | "light";
  readonly casprFlowOSPtyId?: number;
}

export interface TerminalCreateResult {
  readonly id: string;
}

interface TerminalRecord {
  readonly process: pty.IPty;
  readonly owner: WebContents;
}

const RETRYABLE_PTY_SPAWN_ERRORS = [
  /posix_spawnp failed/i,
  /forkpty\(3\) failed/i,
  /device not configured/i,
] as const;

const MAX_PTY_CREATE_ATTEMPTS = 3;

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const isRetryablePtySpawnError = (error: unknown): boolean => {
  const message = toErrorMessage(error);
  return RETRYABLE_PTY_SPAWN_ERRORS.some((pattern) => pattern.test(message));
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class TerminalService {
  readonly #terminals = new Map<string, TerminalRecord>();
  #nextTerminalId = 1;

  async create(input: TerminalCreateInput, owner: WebContents): Promise<TerminalCreateResult> {
    const id = `pty:${this.#nextTerminalId}`;
    this.#nextTerminalId += 1;
    const launchOptions = {
      cwd: input.cwd,
      terminalId: input.terminalId ?? id,
      theme: input.theme ?? "dark",
      ...(input.shell ? { shell: input.shell } : {}),
      ...(input.args ? { args: input.args } : {}),
    };
    const launch = await buildLaunchSpec(launchOptions);

    let terminal: pty.IPty | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_PTY_CREATE_ATTEMPTS; attempt += 1) {
      try {
        terminal = pty.spawn(launch.file, launch.args, {
          name: "xterm-256color",
          cols: input.cols,
          rows: input.rows,
          cwd: launch.cwd,
          env: launch.env,
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_PTY_CREATE_ATTEMPTS || !isRetryablePtySpawnError(error)) {
          throw new Error(
            `Failed to spawn "${launch.file}" in "${launch.cwd}": ${toErrorMessage(error)}`,
          );
        }

        console.warn(
          `[TerminalService] transient PTY spawn failure on attempt ${attempt}/${MAX_PTY_CREATE_ATTEMPTS}: ${toErrorMessage(error)}`,
        );
        await sleep(attempt * 50);
      }
    }

    if (!terminal) {
      throw new Error(
        `Failed to spawn "${launch.file}" in "${launch.cwd}": ${toErrorMessage(lastError)}`,
      );
    }

    // The window can be torn down (quit/close) while pty data is still draining.
    // isDestroyed() can race with the actual teardown, so also guard with try/catch
    // — an uncaught throw here would crash the whole app.
    const safeSend = (channel: string, ...payload: readonly unknown[]): void => {
      if (owner.isDestroyed()) {
        return;
      }
      try {
        owner.send(channel, ...payload);
      } catch {
        // webContents went away mid-send; nothing to do.
      }
    };

    terminal.onData((data) => {
      safeSend("terminal:data", { id, data });
      if (typeof input.casprFlowOSPtyId === "number") {
        safeSend("terminal:output", input.casprFlowOSPtyId, data);
      }
    });
    terminal.onExit(({ exitCode, signal }) => {
      safeSend("terminal:exit", { id, exitCode, signal });
      if (typeof input.casprFlowOSPtyId === "number") {
        safeSend("terminal:exit", input.casprFlowOSPtyId, exitCode);
      }
      this.#terminals.delete(id);
    });

    // When the owning window is gone, kill the pty so it stops emitting at all.
    owner.once("destroyed", () => {
      this.kill(id);
    });

    this.#terminals.set(id, { process: terminal, owner });
    return { id };
  }

  write(id: string, data: string): void {
    const terminal = this.#terminals.get(id);
    terminal?.process.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const terminal = this.#terminals.get(id);
    try {
      terminal?.process.resize(cols, rows);
    } catch {
      this.#terminals.delete(id);
    }
  }

  kill(id: string): void {
    const terminal = this.#terminals.get(id);
    if (!terminal) {
      return;
    }

    try {
      terminal.process.kill();
    } catch {
      // The pty may already be gone; the map cleanup below is still correct.
    }
    this.#terminals.delete(id);
  }

  killAll(): void {
    for (const id of this.#terminals.keys()) {
      this.kill(id);
    }
  }
}
