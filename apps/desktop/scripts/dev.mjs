#!/usr/bin/env node
/*
 * Dev runner with a clean shutdown.
 *
 * `vite-plugin-electron` launches Electron as a child of Vite, and the app
 * spawns node-pty shells under Electron. A plain Ctrl-C on Vite routinely
 * orphans the Electron helpers and PTY shells, which then pile up and stop the
 * dev server from refreshing.
 *
 * This wrapper runs Vite in its OWN process group (detached) so that typing
 * `exit` (or `q` / `quit`), pressing Ctrl-C, or Vite itself dying tears down the
 * entire tree:
 *   1. signal the whole process group (Vite + Electron + helpers + esbuild),
 *   2. force-kill anything left,
 *   3. as a safety net, reap any orphaned Electron for THIS project — when the
 *      Electron main dies its PTY masters close, so the agent shells get SIGHUP
 *      and exit too.
 */
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(appDir, "node_modules", ".bin", "vite");

// `.bin/vite` is an executable shim (it `exec`s node with vite's entry), so we
// run it directly rather than via `node`.
const child = spawn(viteBin, [], {
  cwd: appDir,
  stdio: ["ignore", "inherit", "inherit"],
  detached: true, // new process group so we can kill the whole tree at once
  env: process.env,
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(
    "\n[dev] shutting down — stopping Vite, Electron and all child processes…\n",
  );

  // 1) polite stop of the whole process group (negative pid = the group)
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* group already gone */
  }

  setTimeout(() => {
    // 2) force-kill the group
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* already gone */
    }

    // 3) safety net: reap orphaned Electron / esbuild for THIS project. These
    //    patterns never match this Node wrapper, so we can't kill ourselves.
    //    Case-insensitive so it covers casprFlowOS and casprflowos paths.
    const patterns = [
      "casprflowos/node_modules/.pnpm/electron@",
      "casprflowos/node_modules/.pnpm/@esbuild",
    ];
    for (const p of patterns) {
      try {
        execSync(`pkill -9 -i -f ${JSON.stringify(p)}`, { stdio: "ignore" });
      } catch {
        /* no matches — fine */
      }
    }

    process.exit(code);
  }, 1200);
}

// `exit` / `quit` / `q` on stdin — only when attached to an interactive
// terminal. In non-interactive shells (CI, backgrounded) stdin is already at
// EOF, so we skip it and rely on signals instead.
if (process.stdin.isTTY) {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (buf) => {
    const cmd = String(buf).trim().toLowerCase();
    if (cmd === "exit" || cmd === "quit" || cmd === "q") shutdown(0);
  });
}

// If Vite exits on its own, follow it down.
child.on("exit", (code) => shutdown(typeof code === "number" ? code : 0));

// Ctrl-C / terminal close hit this wrapper (Vite is in a separate group).
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => shutdown(0));
}

process.stdout.write(
  "[dev] Vite + Electron starting. Type 'exit' (or press Ctrl-C) to quit and kill all processes.\n",
);
