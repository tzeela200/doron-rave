import { BUSINESS_TIMEZONE } from './constants';

// Business dates are ISO 'yyyy-MM-dd' strings end to end (Book 04 §3, Book 08 §17).
// Comparing two ISO dates as strings is equivalent to comparing the dates.

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayIso(now: Date = new Date()): string {
  return isoFormatter.format(now);
}

function isoToUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from `fromIso` to `toIso` (negative = past). */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = isoToUtc(fromIso);
  const b = isoToUtc(toIso);
  return a === null || b === null ? null : Math.round((b - a) / 86_400_000);
}

export function isIsoDate(value: string): boolean {
  return isoToUtc(value) !== null;
}
