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
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
    >
      {/* Rounded dark-glass pane behind the casprOS branding. */}
      <div
        className="cf-stagger cf-enter-fade-up pointer-events-auto flex flex-col items-center text-center"
        style={{
          ...STAGGER_STYLE,
          gap: 12,
          padding: "38px 48px 30px",
          borderRadius: 22,
          backgroundColor: "var(--glass-pane)",
          border: "1px solid var(--glass-edge-soft)",
          boxShadow:
            "inset 0 1px 0 var(--glass-edge), 0 28px 80px -24px rgba(0,0,0,0.6)",
          maxWidth: "min(420px, 86vw)",
        }}
      >
        {/* casprOS mark — no box; the pane is the only surface. */}
        <img
          src="/casprlogo.svg"
          alt="casprOS"
          width={58}
          height={58}
          draggable={false}
          style={{ opacity: 0.95 }}
        />
        <div className="cf-eyebrow" style={{ color: "var(--text-muted)" }}>
          {t.canvas_empty_eyebrow}
        </div>
        <div>
          <div className="cf-hero" style={{ color: "var(--text-secondary)" }}>
            {t.canvas_empty_line_lead}
          </div>
          <div className="cf-hero" style={{ color: "var(--text-primary)" }}>
            {t.canvas_empty_line_call}
          </div>
        </div>
        <button
          type="button"
          className="cf-canvas-empty-cta cf-mono"
          data-dragover={isDragOver ? "true" : "false"}
          onClick={handleOpen}
          aria-label={t.canvas_empty_action}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            cursor: "pointer",
          }}
        >
          <span>{t.canvas_empty_drag_hint}</span>
          <span aria-hidden style={{ color: "var(--text-faint)" }}>
            ·
          </span>
          <span>{t.canvas_empty_or}</span>
          <kbd className="cf-kbd" style={{ pointerEvents: "none" }}>
            {shortcutLabel}
          </kbd>
          {/* Arrow nudging toward the action. */}
          <span
            aria-hidden
            className="cf-canvas-empty-arrow"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            →
          </span>
        </button>
      </div>
    </div>
  );
}
