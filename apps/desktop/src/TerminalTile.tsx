import type { CanvasPoint, CanvasWindowStatus, Id } from "@casprflowos/shared";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export interface TerminalTileModel {
  readonly windowId: Id<"window">;
  readonly ptyId: string;
  readonly callsign: string;
  readonly agentLabel: string;
  readonly projectName: string;
  readonly worktreeName: string;
  readonly position: CanvasPoint;
  readonly size: { readonly width: number; readonly height: number };
  readonly focused: boolean;
  readonly status: CanvasWindowStatus;
}

export type TerminalWriter = (data: string) => void;

interface TerminalTileProps {
  readonly model: TerminalTileModel;
  readonly zoom: number;
  readonly onFocus: (windowId: Id<"window">) => void;
  readonly onClose: (model: TerminalTileModel) => void;
  readonly onDragMove: (windowId: Id<"window">, position: CanvasPoint) => void;
  /** Register an xterm writer for this pty; returns an unregister fn. */
  readonly registerWriter: (ptyId: string, writer: TerminalWriter) => () => void;
}

const MONO_STACK =
  '"SFMono-Regular", "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

const XTERM_THEME = {
  // Transparent so the tile's glass surface shows through behind the text.
  background: "rgba(0, 0, 0, 0)",
  foreground: "#e7eeff",
  cursor: "#6ea8ff",
  cursorAccent: "#0b0d12",
  selectionBackground: "rgba(110, 168, 255, 0.32)",
  black: "#0b0d12",
  brightBlack: "#5b6577",
} as const;

const STATUS_LABEL: Record<CanvasWindowStatus, string> = {
  idle: "idle",
  running: "running",
  waiting: "waiting",
  done: "exited",
  error: "error",
};

export const TerminalTile = ({
  model,
  zoom,
  onFocus,
  onClose,
  onDragMove,
  registerWriter,
}: TerminalTileProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Create the xterm instance once and wire it to the pty (data both ways).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const term = new Terminal({
      allowTransparency: true,
      convertEol: false,
      cursorBlink: true,
      fontFamily: MONO_STACK,
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: XTERM_THEME,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(mount);
    fit.fit();

    // User keystrokes → pty.
    const keyListener = term.onData((data) => {
      void window.casprFlowOS.terminal.write(model.ptyId, data);
    });

    // pty output → xterm.
    const unregister = registerWriter(model.ptyId, (data) => term.write(data));

    const syncSize = (): void => {
      fit.fit();
      void window.casprFlowOS.terminal.resize(model.ptyId, term.cols, term.rows);
    };
    syncSize();

    const observer = new ResizeObserver(() => syncSize());
    observer.observe(mount);

    return () => {
      observer.disconnect();
      keyListener.dispose();
      unregister();
      term.dispose();
    };
  }, [model.ptyId, registerWriter]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    // Ignore drags that begin on a button (e.g. Close).
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    event.stopPropagation();
    onFocus(model.windowId);

    const origin = model.position;
    const startX = event.clientX;
    const startY = event.clientY;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent): void => {
      onDragMove(model.windowId, {
        x: origin.x + (moveEvent.clientX - startX) / zoom,
        y: origin.y + (moveEvent.clientY - startY) / zoom,
      });
    };
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
  };

  return (
    <section
      className={model.focused ? "terminal-tile glass is-focused" : "terminal-tile glass"}
      style={{
        transform: `translate(${model.position.x}px, ${model.position.y}px)`,
        width: model.size.width,
        height: model.size.height,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onFocus(model.windowId);
      }}
    >
      <header className="terminal-header" onPointerDown={startDrag}>
        <div className="terminal-id">
          <strong>{model.callsign}</strong>
          <span>
            {model.agentLabel} · {model.worktreeName}
          </span>
        </div>
        <div className="terminal-meta">
          <span className={`status-dot status-${model.status}`} />
          <small>{STATUS_LABEL[model.status]}</small>
          <button type="button" className="tile-close" onClick={() => onClose(model)}>
            Close
          </button>
        </div>
      </header>
      <div className="terminal-surface" ref={mountRef} />
    </section>
  );
};
