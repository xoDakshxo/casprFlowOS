import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { useCanvasToolStore } from "../stores/canvasToolStore";
import { getCanvasRightInset } from "../canvas/viewportBounds";
import { usePinStore } from "../stores/pinStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import {
  fitAllProjects,
  setZoomToHundred,
  stepZoomAtCenter,
} from "../canvas/zoomActions";
import {
  arrangeFocusedWorktree,
  type ArrangeLayout,
} from "../canvas/arrangeActions";
import {
  clampScale,
  getViewportCenterClientPoint,
  zoomAtClientPoint,
} from "../canvas/viewportZoom";
import { TOOLBAR_HEIGHT } from "./toolbarHeight";
import { useT } from "../i18n/useT";

// ComposerBar sits at `bottom-4` (16 px). Its height varies — single
// line vs multi-line vs with image attachments vs rename mode — so a
// hard-coded estimate gets the toolbar covered the moment composer
// content grows. ComposerBar publishes its measured height to
// `--composer-height` and we read it here, falling back to a safe
// default for the brief moment before measurement, and to a smaller
// constant when composer is disabled entirely.
const COMPOSER_GAP = 8;
const COMPOSER_BOTTOM_INSET = 16;
const COMPOSER_FALLBACK_HEIGHT = 120;
const BOTTOM_OFFSET_PLAIN = 20;

const PILL_BG = "bg-[var(--glass-pill)]";
const PILL_BORDER = "border border-[var(--border)]";
const PILL_SHADOW =
  "shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--shadow-color)_36%,transparent),0_2px_6px_-2px_color-mix(in_srgb,var(--shadow-color)_24%,transparent)]";

const groupBase = "flex items-center";
const dividerCls =
  "h-4 w-px bg-[color-mix(in_srgb,var(--border)_72%,transparent)] mx-0.5";
const buttonBase =
  "inline-flex h-8 items-center justify-center rounded-md text-[12px] font-medium text-[var(--text-muted)] transition-[color,background-color,transform] duration-quick hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--text-primary)] active:scale-[0.97] focus-visible:outline-none motion-reduce:transition-none";
const iconButton = `${buttonBase} w-8`;
const zoomReadout =
  "min-w-[3.25rem] h-8 inline-flex items-center justify-center text-[11px] text-[var(--text-muted)] tabular-nums rounded-md hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--text-primary)] transition-colors";

const platform = window.casprFlowOS?.app.platform ?? "darwin";
const isMac = platform === "darwin";

// One source of truth for the shortcut text shown in this toolbar's
// menus. Keep aligned with the bindings registered in
// useKeyboardShortcuts.ts (Cmd+0 fits, Cmd+1 = 100%, etc.).
const KEY_HINT = {
  fit: isMac ? "⌘0" : "Ctrl 0",
  zoom100: isMac ? "⌘1" : "Ctrl 1",
};

type ZoomPreset = {
  scale: number;
  label: string;
  hint?: string;
};

const ZOOM_PRESETS: ZoomPreset[] = [
  { scale: 0.5, label: "50%" },
  { scale: 1, label: "100%", hint: KEY_HINT.zoom100 },
  { scale: 2, label: "200%" },
];

const ARRANGE_OPTIONS: { layout: ArrangeLayout; label: string; hint: string }[] =
  [
    { layout: "grid", label: "Grid", hint: "▦" },
    { layout: "columns", label: "Columns", hint: "▥" },
    { layout: "rows", label: "Rows", hint: "▤" },
  ];

function useCloseOnOutsideClick(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
        // Don't restore focus to the trigger on mouse outside-click.
        // Doing so would leave a toolbar button as e.target for the next
        // keydown, causing isActivationTarget to block Space-to-pan.
        // Keyboard close (Escape) is handled by usePopoverKeyboardNav
        // which does return focus to the trigger there.
      }
    };
    window.addEventListener("mousedown", handle, true);
    return () => window.removeEventListener("mousedown", handle, true);
  }, [open, ref, close]);
}

// Roving-focus keyboard nav for popover menus. Caller passes a ref to
// the popover container, the trigger button (so we can return focus
// when Esc closes the menu), and an item count for arrow-key wrap.
function usePopoverKeyboardNav({
  open,
  popoverRef,
  triggerRef,
  itemCount,
  initialIndex = 0,
  close,
}: {
  open: boolean;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  itemCount: number;
  initialIndex?: number;
  close: () => void;
}): void {
  useEffect(() => {
    if (!open) return;
    const popover = popoverRef.current;
    if (!popover) return;

    const items = () =>
      Array.from(popover.querySelectorAll<HTMLElement>("[data-popover-item]"));

    // Focus the requested item once mounted (rAF lets the popover
    // paint first, otherwise focus flashes briefly to the trigger).
    const raf = requestAnimationFrame(() => {
      const list = items();
      list[Math.min(initialIndex, Math.max(0, list.length - 1))]?.focus();
    });

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = items();
      if (list.length === 0) return;
      const current = list.findIndex((el) => el === document.activeElement);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const fallback = e.key === "ArrowDown" ? 0 : list.length - 1;
      const next =
        current < 0 ? fallback : (current + delta + list.length) % list.length;
      list[next].focus();
    };

    window.addEventListener("keydown", handler);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handler);
    };
  }, [open, popoverRef, triggerRef, itemCount, initialIndex, close]);
}

