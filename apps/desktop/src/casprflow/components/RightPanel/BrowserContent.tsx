import { useEffect, useRef, useState } from "react";
import {
  browserKey,
  useBrowserPanelStore,
} from "../../stores/browserPanelStore";

/*
 * Browser tab content — a lightweight in-panel browser scoped to the active
 * worktree (its URL is remembered per-worktree, like Files/Diff/Git). Backed by
 * an Electron <webview>; kept mounted so the page survives tab switches.
 */

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^localhost(:\d+)?(\/|$)/i.test(v) || /^\d{1,3}(\.\d{1,3}){3}/.test(v)) {
    return `http://${v}`;
  }
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(v)}`;
}

const navBtn =
  "shrink-0 grid place-items-center w-6 h-6 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors";

interface Props {
  worktreePath: string | null;
}

export function BrowserContent({ worktreePath }: Props) {
  const url = useBrowserPanelStore(
    (s) => s.urlByWorktree[browserKey(worktreePath)] ?? "",
  );
  const setUrl = useBrowserPanelStore((s) => s.setUrl);
  const [input, setInput] = useState(url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);

  // Reflect the stored URL when the worktree (and thus its URL) changes.
  useEffect(() => {
    setInput(url);
  }, [url, worktreePath]);

  // Webview load lifecycle: surface loading + failures (and log for diagnosis).
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !url) return;
    // Set as a real string attribute (React warns on boolean-style JSX attrs
    // for custom elements like <webview>).
    wv.setAttribute("allowpopups", "true");
    const onStart = () => {
      setLoading(true);
      setError(null);
    };
    const onStop = () => setLoading(false);
    const onFinish = () => {
      setLoading(false);
      console.log("[browser] did-finish-load", url);
    };
    const onDom = () => console.log("[browser] dom-ready", url);
    const onFail = ((e: Event & {
      errorCode: number;
      errorDescription: string;
      isMainFrame: boolean;
    }) => {
      if (!e.isMainFrame || e.errorCode === -3) return; // -3 = aborted
      console.log("[browser] did-fail-load", e.errorCode, e.errorDescription);
      setError(`${e.errorDescription} (${e.errorCode})`);
      setLoading(false);
    }) as EventListener;
    wv.addEventListener("did-start-loading", onStart);
    wv.addEventListener("did-stop-loading", onStop);
    wv.addEventListener("did-finish-load", onFinish);
    wv.addEventListener("dom-ready", onDom);
    wv.addEventListener("did-fail-load", onFail);
    return () => {
      wv.removeEventListener("did-start-loading", onStart);
      wv.removeEventListener("did-stop-loading", onStop);
      wv.removeEventListener("did-finish-load", onFinish);
      wv.removeEventListener("dom-ready", onDom);
      wv.removeEventListener("did-fail-load", onFail);
    };
  }, [url, worktreePath]);

  // Surface a hung load (e.g. network blip) instead of an endless spinner.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setError("Timed out — the page took too long to respond. Reload to retry.");
      setLoading(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [loading]);

  const go = (raw: string) => {
    const next = normalizeUrl(raw);
    setInput(next);
    setUrl(worktreePath, next);
  };

  return (
    <div className="flex flex-1 min-w-0 min-h-0 flex-col">
      <div
        className="shrink-0 flex min-w-0 items-center gap-1 px-2 py-1.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          className={navBtn}
          title="Back"
          onClick={() => webviewRef.current?.goBack()}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={navBtn}
          title="Forward"
          onClick={() => webviewRef.current?.goForward()}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={navBtn}
          title="Reload"
          onClick={() => webviewRef.current?.reload()}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          className="cf-mono w-full min-w-0 flex-1 rounded-md px-2 py-1 text-[var(--text-primary)] outline-none"
          style={{
            backgroundColor: "var(--bg)",
            border: "1px solid var(--border)",
            // Fluid: scales with the window/panel instead of a fixed 11px.
            fontSize: "var(--text-sm)",
          }}
          value={input}
          placeholder="Enter URL or search…"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") go(input);
          }}
        />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1">
        {url ? (
          <webview
            key={browserKey(worktreePath)}
            ref={webviewRef as React.Ref<HTMLElement>}
            src={url}
            partition="persist:caspr-browser"
            style={{
              flex: "1 1 auto",
              width: "100%",
              height: "100%",
              border: "none",
              background: "#ffffff",
              display: "inline-flex",
            }}
          />
        ) : null}
        {url && loading && (
          <div
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 cf-caption"
            style={{
              backgroundColor: "var(--glass-pane)",
              border: "1px solid var(--glass-edge-soft)",
              color: "var(--text-secondary)",
            }}
          >
            Loading…
          </div>
        )}
        {url && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
            style={{ backgroundColor: "var(--bg)" }}
          >
            <div className="cf-body-sm" style={{ color: "var(--text-primary)" }}>
              Couldn’t load the page
            </div>
            <div className="cf-caption" style={{ color: "var(--text-muted)", maxWidth: 320 }}>
              {error}
            </div>
            <button
              className="cf-meta rounded-md px-3 py-1"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => {
                setError(null);
                webviewRef.current?.reload();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!url ? (
          <div className="flex h-full w-full flex-1 min-w-0 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="cf-body-sm" style={{ color: "var(--text-secondary)" }}>
              Open a page for this agent
            </div>
            <div className="cf-caption" style={{ color: "var(--text-muted)" }}>
              Enter a URL above, or jump to your dev server.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {["localhost:3000", "localhost:5173", "localhost:8080"].map((u) => (
                <button
                  key={u}
                  className="cf-mono cf-meta rounded-md px-2.5 py-1"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                  onClick={() => go(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
