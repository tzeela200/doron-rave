import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Label, Metric, cx } from './Typography';
import styles from './Card.module.css';

// Surfaces (Book 02 §7, Book 06 §10–§17). Border first, shadow only when needed (ADR-057).

type CardVariant = 'surface' | 'summary' | 'subtle';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  as?: 'div' | 'article' | 'li' | 'section';
  padded?: boolean;
}

export function Card({ children, variant = 'surface', className, as: Tag = 'div', padded = true }: CardProps) {
  return <Tag className={cx(styles.card, styles[variant], padded && styles.padded, className)}>{children}</Tag>;
}

interface InteractiveCardProps {
  to: string;
  children: ReactNode;
  className?: string;
  /** Accessible name when the visible content is not enough. */
  ariaLabel?: string;
  state?: unknown;
}

/** The whole card is one link; keyboard and focus come from the native element. */
export function InteractiveCard({ to, children, className, ariaLabel, state }: InteractiveCardProps) {
  return (
    <Link to={to} state={state} aria-label={ariaLabel} className={cx(styles.card, styles.surface, styles.padded, styles.interactive, className)}>
      {children}
    </Link>
  );
}

export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'accent';

interface KpiCardProps {
  label: string;
  /** Formatted value, or null → shows `empty` (never 0) (Book 06 §11). */
  value: ReactNode | null;
  empty?: string;
  meta?: ReactNode;
  icon?: LucideIcon;
  negative?: boolean;
}

export function KpiCard({ label, value, empty, meta, icon, negative }: KpiCardProps) {
  return (
    <div className={cx(styles.card, styles.surface, styles.kpi)}>
      <div className={styles.kpiHead}>
        <Label as="p">{label}</Label>
        {icon && <span className={styles.kpiIcon}><Icon icon={icon} size="sm" /></span>}
      </div>
      <Metric empty={empty} negative={negative}>{value}</Metric>
      {meta && <div className={styles.kpiMeta}>{meta}</div>}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}

/** Shows an existing status only; never invents one (Book 06 §12). Text + icon, not colour alone. */
export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[`badge-${tone}`], className)}>
      {icon && <Icon icon={icon} size="xs" className={styles.badgeIcon} />}
      <span>{children}</span>
    </span>
  );
}

interface ProgressProps {
  value: number;
  /** External label explaining numerator/denominator (Book 06 §13). */
  label: string;
  tone?: 'brand' | 'success';
}

export function Progress({ value, label, tone = 'brand' }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={label}>
      <div className={cx(styles.progressFill, tone === 'success' && styles.progressSuccess)} style={{ inlineSize: `${clamped}%` }} />
    </div>
  );
}

interface AccordionProps {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: LucideIcon;
}

/** Secondary information only; the whole header is the button (Book 02 §9). */
export function Accordion({ title, meta, children, defaultOpen = false, icon }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className={cx(styles.card, styles.surface, styles.accordion)}>
      <button type="button" className={styles.accordionHeader} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        {icon && <span className={styles.kpiIcon}><Icon icon={icon} size="sm" /></span>}
        <span className={styles.accordionTitle}>{title}</span>
        {meta && <span className={styles.accordionMeta}>{meta}</span>}
        <Icon icon={ChevronDown} size="sm" className={cx(styles.chevron, open && styles.chevronOpen)} />
      </button>
      <div id={bodyId} className={styles.accordionBody} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
