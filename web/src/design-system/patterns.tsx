import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { AlertDialog, BottomSheet } from './overlay';
import { cx } from './Typography';
import styles from './patterns.module.css';

// Shared patterns (Book 06 §42–§48).

interface SegmentedOption<T extends string> { value: T; label: string }

/** A few sibling views only; never the main navigation (Book 06 §43). */
export function SegmentedControl<T extends string>({
  options, value, onChange, label,
}: { options: readonly SegmentedOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx(styles.segment, o.value === value && styles.segmentActive)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Title + optional description + fields. Not a card around every two fields (Book 06 §47). */
export function FormSection({ title, description, children }: { title?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className={styles.formSection}>
      {title && <legend className={styles.formSectionTitle}>{title}</legend>}
      {description && <p className={styles.formSectionDescription}>{description}</p>}
      <div className={styles.formSectionBody}>{children}</div>
    </fieldset>
  );
}

/** Save area that stays reachable above the keyboard / bottom nav on full-page forms. */
export function StickyFormActions({ children }: { children: ReactNode }) {
  return <div className={styles.sticky}>{children}</div>;
}

interface ConfirmArchiveProps {
  open: boolean;
  /** Book 11 §17, e.g. "להעביר את האירוע לארכיון?" */
  title: string;
  body?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

/** Archive keeps history — the wording never says "delete permanently" (Book 06 §46). */
export function ConfirmArchive({ open, title, body, onConfirm, onCancel, loading, error }: ConfirmArchiveProps) {
  return (
    <AlertDialog
      open={open}
      title={title}
      body={body ?? 'הפריט יוסר מהרשימות הפעילות ומהחישובים. ההיסטוריה נשמרת בארכיון.'}
      confirmLabel="העבר לארכיון"
      loading={loading}
      loadingText="מעביר לארכיון…"
      onConfirm={onConfirm}
      onCancel={onCancel}
      error={error}
    />
  );
}

interface FilterSheetProps {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
  title?: string;
}

/** Mobile filters live in a sheet; the trigger shows how many are active (Book 06 §42). */
export function FilterSheet({ activeCount, onClear, children, title = 'סינון' }: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.filterBar}>
        <Button variant="secondary" compact icon={SlidersHorizontal} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {activeCount > 0 ? `סינון (${activeCount})` : 'סינון'}
        </Button>
        {activeCount > 0 && <Button variant="ghost" compact onClick={onClear}>נקה סינון</Button>}
      </div>
      <BottomSheet
        open={open}
        title={title}
        onRequestClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="primary" onClick={() => setOpen(false)}>הצג תוצאות</Button>
            <Button variant="ghost" onClick={() => { onClear(); setOpen(false); }}>נקה סינון</Button>
          </>
        }
      >
        {children}
      </BottomSheet>
    </>
  );
}

/** Rows on mobile; a real table from desktop up when comparing (Book 06 §44). */
export function DataList({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className={styles.dataList} aria-label={label}>{children}</ul>;
}

export function DataRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx(styles.dataRow, className)}>{children}</li>;
}
