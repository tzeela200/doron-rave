// Shared formatters (Book 06 §45). One implementation each; a null input never becomes "0".

const moneyFmt = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyFmtFixed = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });

/**
 * ₪ amount. Whole shekels show without agorot; amounts with agorot show both digits.
 * Returns null for null so the caller must decide how "no value" reads.
 */
export function formatMoney(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const body = Number.isInteger(Math.round(abs * 100) / 100) ? moneyFmt.format(abs) : moneyFmtFixed.format(abs);
  // U+2066/U+2069 isolate the number so the minus and ₪ stay put inside RTL text.
  return `⁦${value < 0 ? '-' : ''}₪${body}⁩`;
}

export function formatNumber(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return numberFmt.format(value);
}

/** Israeli display date dd.MM.yyyy from an ISO date (Book 11 §31). */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

const weekdayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' });

export function formatWeekday(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return weekdayFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

const monthShortFmt = new Intl.DateTimeFormat('he-IL', { month: 'short', timeZone: 'UTC' });

/** Day + short month for a date chip ("24" / "ספט׳"); null for a missing date. */
export function formatDayMonth(iso: string | null | undefined): { day: string; month: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { day: String(Number(m[3])), month: monthShortFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))) };
}

/** Show length in Hebrew, same wording as the legacy formatter. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} דקות`;
  if (!rest) return hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`;
  return `${hours}:${String(rest).padStart(2, '0')} שעות`;
}

/** Days relative to an event: "עוד 5 ימים" / "היום" / "לפני 3 ימים". */
export function formatDaysLabel(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days === -1) return 'אתמול';
  if (days > 0) return `עוד ${numberFmt.format(days)} ימים`;
  return `לפני ${numberFmt.format(-days)} ימים`;
}

/** Local timestamp → dd.MM.yyyy in Israel time (for created_at on notes). */
export function formatTimestampDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return formatDate(parts);
}
