import type { ReactElement, ReactNode } from "react";
import { createTerminalInScene } from "../actions/terminalSceneActions";
import { useProjectStore } from "../stores/projectStore";
import { TERMINAL_TYPE_CONFIG } from "../terminal/terminalTypeConfig";
import type { AppId } from "../types";

/*
 * Shared agent definitions + branded app-style icons, used by both the
 * AgentDock (quick row) and the AgentLauncher (Cmd-P-style picker).
 */

export interface AgentDef {
  type: AppId;
  label: string;
  description: string;
}

// Quick-access dock row (favourites).
export const DOCK_AGENTS: AgentDef[] = [
  { type: "claude", label: "Claude", description: "Anthropic Claude Code" },
  { type: "codex", label: "Codex", description: "OpenAI Codex CLI" },
  { type: "gemini", label: "Gemini", description: "Google Gemini CLI" },
  { type: "shell", label: "Terminal", description: "Plain shell" },
];

// Full list shown in the launcher.
export const ALL_AGENTS: AgentDef[] = [
  { type: "claude", label: "Claude", description: "Anthropic Claude Code" },
  { type: "codex", label: "Codex", description: "OpenAI Codex CLI" },
  { type: "gemini", label: "Gemini", description: "Google Gemini CLI" },
  { type: "kimi", label: "Kimi", description: "Moonshot Kimi" },
  { type: "opencode", label: "OpenCode", description: "OpenCode agent" },
  { type: "shell", label: "Terminal", description: "Plain shell" },
  { type: "browser", label: "Browser", description: "Portable web browser" },
];

const AGENT_BY_TYPE = new Map(ALL_AGENTS.map((a) => [a.type, a]));

export function getAgentDef(type: AppId): AgentDef {
  const known = AGENT_BY_TYPE.get(type);
  if (known) return known;
  const cfg = type === "browser" ? undefined : TERMINAL_TYPE_CONFIG[type];
  return { type, label: cfg?.label ?? type, description: "" };
}

function Tile({
  bg,
  ring = "rgba(255,255,255,0.14)",
  children,
}: {
  bg: string;
  ring?: string;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        borderRadius: 13,
        background: bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px ${ring}, 0 6px 14px -6px rgba(0,0,0,0.6)`,
      }}
    >
      {children}
    </span>
  );
}

function ClaudeIcon() {
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <Tile bg="linear-gradient(160deg,#D97757 0%,#C45D3A 100%)" ring="rgba(0,0,0,0.18)">
      <svg width="56%" height="56%" viewBox="0 0 24 24">
        <g stroke="#1a0f0a" strokeWidth="1.7" strokeLinecap="round" opacity="0.92">
          {rays.map((deg) => (
            <line key={deg} x1="12" y1="12" x2="12" y2="3.2" transform={`rotate(${deg} 12 12)`} />
          ))}
        </g>
      </svg>
    </Tile>
  );
}

function CodexIcon() {
  return (
    <Tile bg="linear-gradient(160deg,#1f2023 0%,#0c0c0e 100%)">
      <svg width="56%" height="56%" viewBox="0 0 24 24" fill="none">
        <g stroke="#ededed" strokeWidth="1.6" strokeLinecap="round">
          {[0, 60, 120].map((deg) => (
            <ellipse key={deg} cx="12" cy="12" rx="3.4" ry="8.4" transform={`rotate(${deg} 12 12)`} />
          ))}
        </g>
      </svg>
    </Tile>
  );
}

function GeminiIcon() {
  return (
    <Tile bg="linear-gradient(160deg,#2b6fff 0%,#7b53ff 100%)" ring="rgba(0,0,0,0.15)">
      <svg width="56%" height="56%" viewBox="0 0 24 24">
        <path
          d="M12 1.5c.2 5.3 4.9 10 10.5 10.5C16.9 12.5 12.2 17.2 12 22.5 11.8 17.2 7.1 12.5 1.5 12 7.1 11.5 11.8 6.8 12 1.5Z"
          fill="#ffffff"
        />
      </svg>
    </Tile>
  );
}

function ShellIcon() {
  return (
    <Tile bg="linear-gradient(160deg,#23262b 0%,#101113 100%)">
      <svg width="56%" height="56%" viewBox="0 0 24 24" fill="none">
        <path d="M6 8.5 10 12l-4 3.5" stroke="#4ade80" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 16h5.5" stroke="#4ade80" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </Tile>
  );
}

function BrowserIcon() {
  return (
    <Tile bg="linear-gradient(160deg,#3a8bff 0%,#1f5fd6 100%)" ring="rgba(0,0,0,0.16)">
      <svg width="58%" height="58%" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#ffffff" strokeWidth="1.7" />
        <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#ffffff" strokeWidth="1.5" />
        <path d="M3 12h18" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    </Tile>
  );
}

export function DrawerIcon() {
  const dots = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c })));
  return (
    <Tile bg="linear-gradient(160deg,#26282d 0%,#121317 100%)">
      <svg width="56%" height="56%" viewBox="0 0 24 24">
        {dots.map(({ r, c }) => (
          <rect
            key={`${r}-${c}`}
            x={4 + c * 6.5}
            y={4 + r * 6.5}
            width="4"
            height="4"
            rx="1.4"
            fill="rgba(255,255,255,0.78)"
          />
        ))}
      </svg>
    </Tile>
  );
}

const AGENT_ICONS: Partial<Record<AppId, () => ReactElement>> = {
  claude: ClaudeIcon,
  codex: CodexIcon,
  gemini: GeminiIcon,
  shell: ShellIcon,
  browser: BrowserIcon,
};

function FallbackIcon({ type }: { type: AppId }) {
  const cfg =
    (type === "browser" ? undefined : TERMINAL_TYPE_CONFIG[type]) ?? {
      color: "#888",
      label: type,
    };
  return (
    <Tile bg="linear-gradient(160deg,#23262b 0%,#101113 100%)">
      <span
        style={{
          color: cfg.color,
          fontWeight: 700,
          fontSize: "44%",
          fontFamily: '"Geist Mono", monospace',
          textTransform: "uppercase",
        }}
      >
        {cfg.label.slice(0, 2)}
      </span>
    </Tile>
  );
}

export function AgentGlyph({ type }: { type: AppId }) {
  const Icon = AGENT_ICONS[type];
  return Icon ? <Icon /> : <FallbackIcon type={type} />;
}

// Spawn a window (agent or browser) onto the canvas. The browser is just
// another terminal type, so it flows through the same placement/arrange path.
// Falls back to the focused worktree (or the first project's first worktree)
// and no-ops if nothing is open yet.
export function spawnAgent(type: AppId): boolean {
  const { projects, focusedProjectId, focusedWorktreeId } =
    useProjectStore.getState();

  let projectId = focusedProjectId;
  let worktreeId = focusedWorktreeId;

  const focusValid =
    projectId !== null &&
    worktreeId !== null &&
    projects.some(
      (p) => p.id === projectId && p.worktrees.some((w) => w.id === worktreeId),
    );

  if (!focusValid) {
    const project = projects[0];
    const worktree = project?.worktrees[0];
    if (!project || !worktree) return false;
    projectId = project.id;
    worktreeId = worktree.id;
  }

  createTerminalInScene({
    projectId: projectId!,
    worktreeId: worktreeId!,
    type,
    origin: "agent",
  });
  return true;
}
