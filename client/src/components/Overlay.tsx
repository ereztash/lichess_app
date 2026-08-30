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

/**
 * What can hold focus inside the panel.
 *
 * The old selector was `input, textarea, button`, which is not a list of focusable things -- it is
 * a list of three of them. A panel whose first control is a link or a `<select>` had focus land
 * somewhere else or nowhere, and the trap below would have had nothing to cycle between.
 *
 * `[tabindex="-1"]` is excluded on purpose: it means "focusable by script, not by Tab", which is
 * exactly what the panel shell itself carries.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function Overlay({ label, onClose, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);

  const focusables = () => {
    const shell = panel.current;
    if (!shell) return [];
    return [...shell.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute("hidden"),
    );
  };

  /*
   * FOCUS GOES IN, AND IT COMES BACK.
   *
   * Separate from the key listener below, and with no dependencies, because the two have different
   * lifetimes. The listener is rebuilt whenever `onClose` changes identity; this must run exactly
   * once per open. Sharing an effect meant a parent re-render that produced a fresh `onClose`
   * would restore focus to the opener while the dialog was still on screen, then re-capture the
   * opener as whatever had focus by then.
   *
   * THE GUARD ON THE WAY OUT. The element that opened the panel may not exist any more -- a
   * dialog that replaces the thing that launched it is ordinary. Calling `focus()` on a detached
   * node silently sends focus to `<body>`, which is the failure this is meant to prevent, so it
   * is only called on a node still in the document.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Focus moves into the panel, so the keyboard is where the eye is.
    (focusables()[0] ?? panel.current)?.focus();
    return () => {
      if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * THE TRAP, AND WHY IT IS NOT DECORATION.
   *
   * `aria-modal="true"` is a PROMISE to assistive technology: everything outside this node is not
   * there. Nothing enforced it, so the third press of Tab walked into a page the screen reader had
   * already been told did not exist -- reading out controls it would not announce, on a document
   * it had stopped describing. That is worse than an untrapped dialog with no `aria-modal`, which
   * at least does not lie.
   *
   * The listener is on `document` rather than the panel so that focus which is ALREADY outside --
   * returning from the browser chrome, say -- is pulled back in on the next Tab, rather than being
   * unreachable by a handler that only fires on descendants.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const shell = panel.current;
      if (!shell) return;
      const stops = focusables();
      if (stops.length === 0) {
        // Nothing to cycle between, so Tab must not leave either.
        e.preventDefault();
        shell.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !shell.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
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
      <div
        className="panel-shell"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        /* Focusable by script and not by Tab, so the dialog can hold focus when it has no controls. */
        tabIndex={-1}
        ref={panel}
      >
        {children}
      </div>
    </div>
  );
}
