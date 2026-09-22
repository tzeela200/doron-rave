// Artists line-up (Book 04 §11; CALCULATIONS.md §6; ADR-035/036/037).
// One helper for duration, one for night ordering, one for overlap — used by the form and the
// line-up alike. Times come from Postgres as 'HH:MM:SS' or from inputs as 'HH:MM'.

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 'HH:MM' for display and inputs. */
export function toHHMM(value: string | null | undefined): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Show length in minutes. end < start crosses midnight (+24h). Equal times are invalid and
 * return null — never a 24-hour show.
 */
export function performanceDurationMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return null;
  let minutes = e - s;
  if (minutes === 0) return null;
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

/**
 * Event hours use the same arithmetic (UX addendum 2026-09-22 §10): duration only when both exist,
 * end < start crosses midnight, start == end shows no duration (never 24h). Information only —
 * it never feeds P&L, break-even or readiness.
 */
export function eventDurationMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  return performanceDurationMinutes(start, end);
}

/** Night order: hours before 12:00 belong to the night after (21:00 < 23:30 < 00:30 < 02:00). */
export function nightSortKey(value: string | null | undefined): number | null {
  const m = parseTimeToMinutes(value);
  if (m === null) return null;
  return m < 12 * 60 ? m + 24 * 60 : m;
}

/** Display-only hourly cost, rounded to whole shekels; never stored (Book 04 §11). */
export function hourlyCost(agreedAmount: number, durationMinutes: number | null): number | null {
  if (!durationMinutes || durationMinutes <= 0 || agreedAmount <= 0) return null;
  return Math.round(agreedAmount / (durationMinutes / 60));
}

export type PerformanceTimesError = 'start_missing' | 'end_missing' | 'equal' | 'invalid';

/** Save-blocking validation of a start/end pair. Both empty is valid (not in the line-up). */
export function validatePerformanceTimes(start: string, end: string): PerformanceTimesError | null {
  const hasStart = start.trim() !== '';
  const hasEnd = end.trim() !== '';
  if (!hasStart && !hasEnd) return null;
  if (hasStart && !hasEnd) return 'end_missing';
  if (!hasStart && hasEnd) return 'start_missing';
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 'invalid';
  if (s === e) return 'equal';
  return null;
}

export interface LineupSource {
  expenseId: string;
  artistId: string | null;
  displayName: string;
  realName: string | null;
  start: string | null;
  end: string | null;
  agreedAmount: number;
}

export interface LineupSlot {
  expenseId: string;
  artistId: string | null;
  displayName: string;
  realName: string | null;
  start: string;
  end: string;
  durationMinutes: number;
  hourlyCost: number | null;
  /** Names of the slots this one overlaps with. Warning only, never blocking. */
  overlapsWith: string[];
}

interface Interval {
  start: number;
  end: number;
}

function toInterval(start: string | null, end: string | null): Interval | null {
  const s = nightSortKey(start);
  const d = performanceDurationMinutes(start, end);
  if (s === null || d === null) return null;
  return { start: s, end: s + d };
}

/** Real intersection; touching at the edge (22:00–23:00 / 23:00–01:00) is not an overlap. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Only artist expenses with both times enter the line-up. Ordered by night sequence. */
export function buildLineup(sources: readonly LineupSource[]): LineupSlot[] {
  const slots = sources
    .map((src) => ({ src, interval: toInterval(src.start, src.end) }))
    .filter((x): x is { src: LineupSource; interval: Interval } => x.interval !== null)
    .sort((a, b) => a.interval.start - b.interval.start);

  return slots.map(({ src, interval }) => {
    const duration = interval.end - interval.start;
    return {
      expenseId: src.expenseId,
      artistId: src.artistId,
      displayName: src.displayName,
      realName: src.realName,
      start: toHHMM(src.start),
      end: toHHMM(src.end),
      durationMinutes: duration,
      hourlyCost: hourlyCost(src.agreedAmount, duration),
      overlapsWith: slots
        .filter((other) => other.src !== src && intervalsOverlap(interval, other.interval))
        .map((other) => other.src.displayName),
    };
  });
}

/** Overlap warning for a slot being edited, against the rest of the event's line-up. */
export function findOverlaps(
  candidate: { expenseId: string | null; start: string; end: string },
  others: readonly LineupSource[],
): string[] {
  const mine = toInterval(candidate.start, candidate.end);
  if (!mine) return [];
  return others
    .filter((o) => o.expenseId !== candidate.expenseId)
    .map((o) => ({ o, interval: toInterval(o.start, o.end) }))
    .filter((x): x is { o: LineupSource; interval: Interval } => x.interval !== null && intervalsOverlap(mine, x.interval))
    .map((x) => x.o.displayName);
}

/** First start → latest end of the night, for a one-line summary. Null when there are no slots. */
export function lineupSpan(slots: readonly LineupSlot[]): { start: string; end: string } | null {
  let first: LineupSlot | null = null;
  let last: { slot: LineupSlot; end: number } | null = null;
  for (const slot of slots) {
    const i = toInterval(slot.start, slot.end);
    if (!i) continue;
    if (!first || (nightSortKey(slot.start) ?? 0) < (nightSortKey(first.start) ?? 0)) first = slot;
    if (!last || i.end > last.end) last = { slot, end: i.end };
  }
  return first && last ? { start: first.start, end: last.slot.end } : null;
}

