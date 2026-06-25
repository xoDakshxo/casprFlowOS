import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useAppLauncherStore } from "../stores/appLauncherStore";
import { useDockStore } from "../stores/dockStore";
import {
  AgentGlyph,
  DrawerIcon,
  getAgentDef,
  spawnAgent,
} from "./agentIcons";

/*
 * AgentDock — a bottom-centre dock for spawning agents.
 *
 * Minimised by default (a slim handle peeks above the edge). On hover it slides
 * up and the pinned-app icons reveal, magnifying toward the cursor (macOS-dock
 * style: neighbours spread, never overlap, frame-perfect tracking). The last
 * tile opens the App Launcher. Dwell >1s on an icon for a tooltip.
 */

const ICON = 46;
const ICON_GAP = 18;
const MAG_RANGE = 130;
const MAG_AMPLITUDE = 0.62;
const LIFT = 16;
const TOOLTIP_DELAY = 1000;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface DockLayout {
  width: number;
  items: { left: number; scale: number }[];
}

function computeLayout(scales: number[]): DockLayout {
  let pos = 0;
  const items = scales.map((scale) => {
    const center = pos + (ICON * scale) / 2;
    pos += ICON * scale + ICON_GAP;
    return { left: center - ICON / 2, scale };
  });
  return { width: Math.max(0, pos - ICON_GAP), items };
}

interface DockItem {
  key: string;
  label: string;
  glyph: ReactNode;
  onClick: () => void;
  drawer?: boolean;
}

export function AgentDock() {
  const pinned = useDockStore((s) => s.pinned);
  const openLauncher = useAppLauncherStore((s) => s.openLauncher);

  const items = useMemo<DockItem[]>(() => {
    const apps: DockItem[] = pinned.map((type) => ({
      key: type,
      label: getAgentDef(type).label,
      glyph: <AgentGlyph type={type} />,
      onClick: () => spawnAgent(type),
    }));
    apps.push({
      key: "drawer",
      label: "All apps",
      glyph: <DrawerIcon />,
      onClick: openLauncher,
      drawer: true,
    });
    return apps;
  }, [pinned, openLauncher]);

  const count = items.length;
  const idleLayout = useMemo(
    () => computeLayout(new Array(count).fill(1)),
    [count],
  );

  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [activeLayout, setActiveLayout] = useState<DockLayout | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocused = useRef<number | null>(null);

  const layout =
    tracking && activeLayout && activeLayout.items.length === count
      ? activeLayout
      : idleLayout;

  const clearTip = useCallback(() => {
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
  }, []);

  useEffect(() => clearTip, [clearTip]);

  const handleMove = useCallback(
    (e: ReactMouseEvent) => {
      const row = rowRef.current;
      if (!row) return;
      const rect = row.getBoundingClientRect();
      // Row is centre-anchored, so its screen centre is stable as it grows.
      const cursorIdleX =
        idleLayout.width / 2 + (e.clientX - (rect.left + rect.width / 2));
      let maxScale = 1;
      let focusedIndex = -1;
      const scales = new Array(count).fill(0).map((_, i) => {
        const idleCenter = i * (ICON + ICON_GAP) + ICON / 2;
        const influence = smoothstep(
          1 - Math.abs(cursorIdleX - idleCenter) / MAG_RANGE,
        );
        const scale = 1 + MAG_AMPLITUDE * influence;
        if (scale > maxScale) {
          maxScale = scale;
          focusedIndex = i;
        }
        return scale;
      });
      setTracking(true);
      setActiveLayout(computeLayout(scales));

      // macOS-style tooltip: show after dwelling ~1s on the same icon.
      const focused = maxScale > 1.08 ? focusedIndex : -1;
      if (focused !== lastFocused.current) {
        lastFocused.current = focused;
        clearTip();
        setTooltipIndex(null);
        if (focused >= 0) {
          tipTimer.current = setTimeout(
            () => setTooltipIndex(focused),
            TOOLTIP_DELAY,
          );
        }
      }
    },
    [count, idleLayout.width, clearTip],
  );

  const handleLeave = useCallback(() => {
    setOpen(false);
    setTracking(false);
    setActiveLayout(null);
    setTooltipIndex(null);
    lastFocused.current = null;
    clearTip();
  }, [clearTip]);

  const tip =
    tooltipIndex !== null && tooltipIndex < items.length
      ? (() => {
          const it = layout.items[tooltipIndex];
          if (!it) return null;
          return {
            label: items[tooltipIndex].label,
            left: it.left + ICON / 2,
            bottom: ICON * it.scale + (it.scale - 1) * LIFT + 10,
          };
        })()
      : null;

  return (
    <div
      className={`caspr-dock ${open ? "caspr-dock--open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={handleLeave}
      onMouseMove={open ? handleMove : undefined}
    >
      <span className="caspr-dock-handle" aria-hidden="true" />
      <div
        className={`caspr-dock-row ${tracking ? "is-tracking" : ""}`}
        ref={rowRef}
        style={{ width: layout.width, height: ICON }}
      >
        {tip && (
          <span
            className="caspr-dock-tip"
            style={{ left: tip.left, bottom: tip.bottom }}
          >
            {tip.label}
          </span>
        )}
        {items.map((item, i) => {
          const it = layout.items[i];
          return (
            <button
              key={item.key}
              className="caspr-dock-item"
              style={{
                left: it.left,
                width: ICON,
                height: ICON,
                transform: `translateY(${-(it.scale - 1) * LIFT}px) scale(${it.scale})`,
              }}
              aria-label={item.label}
              aria-haspopup={item.drawer ? "dialog" : undefined}
              onClick={item.onClick}
            >
              {item.glyph}
            </button>
          );
        })}
      </div>
    </div>
  );
}
