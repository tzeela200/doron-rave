// Business constants (Book 04 §2, §14, Book 03 §7). One place; never scattered in screens.

export const EXPENSE_MANUAL_STATUS = { PLANNED: 'מתוכנן', AGREED: 'סוכם' } as const;
export type ExpenseManualStatus = (typeof EXPENSE_MANUAL_STATUS)[keyof typeof EXPENSE_MANUAL_STATUS];
export const EXPENSE_MANUAL_STATUSES: readonly ExpenseManualStatus[] = ['מתוכנן', 'סוכם'];

/** Computed from payments; never stored, never overwrites the manual status (Book 04 §2.2). */
export const EXPENSE_COMPUTED_STATUS = { PARTIALLY_PAID: 'שולם חלקית', PAID: 'שולם' } as const;
export type ExpenseStatus = ExpenseManualStatus | (typeof EXPENSE_COMPUTED_STATUS)[keyof typeof EXPENSE_COMPUTED_STATUS];

export const PAYMENT_STATUS = { PLANNED: 'מתוכנן', PENDING: 'ממתין לתשלום', PAID: 'שולם' } as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['מתוכנן', 'ממתין לתשלום', 'שולם'];

/** Display-only badge; never a payment_status (Book 04 §2.1). */
export const OVERDUE_LABEL = 'באיחור';

/** The artists category is identified by name, as in the legacy system (Config.gs). */
export const ARTISTS_CATEGORY_NAME = 'אמנים';

/** Manual progress of a readiness checklist item (user decision 2026-09-23). Work, not money. */
export const READINESS_COMPLETION = { NOT_STARTED: 'לא התחיל', IN_PROGRESS: 'בטיפול', DONE: 'בוצע' } as const;
export type ReadinessCompletion = (typeof READINESS_COMPLETION)[keyof typeof READINESS_COMPLETION];
export const READINESS_COMPLETIONS: readonly ReadinessCompletion[] = ['לא התחיל', 'בטיפול', 'בוצע'];

/** A payment is "this week" within this many days (Book 04 §14). */
export const ATTENTION_HORIZON_DAYS = 7;
/** An event is "approaching" for readiness purposes within this many days (Book 04 §14). */
export const EVENT_READINESS_HORIZON_DAYS = 30;

export const BUSINESS_TIMEZONE = 'Asia/Jerusalem';

export const NOTE_ENTITY = { EVENT: 'event', ARTIST: 'artist' } as const;
export type NoteEntityType = (typeof NOTE_ENTITY)[keyof typeof NOTE_ENTITY];
export const NOTE_TYPE = { NOTE: 'note', REMINDER: 'reminder' } as const;
export type NoteType = (typeof NOTE_TYPE)[keyof typeof NOTE_TYPE];

export const CLONE_MODE = { STRUCTURE: 'structure', ALL: 'all' } as const;
export type CloneMode = (typeof CLONE_MODE)[keyof typeof CLONE_MODE];

/** The one private bucket (Book 03 §15); posters live under event/{event_id}/… */
export const EVENT_IMAGE_BUCKET = 'dorons-rave';
/** Signed URL lifetime for a poster, in seconds. */
export const EVENT_IMAGE_URL_TTL = 60 * 60;

export const MAX_TICKET_TIERS = 20;
export const COVERAGE_LABEL_MAX = 60;
