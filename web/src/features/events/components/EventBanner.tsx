import type { ReactNode } from 'react';
import bannerImage from '@/assets/event-banner.webp';
import { cx } from '@/design-system/Typography';
import styles from './EventBanner.module.css';

// Book 02 V3 §8: a 72px strip from an existing brand asset (blurred) under a soft dark gradient.
// Events have no image of their own and none is invented, so the event card and the event hero
// share this one banner. Content (e.g. the days badge) sits at its top end.

/** `hero` = the taller focal banner (Top Design Review §1, 128px) with stronger contrast. */
export function EventBanner({ children, bleed = true, hero = false, className }: { children?: ReactNode; bleed?: boolean; hero?: boolean; className?: string }) {
  return (
    <div className={cx(styles.banner, bleed && styles.bleed, hero && styles.hero, className)} style={{ backgroundImage: `url(${bannerImage})` }}>
      {children}
    </div>
  );
}
