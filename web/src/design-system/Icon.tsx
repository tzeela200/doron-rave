import type { LucideIcon } from 'lucide-react';
import styles from './Icon.module.css';

// The only icon entry point (Book 02 §6, Book 06 §6, ADR-014). Lucide only; sizes from tokens;
// colour is currentColor. Directional icons are authored with their LTR meaning ("next" =
// ChevronRight) and mirrored automatically under dir="rtl".

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const PX: Record<IconSize, number> = { xs: 16, sm: 20, md: 24, lg: 28, xl: 32 };

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Accessible name. Omit for decorative icons (they get aria-hidden). */
  label?: string;
  directional?: boolean;
  className?: string;
}

export function Icon({ icon: LucideComponent, size = 'md', label, directional = false, className }: IconProps) {
  const cls = [styles.icon, directional ? styles.directional : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <LucideComponent
      className={cls}
      width={PX[size]}
      height={PX[size]}
      strokeWidth={2}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
