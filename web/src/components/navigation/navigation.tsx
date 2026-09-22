import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, CalendarDays, ChevronLeft, House, Mic2, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconTile, type IconTone } from '@/design-system/Card';
import { Icon } from '@/design-system/Icon';
import { cx } from '@/design-system/Typography';
import styles from './navigation.module.css';

// Navigation (Book 05 §2, Book 06 §27–§29, ADR-016/017). Bottom navigation is the only primary
// navigation. On desktop the same four destinations move to a top bar — never a sidebar.

export const NAV_ITEMS: readonly { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'בית', icon: House, end: true },
  { to: '/events', label: 'אירועים', icon: CalendarDays },
  { to: '/artists', label: 'אמנים וליין־אפ', icon: Mic2 },
  { to: '/management', label: 'ניהול', icon: Settings2 },
];

export function BottomNavigation() {
  return (
    <nav className={styles.bottomNav} aria-label="ניווט ראשי">
      <ul className={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className={styles.navItem}>
            <NavLink to={item.to} end={item.end} className={({ isActive }) => cx(styles.navLink, isActive && styles.navActive)}>
              <span className={styles.navIcon}><Icon icon={item.icon} size="sm" /></span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface BackButtonProps {
  /** Logical parent for deep links opened without history (Book 07 F02). */
  fallback: string;
  label?: string;
}

/**
 * Back returns to where the user came from; with no in-app history (deep link) it goes to
 * the logical parent. The arrow points in the Hebrew reading direction.
 */
export function BackButton({ fallback, label = 'חזרה' }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasHistory = location.key !== 'default';
  return (
    <button
      type="button"
      className={styles.back}
      aria-label={label}
      title={label}
      onClick={() => (hasHistory ? navigate(-1) : navigate(fallback, { replace: true }))}
    >
      {/* ArrowLeft means "back" in LTR; mirrored under RTL it points right, as Hebrew readers expect */}
      <Icon icon={ArrowLeft} size="sm" directional />
    </button>
  );
}

interface AppHeaderProps {
  title: string;
  /** Show a back button to this parent route. */
  back?: string;
  /** At most one action (Book 06 §27). */
  action?: ReactNode;
  subtitle?: ReactNode;
  /** Show the existing brand mark before the title (Home only). */
  brand?: boolean;
}

export function AppHeader({ title, back, action, subtitle, brand = false }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        {back && <BackButton fallback={back} />}
        {brand && <img src="/icons/icon-192.png" alt="" width={56} height={56} className={styles.brandMark} />}
        <div className={styles.headerTitles}>
          <h1 className={styles.headerTitle}>{title}</h1>
          {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
        </div>
        {action && <div className={styles.headerAction}>{action}</div>}
      </div>
    </header>
  );
}

interface QuickActionProps {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Each shortcut gets its own soft accent from the V3 palette (Book 02 V3 §7). */
  tone?: IconTone;
  /** "service" = the taller, start-aligned management tile. */
  variant?: 'shortcut' | 'service';
}

/** Home / management shortcut tile (Book 06 §29). */
export function QuickAction({ to, label, icon, tone = 'neutral', variant = 'shortcut' }: QuickActionProps) {
  if (variant === 'service') {
    return (
      <Link to={to} className={cx(styles.quick, styles.service, styles[`quick-${tone}`])}>
        <IconTile icon={icon} tone={tone} size="lg" className={styles.quickTile} />
        <span className={styles.serviceFoot}>
          <span className={styles.quickLabel}>{label}</span>
          <Icon icon={ChevronLeft} size="xs" className={styles.serviceChevron} />
        </span>
      </Link>
    );
  }
  return (
    <Link to={to} className={cx(styles.quick, styles[`quick-${tone}`])}>
      <IconTile icon={icon} tone={tone} size="lg" className={styles.quickTile} />
      <span className={styles.quickLabel}>{label}</span>
    </Link>
  );
}
