import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { IconTile, type IconTone } from './Card';
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
  /** Colour of that icon tile, from the canonical palette (Book 02 V3 §5). */
  iconTone?: IconTone;
  /** Accordion form only: open by default. May turn true once data arrives; a user toggle wins. */
  defaultOpen?: boolean;
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

/** Ask a collapsible Section to open and scroll into view, from anywhere on the page. */
type OpenListener = (id: string) => void;
const openListeners = new Set<OpenListener>();
export function openSection(id: string) {
  openListeners.forEach((listener) => listener(id));
}
export function CollapsibleSections({ children }: { children: ReactNode }) {
  return <CollapsibleContext.Provider value>{children}</CollapsibleContext.Provider>;
}

/** A titled region of a screen, always with the same title→content gap. */
export function Section(props: SectionProps) {
  const collapsible = useContext(CollapsibleContext);
  return collapsible && props.title ? <CollapsibleSection {...props} /> : <StaticSection {...props} />;
}

function CollapsibleSection({ title, count, icon, iconTone = 'neutral', action, meta, children, className, id, defaultOpen = false, titleAs: H = 'h2' }: SectionProps) {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen;
  const setOpen = (f: (o: boolean) => boolean) => setToggled(f(open));
  const bodyId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!id) return undefined;
    const listener: OpenListener = (target) => {
      if (target !== id) return;
      setToggled(true);
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    openListeners.add(listener);
    return () => { openListeners.delete(listener); };
  }, [id]);

  return (
    <section ref={ref} className={cx(styles.section, className)} id={id}>
      <div className={cx(styles.collapseCard, styles[`tint-${iconTone}`], open && styles.collapseCardOpen)}>
        <H className={styles.collapseHeading}>
          <button type="button" className={styles.collapseHeader} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
            {icon && <IconTile icon={icon} tone={iconTone} />}
            <span className={styles.collapseText}>
              <span className={styles.collapseTitle}>{withCount(title, count)}</span>
              {meta && <span className={styles.collapseMeta}>{meta}</span>}
            </span>
          </button>
        </H>
        {action && <div className={styles.collapseAction}>{action}</div>}
        <Icon icon={ChevronDown} className={cx(styles.chevron, open && styles.chevronOpen)} />
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
