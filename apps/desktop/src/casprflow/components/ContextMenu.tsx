import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "../i18n/useT";

export type MenuItem =
  | {
      type?: "item";
      label: string;
      icon?: ReactNode;
      active?: boolean;
      danger?: boolean;
      // A submenu opens to the side on hover. When present, onClick is optional.
      submenu?: MenuItem[];
      onClick?: () => void;
    }
  | { type: "separator" };

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;

/**
 * Compact rounded context menu. A single flat list with optional one-level
 * submenus that fly out on hover (used by the canvas right-click "Add Agent").
 * Portal the whole thing at the call site so it sits in the root stacking
 * context, above the canvas/wallpaper.
 */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x, y });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let nx = x;
    let ny = y;
    if (nx + rect.width + VIEWPORT_MARGIN > vw) {
      nx = Math.max(VIEWPORT_MARGIN, vw - rect.width - VIEWPORT_MARGIN);
    }
    if (ny + rect.height + VIEWPORT_MARGIN > vh) {
      ny = Math.max(VIEWPORT_MARGIN, vh - rect.height - VIEWPORT_MARGIN);
    }
    setPos({ x: nx, y: ny });
  }, [x, y, items]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so the listener fires before React Flow's pane handlers
    // call stopPropagation, which would otherwise leave the menu stuck open.
    window.addEventListener("mousedown", handler, true);
    return () => window.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t.context_menu_aria_label}
      className="caspr-ctx fixed z-[1000]"
      style={{ left: pos.x, top: pos.y }}
    >
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

function MenuList({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const [openSub, setOpenSub] = useState<number | null>(null);

  return (
    <div className="caspr-ctx-panel" role="presentation">
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={`sep-${i}`} role="separator" className="caspr-ctx-sep" />
        ) : item.submenu ? (
          <div
            key={`${item.label}-${i}`}
            className="caspr-ctx-subwrap"
            onMouseEnter={() => setOpenSub(i)}
            onMouseLeave={() => setOpenSub((cur) => (cur === i ? null : cur))}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSub === i}
              className="caspr-ctx-item"
              data-has-sub="true"
            >
              <span className="caspr-ctx-label">
                {item.icon && <span className="caspr-ctx-icon">{item.icon}</span>}
                {item.label}
              </span>
              <span aria-hidden className="caspr-ctx-chevron">
                ›
              </span>
            </button>
            {openSub === i && (
              <SubmenuFlyout items={item.submenu} onClose={onClose} />
            )}
          </div>
        ) : (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            className="caspr-ctx-item"
            data-active={item.active ? "true" : undefined}
            data-danger={item.danger ? "true" : undefined}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            <span className="caspr-ctx-label">
              {item.icon && <span className="caspr-ctx-icon">{item.icon}</span>}
              {item.label}
            </span>
          </button>
        ),
      )}
    </div>
  );
}

/** Submenu that opens to the right, flipping left if it would overflow. */
function SubmenuFlyout({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.right > window.innerWidth - VIEWPORT_MARGIN) setFlip(true);
  }, []);

  return (
    <div
      ref={ref}
      className="caspr-ctx-flyout"
      data-flip={flip ? "true" : undefined}
    >
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}
