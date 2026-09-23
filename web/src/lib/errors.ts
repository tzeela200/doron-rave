// Error model (Book 08 §25). The user always sees calm Hebrew from Book 11 §13–14; the
// technical detail goes to the console for the developer only, without payloads.

export type AppErrorKind = 'VALIDATION' | 'DOMAIN' | 'NOT_FOUND' | 'CONFLICT' | 'NETWORK' | 'DB' | 'AUTH';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: string;
  readonly userMessage: string;
  readonly operation: string;

  constructor(kind: AppErrorKind, code: string, userMessage: string, operation: string) {
    super(`${operation}: ${kind}/${code}`);
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
    this.userMessage = userMessage;
    this.operation = operation;
  }
}

export const MESSAGES = {
  load: 'לא הצלחנו לטעון את הנתונים. נסה שוב.',
  save: 'לא הצלחנו לשמור. הפרטים שהזנת נשארו כאן.',
  network: 'אין כרגע חיבור. בדוק את החיבור ונסה שוב.',
  auth: 'אין הרשאה לבצע את הפעולה.',
  notFound: 'הפריט לא נמצא או שאינו זמין יותר.',
} as const;

/** DOMAIN:<code> raised by the database functions → canonical microcopy. */
const DOMAIN_MESSAGES: Record<string, string> = {
  expense_name_required: 'יש להזין שם הוצאה',
  income_name_required: 'יש להזין מקור הכנסה',
  event_name_required: 'יש להזין שם אירוע',
  event_date_required: 'יש להזין תאריך אירוע',
  category_required: 'יש לבחור קטגוריה',
  readiness_status_invalid: 'סטטוס ביצוע לא תקין',
  required_item_not_found: 'הרכיב לא נמצא',
  amount_invalid: 'יש להזין סכום תקין',
  payment_amount_invalid: 'יש להזין סכום תקין',
  performance_times_equal: 'שעת ההתחלה ושעת הסיום לא יכולות להיות זהות',
  event_hours_equal: 'שעת ההתחלה ושעת הסיום של האירוע לא יכולות להיות זהות',
  performance_end_missing: 'יש להזין גם שעת סיום',
  performance_start_missing: 'יש להזין גם שעת התחלה',
  performance_only_artists: 'שעות הופעה נשמרות רק להוצאת אמן',
  tier_quantity_invalid: 'כמות בסבב חייבת להיות מספר שלם גדול מ־0',
  tier_price_invalid: 'יש להזין מחיר תקין לסבב',
  tiers_too_many: 'אפשר להגדיר עד 20 סבבי תמחור',
  ticket_count_invalid: 'יש להזין מספר כרטיסים שלם',
  event_not_found: MESSAGES.notFound,
  expense_not_found: MESSAGES.notFound,
  payment_not_found: MESSAGES.notFound,
  income_not_found: MESSAGES.notFound,
  category_not_found: MESSAGES.notFound,
};

interface PostgrestLike {
  code?: string;
  message?: string;
  status?: number;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Normalises anything thrown by a repository into an AppError.
 * `fallback` is the message for an unexplained failure of this operation (load vs save).
 */
export function toAppError(raw: unknown, operation: string, fallback: string = MESSAGES.save): AppError {
  if (raw instanceof AppError) return raw;
  const err = (raw ?? {}) as PostgrestLike & { name?: string };

  let result: AppError;
  const domain = /DOMAIN:([a-z_]+)/.exec(err.message ?? '');
  if (domain?.[1]) {
    const code = domain[1];
    result = new AppError(code.endsWith('not_found') ? 'NOT_FOUND' : 'DOMAIN', code, DOMAIN_MESSAGES[code] ?? fallback, operation);
  } else if (isOffline() || err.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(err.message ?? '')) {
    result = new AppError('NETWORK', 'network', MESSAGES.network, operation);
  } else if (err.code === '42501' || err.code === 'PGRST301' || err.status === 401 || err.status === 403) {
    result = new AppError('AUTH', err.code ?? 'auth', MESSAGES.auth, operation);
  } else if (err.code === 'PGRST116') {
    result = new AppError('NOT_FOUND', err.code, MESSAGES.notFound, operation);
  } else if (err.code === '23505') {
    result = new AppError('CONFLICT', err.code, fallback, operation);
  } else {
    result = new AppError('DB', err.code ?? 'unknown', fallback, operation);
  }

  if (import.meta.env.DEV) {
    // Technical context for the developer only (Book 08 §26) — never shown to the user.
    console.warn(`[${operation}]`, result.kind, err.code ?? '', err.message ?? raw);
  }
  return result;
}

/** Message for UI given any error value. */
export function userMessage(error: unknown, fallback: string = MESSAGES.save): string {
  return error instanceof AppError ? error.userMessage : fallback;
}
