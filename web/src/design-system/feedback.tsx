import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info, RotateCw, SearchX, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cx } from './Typography';
import styles from './feedback.module.css';

// System states (Book 06 §23–§26, Book 05 §21). Empty, NoResults and Error are different
// components on purpose: "nothing yet", "nothing matches" and "failed" say different things.

type MessageTone = 'info' | 'success' | 'warning' | 'error';
const TONE_ICON: Record<MessageTone, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

interface InlineMessageProps {
  tone?: MessageTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** A message that stays in context (load error of a section, overlap warning…). */
export function InlineMessage({ tone = 'info', title, children, action }: InlineMessageProps) {
  return (
    <div className={cx(styles.message, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon icon={TONE_ICON[tone]} size="sm" className={styles.messageIcon} />
      <div className={styles.messageText}>
        {title && <p className={styles.messageTitle}>{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className={styles.messageAction}>{action}</div>}
      </div>
    </div>
  );
}

/** Mimics the geometry of the content it replaces (Book 06 §25). */
export function Skeleton({ height = 'var(--space-6)', width = '100%', radius = 'var(--radius-md)' }: { height?: string; width?: string; radius?: string }) {
  return <span className={styles.skeleton} style={{ blockSize: height, inlineSize: width, borderRadius: radius }} aria-hidden="true" />;
}

/** A block of card-shaped placeholders + an accessible "loading" status. */
export function LoadingBlock({ rows = 3, height = '96px' }: { rows?: number; height?: string }) {
  return (
    <div className={styles.loadingBlock} role="status" aria-live="polite">
      <span className="visually-hidden">טוען</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} radius="var(--radius-lg)" />)}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
}

export function EmptyState({ title, description, action, icon, compact = false }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, compact && styles.emptyCompact)}>
      {icon && !compact && <span className={styles.emptyIcon}><Icon icon={icon} size="sm" /></span>}
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyText}>{description}</p>}
      {action}
    </div>
  );
}

export function NoResultsState({ onClear, clearLabel = 'נקה סינון' }: { onClear: () => void; clearLabel?: string }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon icon={SearchX} size="sm" /></span>
      <p className={styles.emptyTitle}>לא נמצאו תוצאות</p>
      <Button variant="secondary" onClick={onClear}>{clearLabel}</Button>
    </div>
  );
}

export function ErrorState({ message = 'לא הצלחנו לטעון את הנתונים. נסה שוב.', onRetry, retrying }: { message?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <InlineMessage
      tone="error"
      title={message}
      action={onRetry && (
        <Button variant="secondary" compact icon={RotateCw} onClick={onRetry} loading={retrying} loadingText="טוען…">נסה שוב</Button>
      )}
    />
  );
}

// ---------------------------------------------------------------------------------- Toast

type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; tone: ToastTone; message: string }
interface ToastApi { show: (message: string, tone?: ToastTone) => void }

const ToastContext = createContext<ToastApi | null>(null);
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setItems((all) => [...all, { id, tone, message }].slice(-MAX_TOASTS));
    window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts} aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={cx(styles.toast, styles[`toast-${t.tone}`])} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon icon={TONE_ICON[t.tone]} size="sm" className={styles.toastIcon} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
