import { useState, type ReactNode } from 'react';
import bannerImage from '@/assets/event-banner.webp';
import { PosterDialog } from '@/design-system/overlay';
import { cx } from '@/design-system/Typography';
import { useEventImageUrl } from '@/features/queries';
import styles from './EventBanner.module.css';

// Book 02 V3 §8: a 72px strip from an existing brand asset (blurred) under a soft dark gradient.
// Events have no image of their own and none is invented, so the event card and the event hero
// share this one banner. Content (e.g. the days badge) sits at its top end.

/** `hero` = the taller focal banner (Top Design Review §1, 128px) with stronger contrast. */
export function EventBanner({ imagePath = null, children, bleed = true, hero = false, poster: isPoster = false, eventName, className }: {
  imagePath?: string | null;
  children?: ReactNode;
  bleed?: boolean;
  hero?: boolean;
  /** The event screen's strip: taller, and one tap opens the poster whole. */
  poster?: boolean;
  eventName?: string;
  className?: string;
}) {
  // The event's own poster when it has one; otherwise the shared brand banner.
  const poster = useEventImageUrl(imagePath);
  const [open, setOpen] = useState(false);
  const image = poster.data ?? bannerImage;
  const style = { ['--banner-image' as string]: `url("${image}")` };
  const classes = cx(styles.banner, bleed && styles.bleed, hero && styles.hero, isPoster && styles.poster, className);

  // A poster is worth opening; the brand banner is decoration, so it stays a plain strip.
  if (isPoster && poster.data) {
    return (
      <>
        <button type="button" className={classes} style={style} onClick={() => setOpen(true)} aria-label={`הצג את תמונת האירוע${eventName ? ` ${eventName}` : ''} בגודל מלא`}>
          {children}
          <span className={styles.openHint}>הצג תמונה מלאה</span>
        </button>
        {open && <PosterDialog src={poster.data} alt={eventName ? `תמונת האירוע ${eventName}` : 'תמונת האירוע'} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return <div className={classes} style={style}>{children}</div>;
}
