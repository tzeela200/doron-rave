import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { cx } from './Typography';
import styles from './Button.module.css';

// Four families only: primary, secondary, ghost, icon. Danger is a variant, not a family.
// Loading keeps the footprint and blocks a second submit (Book 06 §4, §8).

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  compact?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  /** Text shown while loading, e.g. "שומר…" (Book 11 §11). */
  loadingText?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  compact = false,
  fullWidth = false,
  loading = false,
  loadingText,
  icon,
  children,
  disabled,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.button, styles[variant], compact && styles.compact, fullWidth && styles.fullWidth, className)}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
    >
      {loading ? <Icon icon={Loader2} size="sm" className={styles.spinner} /> : icon && <Icon icon={icon} size="sm" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  compact?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  state?: unknown;
}

/** Navigation that looks like a button (it is still a link). */
export function LinkButton({ to, variant = 'secondary', compact, fullWidth, icon, children, className, state }: LinkButtonProps) {
  return (
    <Link to={to} state={state} className={cx(styles.button, styles[variant], compact && styles.compact, fullWidth && styles.fullWidth, className)}>
      {icon && <Icon icon={icon} size="sm" />}
      <span>{children}</span>
    </Link>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Required accessible name; also the desktop tooltip (Book 06 §9). */
  label: string;
  directional?: boolean;
  tone?: 'default' | 'soft';
}

export function IconButton({ icon, label, directional, tone = 'default', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} title={label} className={cx(styles.iconButton, tone === 'soft' && styles.iconSoft, className)}>
      <Icon icon={icon} size="md" directional={directional} />
    </button>
  );
}

interface FloatingCreateProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
}

/** One per screen at most. Sits above the bottom navigation and the safe area. */
export function FloatingCreateButton({ icon, label, onClick, to }: FloatingCreateProps) {
  const content = (
    <>
      <Icon icon={icon} size="md" />
      <span>{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={styles.fab}>{content}</Link>
  ) : (
    <button type="button" className={styles.fab} onClick={onClick}>{content}</button>
  );
}
