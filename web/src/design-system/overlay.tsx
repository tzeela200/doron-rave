import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, IconButton } from './Button';
import { cx } from './Typography';
import styles from './overlay.module.css';

// Overlays (Book 06 §21–§22, ADR-058). Built on the native <dialog>: top layer, inert page
// behind it, Escape handled, focus returned to the opener on close.

function useModalDialog(open: boolean, onRequestClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const requestClose = useRef(onRequestClose);
  requestClose.current = onRequestClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      // Explicit autofocus wins; otherwise the heading, so the mobile keyboard does not pop up
      // before the user chooses a field (Book 07 §45).
      const target = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('h2');
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault(); // the owner decides (dirty forms must confirm first)
      requestClose.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, []);

  return ref;
}

interface BottomSheetProps {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  /** Sticky action area (Save / Cancel). */
  footer?: ReactNode;
  description?: ReactNode;
}

/** Default mobile pattern for short create/edit forms. A failed save keeps it open. */
export function BottomSheet({ open, title, onRequestClose, children, footer, description }: BottomSheetProps) {
  const ref = useModalDialog(open, onRequestClose);
  const titleId = useId();
  return (
    <dialog ref={ref} className={cx(styles.dialog, styles.sheet)} aria-labelledby={titleId}>
      {open && (
        <div className={styles.frame}>
          <header className={styles.header}>
            <span className={styles.grabber} aria-hidden="true" />
            <div className={styles.headerRow}>
              <h2 id={titleId} className={styles.title} tabIndex={-1}>{title}</h2>
              <IconButton icon={X} label="סגירה" onClick={onRequestClose} />
            </div>
            {description && <div className={styles.description}>{description}</div>}
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface AlertDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  loadingText?: string;
  tone?: 'default' | 'danger';
  error?: string | null;
}

/**
 * Confirmation for consequential actions (archive, discard, clone). The confirm button names
 * the result, never "כן" (Book 11 §17). Primary/secondary order follows RTL reading.
 */
export function AlertDialog({
  open, title, body, confirmLabel, cancelLabel = 'ביטול', onConfirm, onCancel, loading, loadingText, tone = 'default', error,
}: AlertDialogProps) {
  const ref = useModalDialog(open, onCancel);
  const titleId = useId();
  const bodyId = useId();
  return (
    <dialog ref={ref} role="alertdialog" className={cx(styles.dialog, styles.alert)} aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined}>
      {open && (
        <div className={styles.alertFrame}>
          <h2 id={titleId} className={styles.title} tabIndex={-1}>{title}</h2>
          {body && <div id={bodyId} className={styles.alertBody}>{body}</div>}
          {error && <p className={styles.alertError} role="alert">{error}</p>}
          <div className={styles.alertActions}>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} loadingText={loadingText} data-autofocus>
              {confirmLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
