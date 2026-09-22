import type { ElementType, ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
import styles from './Typography.module.css';

// Typography primitives (Book 06 §5). No font-family or letter-spacing overrides exist here.

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4';

interface TextProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function PageTitle({ children, className, id }: TextProps) {
  return <h1 id={id} className={cx(styles.pageTitle, className)}>{children}</h1>;
}

export function SectionTitle({ children, className, id, as = 'h2' }: TextProps & { as?: HeadingTag }) {
  const Tag = as;
  return <Tag id={id} className={cx(styles.sectionTitle, className)}>{children}</Tag>;
}

export function CardTitle({ children, className, id, as = 'h3' }: TextProps & { as?: HeadingTag | 'p' | 'span' }) {
  const Tag = as;
  return <Tag id={id} className={cx(styles.cardTitle, className)}>{children}</Tag>;
}

export function Body({ children, className, compact = false, as = 'p' }: TextProps & { compact?: boolean; as?: ElementType }) {
  const Tag = as;
  return <Tag className={cx(compact ? styles.bodyCompact : styles.body, className)}>{children}</Tag>;
}

export function Meta({ children, className, as = 'p' }: TextProps & { as?: ElementType }) {
  const Tag = as;
  return <Tag className={cx(styles.meta, className)}>{children}</Tag>;
}

export function Caption({ children, className, as = 'span' }: TextProps & { as?: ElementType }) {
  const Tag = as;
  return <Tag className={cx(styles.caption, className)}>{children}</Tag>;
}

export function Label({ children, className, as = 'span' }: TextProps & { as?: ElementType }) {
  const Tag = as;
  return <Tag className={cx(styles.label, className)}>{children}</Tag>;
}

interface MoneyProps {
  value: number | null | undefined;
  /** Shown when there is no value. Never "0" (ADR-059). */
  empty?: string;
  /** Colour negative values as danger (Book 02 §5.2). */
  signed?: boolean;
  className?: string;
}

/** Inline ₪ amount. */
export function Money({ value, empty = '—', signed = false, className }: MoneyProps) {
  const text = formatMoney(value);
  if (text === null) return <span className={cx(styles.muted, className)}>{empty}</span>;
  return <span className={cx(styles.money, signed && (value ?? 0) < 0 && styles.negative, className)}>{text}</span>;
}

interface MetricProps {
  /** Pre-formatted display value, or null for "no value". */
  children: ReactNode | null;
  empty?: string;
  negative?: boolean;
  large?: boolean;
  className?: string;
}

/** The main number of a KPI. Null renders the unavailable text, not zero. */
export function Metric({ children, empty = 'אין נתון', negative = false, large = false, className }: MetricProps) {
  if (children === null || children === undefined) {
    return <p className={cx(styles.metric, styles.muted, className)}>{empty}</p>;
  }
  return <p className={cx(styles.metric, large && styles.metricLarge, negative && styles.negative, className)}>{children}</p>;
}

export { cx };
