/// <reference types="electron" />

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { closeTerminalInScene } from "../actions/terminalSceneActions";
import { activateTerminalInScene } from "../actions/sceneSelectionActions";
import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore } from "../stores/projectStore";
import type { TerminalData } from "../types";
import { resolveCenteredBrowserBounds } from "./browserDeviceSizing";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          preload?: string;
          useragent?: string;
        },
        HTMLElement
      >;
    }
  }
}

const HOME = "https://www.google.com";
const CHROME_H = 36; // base chrome height (world px)
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
  ua: string | null;
}

// Chrome DevTools–style device presets. `w`/`h` are the page viewport; the
// window adds the chrome bar on top.
const DEVICES: Device[] = [
  { id: "desktop", label: "Desktop", w: 1920, h: 1080, ua: null },
  { id: "iphone", label: "iPhone 15", w: 393, h: 852, ua: IPHONE_UA },
  { id: "iphone-max", label: "iPhone 15 Pro Max", w: 430, h: 932, ua: IPHONE_UA },
  { id: "pixel", label: "Pixel 8", w: 412, h: 915, ua: IPHONE_UA },
  { id: "ipad", label: "iPad Mini", w: 768, h: 1024, ua: IPAD_UA },
  { id: "ipad-pro", label: "iPad Pro 11", w: 834, h: 1194, ua: IPAD_UA },
];

interface Props {
  interactive: boolean;
  projectId: string;
  worktreeId: string;
  terminal: TerminalData;
}

function prettyHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function BrowserWindow({ interactive, projectId, worktreeId, terminal }: Props) {
  const url = terminal.url ?? HOME;
  const [urlInput, setUrlInput] = useState(url);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("desktop");
  const [deviceMenu, setDeviceMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number } | null>(null);
  const deviceBtnRef = useRef<HTMLButtonElement>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const initialUrl = useRef(url).current;

  // Header counter-scale: as the canvas zooms OUT, grow the header (clamped) so
  // it stays legible — net on-screen size stays roughly constant. At zoom ≥ 1
  // it's 1 (header just scales with the canvas like the rest of the window).
  const scale = useCanvasStore((s) => s.viewport.scale);
  const hs = Math.min(3.2, Math.max(1, 1 / scale));

  useEffect(() => {
    if (!editing) setUrlInput(url);
  }, [url, editing]);

  const setUrl = (u: string) =>
    useProjectStore.getState().updateTerminalUrl(projectId, worktreeId, terminal.id, u);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    wv.setAttribute("allowpopups", "true");
    const onNavigate = ((e: Event & { url: string }) => {
      if (!editing) setUrlInput(e.url);
      setUrl(e.url);
    }) as EventListener;
    const onStart = () => setLoading(true);
    const onStop = () => setLoading(false);
    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigate);
    wv.addEventListener("did-start-loading", onStart);
    wv.addEventListener("did-stop-loading", onStop);
    return () => {
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigate);
      wv.removeEventListener("did-start-loading", onStart);
      wv.removeEventListener("did-stop-loading", onStop);
    };
  }, [terminal.id, editing]);

  const applyDevice = (d: Device) => {
    setDeviceId(d.id);
    setDeviceMenu(false);
    const wv = webviewRef.current;
    const nextBounds = resolveCenteredBrowserBounds(
      {
        x: terminal.x,
        y: terminal.y,
        width: terminal.width,
        height: terminal.height,
      },
      { width: d.w, height: d.h },
      CHROME_H,
    );
    useProjectStore
      .getState()
      .updateTerminalBounds(projectId, worktreeId, terminal.id, nextBounds);
    try {
      wv?.setUserAgent(d.ua ?? "");
      wv?.reload();
    } catch {
      /* not ready */
    }
  };

  const submitUrl = () => {
    let next = urlInput.trim();
    setEditing(false);
    if (!next) return;
    const looksLikeUrl = /^https?:\/\//i.test(next) || /\.[a-z]{2,}/i.test(next);
    if (!looksLikeUrl) next = `https://www.google.com/search?q=${encodeURIComponent(next)}`;
    else if (!/^https?:\/\//i.test(next)) next = `https://${next}`;
    setUrlInput(next);
    const wv = webviewRef.current;
    if (wv) wv.loadURL(next).catch(() => undefined);
    else setUrl(next);
  };

  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const btn =
    "nodrag grid place-items-center h-6 w-6 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors";

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden"
      style={{
        borderRadius: "var(--radius-tile)",
        background: "transparent",
        border: "1px solid var(--glass-edge)",
        boxShadow: terminal.focused
          ? "0 0 0 1.5px var(--accent), inset 0 0 0 1px var(--glass-edge-soft)"
          : "inset 0 0 0 1px var(--glass-edge-soft)",
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (interactive) return;
        activateTerminalInScene(projectId, worktreeId, terminal.id, {
          focusInput: false,
        });
      }}
    >
      {/* Glass chrome — grows when the canvas is zoomed out so it stays legible. */}
      <div
        className="flex-none flex items-center gap-1 px-2 select-none"
        style={{
          height: CHROME_H,
          zoom: hs,
          background: "rgba(22, 22, 27, 0.42)",
          boxShadow: "inset 0 1px 0 var(--glass-edge)",
          borderBottom: "1px solid var(--glass-edge-soft)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
        }}
      >
        <button className={btn} title="Back" onClick={() => webviewRef.current?.goBack()}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path
              d="M8 2L4 6L8 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button className={btn} title="Forward" onClick={() => webviewRef.current?.goForward()}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path
              d="M4 2L8 6L4 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className={btn}
          title={loading ? "Stop" : "Reload"}
          onClick={() => {
            const wv = webviewRef.current;
            if (!wv) return;
            if (loading) wv.stop();
            else wv.reload();
          }}
        >
          {loading ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path
                d="M1.5 6a4.5 4.5 0 1 1 1 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M1.5 10.5V6H5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 mx-1 flex justify-center">
          <input
            className="nodrag cf-meta cf-mono w-full px-3 py-1 rounded-full text-center text-[var(--text-primary)] outline-none transition-colors focus:text-left"
            style={{
              maxWidth: 540,
              background: "var(--surface)",
              border: "1px solid var(--glass-edge-soft)",
              fontSize: 11.5,
            }}
            value={editing ? urlInput : prettyHost(url)}
            spellCheck={false}
            onChange={(e) => setUrlInput(e.target.value)}
            onFocus={(e) => {
              setEditing(true);
              setUrlInput(url);
              requestAnimationFrame(() => e.target.select());
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitUrl();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setEditing(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>

        {/* Device dropdown (Chrome DevTools style). */}
        <button
          ref={deviceBtnRef}
          className="nodrag flex items-center gap-1 h-6 px-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          title="Device"
          onClick={() => {
            const open = !deviceMenu;
            if (open && deviceBtnRef.current) {
              const r = deviceBtnRef.current.getBoundingClientRect();
              setMenuRect({ left: Math.max(8, r.right - 184), top: r.bottom + 4 });
            }
            setDeviceMenu(open);
          }}
          style={{
            color: deviceId !== "desktop" ? "var(--accent)" : undefined,
            background: deviceId !== "desktop" ? "var(--accent-soft)" : undefined,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect
              x="5"
              y="2"
              width="6"
              height="12"
              rx="1.4"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <svg width="8" height="8" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {deviceMenu &&
          menuRect &&
          createPortal(
            <>
              <div
                onMouseDown={() => setDeviceMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 9998 }}
              />
              <div
                className="cf-mono"
                style={{
                  position: "fixed",
                  left: menuRect.left,
                  top: menuRect.top,
                  width: 184,
                  zIndex: 9999,
                  padding: "4px 0",
                  borderRadius: 10,
                  background: "var(--glass-pane)",
                  border: "1px solid var(--glass-edge-soft)",
                  boxShadow: "0 12px 30px -10px rgba(0,0,0,0.7)",
                  backdropFilter: "blur(22px) saturate(140%)",
                  WebkitBackdropFilter: "blur(22px) saturate(140%)",
                }}
              >
                {DEVICES.map((d) => (
                  <button
                    key={d.id}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                    style={{
                      fontSize: 11.5,
                      color: d.id === deviceId ? "var(--accent)" : "var(--text-secondary)",
                    }}
                    onClick={() => applyDevice(d)}
                  >
                    <span>{d.label}</span>
                    {d.w && (
                      <span style={{ color: "var(--text-faint)" }}>
                        {d.w}×{d.h}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}

        <button
          className={btn}
          title="Close"
          onClick={() => closeTerminalInScene(projectId, worktreeId, terminal.id)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        data-browser-content="true"
        data-browser-interactive={interactive ? "true" : "false"}
        className="flex-1 min-h-0 relative"
        style={{ background: "var(--surface)" }}
      >
        <webview
          ref={webviewRef as React.Ref<HTMLElement>}
          className="nodrag"
          src={initialUrl}
          partition="persist:browser"
          useragent={device.ua ?? undefined}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            display: "flex",
            pointerEvents: interactive ? "auto" : "none",
          }}
        />
      </div>
    </div>
  );
}
