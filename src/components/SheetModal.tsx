import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

interface SheetModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Responsive Sheet / Dialog primitive (Spec Sections 7 & 10):
 * - Compact (< 600px): Bottom sheet with touch drag-to-dismiss & dim backdrop
 * - Medium / Expanded / Large (>= 600px): Centered dialog
 * - Traps focus, handles Escape, locks background scroll, and restores focus on close.
 */
export function SheetModal({ open, onClose, title, children }: SheetModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const onGrabberDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onGrabberMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartRef.current);
    setDragY(delta);
  };

  const onGrabberUp = () => {
    if (dragStartRef.current === null) return;
    dragStartRef.current = null;
    if (dragY > 88) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={
          dragY > 0
            ? ({ '--sheet-drag-y': `${dragY}px`, animation: 'none' } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className="sheet-grabber-area"
          onPointerDown={onGrabberDown}
          onPointerMove={onGrabberMove}
          onPointerUp={onGrabberUp}
          onPointerCancel={onGrabberUp}
          aria-hidden="true"
        >
          <span className="sheet-grabber" />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h2 id={titleId} style={{ fontSize: 'var(--text-xl)' }}>
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-icon btn-subtle"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
