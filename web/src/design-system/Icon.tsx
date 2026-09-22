import type { LucideIcon } from 'lucide-react';
import styles from './Icon.module.css';

// The only icon entry point (Book 02 §6, Book 06 §6, ADR-014). Lucide only; sizes from tokens;
// colour is currentColor. Design System v2: one stroke weight (1.75px, absolute, so a 16px and a
// 20px icon draw the same line) and one size — 20px, or 16px when set inline with small text.
// Directional icons are authored with their LTR meaning ("next" =
// ChevronRight) and mirrored automatically under dir="rtl".

export type IconSize = 'xs' | 'sm';
const PX: Record<IconSize, number> = { xs: 16, sm: 20 };
const STROKE = 1.75;

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Accessible name. Omit for decorative icons (they get aria-hidden). */
  label?: string;
  directional?: boolean;
  className?: string;
}

export function Icon({ icon: LucideComponent, size = 'sm', label, directional = false, className }: IconProps) {
  const cls = [styles.icon, directional ? styles.directional : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <LucideComponent
      className={cls}
      width={PX[size]}
      height={PX[size]}
      strokeWidth={STROKE}
      absoluteStrokeWidth
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
