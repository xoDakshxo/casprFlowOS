import { useCallback } from "react";
import type { CSSProperties } from "react";
import { promptAndAddProjectToScene } from "../canvas/sceneCommands";
import { useT } from "../i18n/useT";
import { formatShortcut, useShortcutStore } from "../stores/shortcutStore";

const platform = window.casprFlowOS?.app.platform ?? "darwin";
const isMac = platform === "darwin";

const STAGGER_STYLE: CSSProperties = {
  // Slower than the default 30ms — the cascade is the moment, not a
  // decorative flourish behind a list. Each tier should land deliberately.
  ["--cf-stagger-step" as string]: "60ms",
};

interface CanvasEmptyStateProps {
  isDragOver?: boolean;
}

export function CanvasEmptyState({ isDragOver = false }: CanvasEmptyStateProps) {
  const t = useT();
  const shortcut = useShortcutStore((s) => s.shortcuts.addProject);
  const shortcutLabel = formatShortcut(shortcut, isMac);

  const handleOpen = useCallback(() => {
    void promptAndAddProjectToScene(t);
  }, [t]);

  return (
    <div
      className="absolute inset-0 flex justify-center pointer-events-none select-none"
      style={{ paddingTop: "30vh" }}
    >
      <div
        className="cf-stagger pointer-events-auto"
        style={{ ...STAGGER_STYLE, width: "min(360px, 80vw)" }}
      >
        <div
          className="cf-enter-fade-up cf-eyebrow"
          style={{ color: "var(--text-faint)", marginBottom: 20 }}
        >
          {t.canvas_empty_eyebrow}
        </div>
        <div
          className="cf-enter-fade-up cf-hero"
          style={{ color: "var(--text-secondary)" }}
        >
          {t.canvas_empty_line_lead}
        </div>
        <div
          className="cf-enter-fade-up cf-hero"
          style={{ color: "var(--text-primary)", marginBottom: 32 }}
        >
          {t.canvas_empty_line_call}
        </div>
        <div
          className="cf-enter-fade-up cf-mono flex items-center gap-3"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          <span
            className="cf-canvas-empty-drag-hint"
            data-dragover={isDragOver ? "true" : "false"}
          >
            {t.canvas_empty_drag_hint}
          </span>
          <span aria-hidden style={{ color: "var(--text-faint)" }}>
            ·
          </span>
          <span>{t.canvas_empty_or}</span>
          <button
            type="button"
            className="cf-kbd"
            data-dragover={isDragOver ? "true" : "false"}
            onClick={handleOpen}
            aria-label={t.canvas_empty_action}
          >
            {shortcutLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
