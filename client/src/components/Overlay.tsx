/**
 * A panel that does not push the page around.
 *
 * Every transient panel in this app used to render as a block above the board, and each one
 * shoved the board down by its own height. Measured on a 1393x681 laptop window: opening
 * "new game" left 52% of the board on screen, the PGN drawer 47%, import-by-name 74%. You
 * opened a tool and the thing it operates on went below the fold -- which is what "the screen
 * is cut" meant, three times over from three different buttons.
 *
 * Fixed positioning takes the panel out of flow, so no panel height and no viewport height can
 * displace anything. The panel scrolls itself rather than being clipped when the window is short.
 */
import { useEffect, useRef, type ReactNode } from "react";

interface OverlayProps {
  /** Names the dialog for assistive technology. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export function Overlay({ label, onClose, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus moves into the panel, so the keyboard is where the eye is.
    panel.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="panel-backdrop"
      // mousedown, not click: a drag that STARTS inside the panel and ends on the backdrop is
      // a text selection, not a dismissal.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-shell" role="dialog" aria-modal="true" aria-label={label} ref={panel}>
        {children}
      </div>
    </div>
  );
}
