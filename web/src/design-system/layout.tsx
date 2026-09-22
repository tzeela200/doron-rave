import type { CSSProperties, ElementType, ReactNode } from 'react';
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
  /** Optional right-aligned (inline-end) action, e.g. an "add" button. */
  action?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  titleAs?: 'h2' | 'h3';
}

/** A titled region of a screen, always with the same title→content gap. */
export function Section({ title, action, meta, children, className, id, titleAs = 'h2' }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={cx(styles.section, className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || action) && (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            {title && <SectionTitle as={titleAs} id={headingId}>{title}</SectionTitle>}
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
