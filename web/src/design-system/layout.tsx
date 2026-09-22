import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { createContext, useContext, useId, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { IconTile } from './Card';
import { Icon } from './Icon';
import { cx, SectionTitle } from './Typography';
import styles from './layout.module.css';

// Layout primitives (Book 06 §7). Gaps come from the spacing scale only.

export type Space = '0' | '0-5' | '1' | '1-5' | '2' | '3' | '4' | '5' | '6' | '8';
const gap = (s: Space): CSSProperties => ({ gap: `var(--space-${s})` });

interface BoxProps {
  children?: ReactNode;
  className?: string;
  as?: ElementType;
}

export function PageContainer({ children, className, narrow = false }: BoxProps & { narrow?: boolean }) {
  return <div className={cx(styles.page, narrow && styles.narrow, className)}>{children}</div>;
}

export function Stack({ children, className, as: Tag = 'div', gap: g = '2' }: BoxProps & { gap?: Space }) {
  return <Tag className={cx(styles.stack, className)} style={gap(g)}>{children}</Tag>;
}

export function Inline({
  children,
  className,
  as: Tag = 'div',
  gap: g = '1',
  wrap = true,
  justify = 'start',
  align = 'center',
}: BoxProps & { gap?: Space; wrap?: boolean; justify?: 'start' | 'between' | 'end'; align?: 'center' | 'start' | 'baseline' | 'stretch' }) {
  return (
    <Tag
      className={cx(styles.inline, !wrap && styles.nowrap, styles[`justify-${justify}`], styles[`align-${align}`], className)}
      style={gap(g)}
    >
      {children}
    </Tag>
  );
}

/** 1 column on mobile; `columns` from tablet up. */
export function Grid({ children, className, columns = 2, gap: g = '1-5', desktopColumns }: BoxProps & { columns?: 2 | 3 | 4; desktopColumns?: 2 | 3 | 4; gap?: Space }) {
  return (
    <div className={cx(styles.grid, styles[`cols-${columns}`], desktopColumns && styles[`dcols-${desktopColumns}`], className)} style={gap(g)}>
      {children}
    </div>
  );
}

interface SectionProps {
  title?: string;
  /** Item count shown as "כותרת (N)"; omitted while unknown. */
  count?: number;
  /** Header icon, shown in the collapsible (accordion) form. */
  icon?: LucideIcon;
  /** Optional right-aligned (inline-end) action, e.g. an "add" button. */
  action?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  titleAs?: 'h2' | 'h3';
}

const withCount = (title: string | undefined, count: number | undefined) =>
  title && count !== undefined ? `${title} (${count.toLocaleString('he-IL')})` : title;

/** Inside this provider every titled Section is an accordion, closed by default. The closed
 *  header still shows icon, title (N) and a one-line summary; the action stays reachable
 *  (Book 02 V3 §15–§16, UX addendum 2026-09-22 §6–§8). */
const CollapsibleContext = createContext(false);
export function CollapsibleSections({ children }: { children: ReactNode }) {
  return <CollapsibleContext.Provider value>{children}</CollapsibleContext.Provider>;
}

/** A titled region of a screen, always with the same title→content gap. */
export function Section(props: SectionProps) {
  const collapsible = useContext(CollapsibleContext);
  return collapsible && props.title ? <CollapsibleSection {...props} /> : <StaticSection {...props} />;
}

function CollapsibleSection({ title, count, icon, action, meta, children, className, id, titleAs: H = 'h2' }: SectionProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <section className={cx(styles.section, className)} id={id}>
      <div className={cx(styles.collapseCard, open && styles.collapseCardOpen)}>
        <H className={styles.collapseHeading}>
          <button type="button" className={styles.collapseHeader} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
            {icon && <IconTile icon={icon} tone="neutral" />}
            <span className={styles.collapseText}>
              <span className={styles.collapseTitle}>{withCount(title, count)}</span>
              {meta && <span className={styles.collapseMeta}>{meta}</span>}
            </span>
            <Icon icon={ChevronDown} className={cx(styles.chevron, open && styles.chevronOpen)} />
          </button>
        </H>
        {action && <div className={styles.collapseAction}>{action}</div>}
      </div>
      <div id={bodyId} hidden={!open} className={styles.collapseBody}>
        {children}
      </div>
    </section>
  );
}

function StaticSection({ title, count, action, meta, children, className, id, titleAs = 'h2' }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={cx(styles.section, className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || action) && (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            {title && <SectionTitle as={titleAs} id={headingId}>{withCount(title, count)}</SectionTitle>}
            {meta && <div className={styles.sectionMeta}>{meta}</div>}
          </div>
          {action && <div className={styles.sectionAction}>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Divider({ inset = false }: { inset?: boolean }) {
  return <hr className={cx(styles.divider, inset && styles.dividerInset)} />;
}
