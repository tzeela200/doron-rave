import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';
import { cx } from './Typography';
import styles from './form.module.css';

// Every form control goes through Field: a real label above, hint, linked error (Book 06 §15).
// Placeholder is never the label. Errors are text, not colour alone.

export interface ControlA11y {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Render prop receives the id/aria wiring for the control. */
  children: (a11y: ControlA11y) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

/** Fieldset for groups such as radio-like choices, with a legend as the label. */
export function FieldGroup({ legend, children, error }: { legend: string; children: ReactNode; error?: string }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend}</legend>
      {children}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </fieldset>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

export function Input({ className, type = 'text', ...rest }: InputProps) {
  return <input {...rest} type={type} className={cx(styles.control, className)} />;
}

export function Textarea({ className, ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea {...rest} ref={ref} className={cx(styles.control, styles.textarea, className)} />;
}

/** ₪ amount: decimal keyboard, value stays a string in the form, empty stays empty. */
export function MoneyInput({ className, ...rest }: InputProps) {
  return (
    <div className={styles.adorned}>
      <input {...rest} type="text" inputMode="decimal" autoComplete="off" dir="ltr" className={cx(styles.control, styles.number, styles.withAdornment, className)} />
      <span className={styles.adornment} aria-hidden="true">₪</span>
    </div>
  );
}

export function NumberInput({ className, ...rest }: InputProps) {
  return <input {...rest} type="text" inputMode="numeric" autoComplete="off" dir="ltr" className={cx(styles.control, styles.number, className)} />;
}

/** Native date picker; value is ISO yyyy-MM-dd (Book 06 §20). */
export function DateInput({ className, ...rest }: InputProps) {
  return <input {...rest} type="date" className={cx(styles.control, styles.number, className)} />;
}

/** HH:mm, 24h. Crossing midnight is not an error here — the domain decides. */
export function TimeInput({ className, ...rest }: InputProps) {
  return <input {...rest} type="time" step={60} className={cx(styles.control, styles.number, className)} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement>; placeholder?: string };

export function Select({ className, children, placeholder, ...rest }: SelectProps) {
  return (
    <div className={styles.selectWrap}>
      <select {...rest} className={cx(styles.control, styles.select, className)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <Icon icon={ChevronDown} size="sm" className={styles.selectChevron} />
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

/** Search with a visible icon and an accessible clear button (Book 06 §16). */
export function SearchInput({ value, onChange, label, placeholder = 'חיפוש…' }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.search}>
      <Icon icon={Search} size="sm" className={styles.searchIcon} />
      <input
        ref={ref}
        type="search"
        inputMode="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(styles.control, styles.searchControl)}
      />
      {value && (
        <button type="button" className={styles.clear} aria-label="נקה חיפוש" onClick={() => { onChange(''); ref.current?.focus(); }}>
          <Icon icon={X} size="sm" />
        </button>
      )}
    </div>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** The whole row is clickable and ≥48px tall (Book 02 §10.1). */
export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles.check, className)}>
      <input {...rest} type="checkbox" className={styles.checkInput} />
      <span className={styles.checkBox} aria-hidden="true"><Icon icon={Check} size="xs" /></span>
      <span className={styles.checkText}>
        <span>{label}</span>
        {description && <span className={styles.hint}>{description}</span>}
      </span>
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Immediate boolean only; not a Checkbox replacement (Book 06 §19). */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={styles.switchRow} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className={cx(styles.switchTrack, checked && styles.switchOn)} aria-hidden="true"><span className={styles.switchThumb} /></span>
    </button>
  );
}

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  group?: string;
}

interface ComboboxProps {
  options: readonly ComboOption[];
  value: string;
  onChange: (value: string) => void;
  a11y: ControlA11y;
  placeholder?: string;
  emptyText?: string;
  /** Show a "clear" option so the value can go back to empty (e.g. no vendor). */
  clearLabel?: string;
}

/**
 * Searchable single select for long lists (artists, vendors). Never creates a value silently
 * (Book 02 §10.5). Keyboard: ↑/↓ move, Enter chooses, Escape closes.
 */
export function Combobox({ options, value, onChange, a11y, placeholder = 'בחירה…', emptyText = 'לא נמצאו תוצאות', clearLabel }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return clearLabel ? [{ value: '', label: clearLabel }, ...base] : [...base];
  }, [options, query, clearLabel]);

  const choose = (opt: ComboOption | undefined) => {
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); choose(filtered[active]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div className={styles.combo}>
      <input
        {...a11y}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        className={cx(styles.control, styles.select)}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : selected?.label ?? ''}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(''); }, 120)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      <Icon icon={ChevronDown} size="sm" className={styles.selectChevron} />
      {open && (
        <ul id={listId} role="listbox" className={styles.comboList}>
          {filtered.length === 0 && <li className={styles.comboEmpty}>{emptyText}</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value || '__clear'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={cx(styles.comboOption, i === active && styles.comboActive)}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
            >
              <span>{o.label}</span>
              {o.hint && <span className={styles.hint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