export function BottomToolbar() {
  const t = useT();
  const viewport = useCanvasStore((s) => s.viewport);
  const composerEnabled = usePreferencesStore((s) => s.composerEnabled);
  const tool = useCanvasToolStore((s) => s.tool);
  const setTool = useCanvasToolStore((s) => s.setTool);
  const rightPanelCollapsed = useCanvasStore((s) => s.rightPanelCollapsed);
  const rightPanelWidth = useCanvasStore((s) => s.rightPanelWidth);
  const rightInset = getCanvasRightInset(rightPanelCollapsed, rightPanelWidth);

  const [presetOpen, setPresetOpen] = useState(false);
  const presetWrapperRef = useRef<HTMLDivElement>(null);
  const presetPopoverRef = useRef<HTMLDivElement>(null);
  const presetTriggerRef = useRef<HTMLButtonElement>(null);

  const closePresetMenu = useCallback(() => setPresetOpen(false), []);
  const togglePresetMenu = useCallback(
    () => setPresetOpen((prev) => !prev),
    [],
  );

  useCloseOnOutsideClick(presetOpen, presetWrapperRef, closePresetMenu);

  usePopoverKeyboardNav({
    open: presetOpen,
    popoverRef: presetPopoverRef,
    triggerRef: presetTriggerRef,
    // +1 for the Reset row appended after the presets.
    itemCount: ZOOM_PRESETS.length + 1,
    close: closePresetMenu,
  });

  const [arrangeOpen, setArrangeOpen] = useState(false);
  const arrangeWrapperRef = useRef<HTMLDivElement>(null);
  const arrangePopoverRef = useRef<HTMLDivElement>(null);
  const arrangeTriggerRef = useRef<HTMLButtonElement>(null);
  const closeArrangeMenu = useCallback(() => setArrangeOpen(false), []);

  useCloseOnOutsideClick(arrangeOpen, arrangeWrapperRef, closeArrangeMenu);
  usePopoverKeyboardNav({
    open: arrangeOpen,
    popoverRef: arrangePopoverRef,
    triggerRef: arrangeTriggerRef,
    itemCount: ARRANGE_OPTIONS.length,
    close: closeArrangeMenu,
  });

  const applyPreset = useCallback((nextScale: number) => {
    if (nextScale === 1) {
      setZoomToHundred();
      return;
    }
    const {
      leftPanelCollapsed,
      leftPanelWidth,
      rightPanelCollapsed,
      rightPanelWidth,
      viewport: current,
    } = useCanvasStore.getState();
    const taskDrawerOpen = usePinStore.getState().openProjectPath !== null;
    const center = getViewportCenterClientPoint({
      leftPanelCollapsed,
      leftPanelWidth,
      rightPanelCollapsed,
      rightPanelWidth,
      taskDrawerOpen,
      topInset: TOOLBAR_HEIGHT,
    });
    useCanvasStore.getState().setViewport(
      zoomAtClientPoint({
        clientX: center.x,
        clientY: center.y,
        leftPanelCollapsed,
        leftPanelWidth,
        taskDrawerOpen,
        nextScale: clampScale(nextScale),
        viewport: current,
      }),
    );
  }, []);

  const zoomPercent = Math.round(viewport.scale * 100);

  // When composer is enabled, sit just above its measured height
  // (published as `--composer-height`). The fallback covers the brief
  // moment between mount and first ResizeObserver tick.
  const bottomOffset = composerEnabled
    ? `calc(${COMPOSER_BOTTOM_INSET}px + var(--composer-height, ${COMPOSER_FALLBACK_HEIGHT}px) + ${COMPOSER_GAP}px)`
    : `${BOTTOM_OFFSET_PLAIN}px`;

  return (
    <div
      className="fixed z-[95] pointer-events-none"
      style={{ bottom: bottomOffset, right: rightInset + 16 }}
    >
      <div
        className={`pointer-events-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 ${PILL_BG} ${PILL_BORDER} ${PILL_SHADOW}`}
      >
        <div className={groupBase}>
          <button
            className={`${iconButton} ${
              tool === "select"
                ? "bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] text-[var(--text-primary)]"
                : ""
            }`}
            onClick={() => setTool("select")}
            title={"Select"}
            aria-label={"Select"}
            aria-pressed={tool === "select"}
          >
            {/* Arrow cursor */}
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 2.5l9 4.2-3.7 1.2-1.2 3.7L3 2.5z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className={`${iconButton} ${
              tool === "hand"
                ? "bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] text-[var(--text-primary)]"
                : ""
            }`}
            onClick={() => setTool("hand")}
            title={"Pan"}
            aria-label={"Pan"}
            aria-pressed={tool === "hand"}
          >
            {/* Hand */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 7V4.2a1 1 0 012 0V7m0 0V3.2a1 1 0 012 0V7m0 0V4.2a1 1 0 012 0V8m0-1.3a1 1 0 012 0V10c0 2.2-1.8 4-4 4H8.6c-1 0-1.9-.4-2.6-1.1L3.4 10.3a1 1 0 011.3-1.5L6 9.8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div aria-hidden="true" className={dividerCls} />

        <div className={groupBase}>
          <button
            className={iconButton}
            onClick={() => stepZoomAtCenter("out")}
            title={t.zoom_out}
            aria-label={t.zoom_out}
          >
            <span className="text-[14px] leading-none">−</span>
          </button>

          <div className="relative" ref={presetWrapperRef}>
            <button
              ref={presetTriggerRef}
              className={zoomReadout}
              onClick={togglePresetMenu}
              title={t.canvas_zoom_to}
              aria-haspopup="menu"
              aria-expanded={presetOpen}
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              {zoomPercent}%
            </button>
            {presetOpen && (
              <div
                ref={presetPopoverRef}
                role="menu"
                aria-label={t.canvas_zoom_to}
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[140px] rounded-md py-1 ${PILL_BG} ${PILL_BORDER} ${PILL_SHADOW}`}
              >
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset.scale}
                    data-popover-item
                    role="menuitem"
                    tabIndex={-1}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] focus:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--text-primary)] focus:text-[var(--text-primary)] focus:outline-none"
                    onClick={() => {
                      applyPreset(preset.scale);
                      closePresetMenu();
                    }}
                  >
                    <span>{preset.label}</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {preset.hint ?? ""}
                    </span>
                  </button>
                ))}
                <div className="my-1 h-px bg-[var(--border)] opacity-60" />
                <button
                  data-popover-item
                  role="menuitem"
                  tabIndex={-1}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] focus:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--text-primary)] focus:text-[var(--text-primary)] focus:outline-none"
                  onClick={() => {
                    useCanvasStore.getState().resetViewport();
                    closePresetMenu();
                  }}
                >
                  <span>{t.reset}</span>
                </button>
              </div>
            )}
          </div>

          <button
            className={iconButton}
            onClick={() => stepZoomAtCenter("in")}
            title={t.zoom_in}
            aria-label={t.zoom_in}
          >
            <span className="text-[14px] leading-none">+</span>
          </button>
        </div>

        <div aria-hidden="true" className={dividerCls} />

        <button
          className={`${buttonBase} px-2.5`}
          onClick={fitAllProjects}
          title={`${t.fit} (${KEY_HINT.fit})`}
          aria-label={t.fit}
        >
          {t.fit}
        </button>

        <div aria-hidden="true" className={dividerCls} />

        {/* Window arranger — tidy the focused worktree into a layout. */}
        <div className="relative" ref={arrangeWrapperRef}>
          <button
            ref={arrangeTriggerRef}
            className={iconButton}
            onClick={() => setArrangeOpen((p) => !p)}
            title="Arrange windows"
            aria-label="Arrange windows"
            aria-haspopup="menu"
            aria-expanded={arrangeOpen}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
              <rect x="9" y="2" width="5" height="5" rx="1.2" fill="currentColor" />
              <rect x="2" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
              <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" />
            </svg>
          </button>
          {arrangeOpen && (
            <div
              ref={arrangePopoverRef}
              role="menu"
              aria-label="Arrange windows"
              className={`absolute bottom-full right-0 mb-2 min-w-[150px] rounded-md py-1 ${PILL_BG} ${PILL_BORDER} ${PILL_SHADOW}`}
            >
              {ARRANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.layout}
                  data-popover-item
                  role="menuitem"
                  tabIndex={-1}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] focus:bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] hover:text-[var(--text-primary)] focus:text-[var(--text-primary)] focus:outline-none"
                  onClick={() => {
                    arrangeFocusedWorktree(opt.layout);
                    closeArrangeMenu();
                  }}
                >
                  <span>{opt.label}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
