// DEV-ONLY sample view-models for the visual QA harness (Book 06 §53). These are NOT real data
// and never reach the database or a production build. Every name is prefixed "דוגמה" on purpose.

import type { ArtistVM } from '@/features/artists/data/artistsRepository';
import type { CategoryTree, CategoryVM } from '@/features/categories/data/categoriesRepository';
import { computeEventPnl, type TicketTier } from '@/domain/pnl';
import type { EventSummaryVM } from '@/features/events/data/eventsRepository';
import type { ExpenseVM, PaymentVM, UpcomingPaymentVM } from '@/features/expenses/data/expensesRepository';
import type { HomeSummaryVM } from '@/features/home/data/homeRepository';
import type { IncomeVM } from '@/features/income/data/incomeRepository';
import type { NoteVM } from '@/features/notes/data/notesRepository';
import type { PaymentMethodVM } from '@/features/payments/data/paymentMethodsRepository';
import type { EventBreakdownVM } from '@/features/reports/data/reportsRepository';
import type { VendorVM } from '@/features/vendors/data/vendorsRepository';
import type { RequiredItem } from '@/domain/readiness';

export const HARNESS_EVENT_ID = 'dev-event-1';
export const HARNESS_EVENT2_ID = 'dev-event-2';
export const HARNESS_EXPENSE_ID = 'dev-exp-sound';

const cat = (id: string, name: string, subs: [string, string][], isArtists = false): CategoryVM => ({
  id, name, sortOrder: 0, isVisible: true, isArchived: false, isArtists,
  subcategories: subs.map(([sid, sname], i) => ({ id: sid, categoryId: id, name: sname, sortOrder: i, isVisible: true, isArchived: false })),
});

const categories: CategoryVM[] = [
  cat('c-art', 'אמנים', [], true),
  cat('c-tech', 'ציוד טכני (דוגמה)', [['s-sound', 'הגברה'], ['s-light', 'תאורה'], ['s-gen', 'גנרטור']]),
  cat('c-site', 'תשתית ומיקום (דוגמה)', [['s-rent', 'השכרת שטח'], ['s-toilets', 'שירותים כימיים']]),
];

export const categoryTree: CategoryTree = {
  categories,
  categoryById: new Map(categories.map((c) => [c.id, c])),
  subcategoryById: new Map(categories.flatMap((c) => c.subcategories.map((s) => [s.id, s] as const))),
  artistsCategoryId: 'c-art',
};

function event(id: string, name: string, date: string, days: number, over: Partial<EventSummaryVM>, tiers: TicketTier[] = []): EventSummaryVM {
  const base = {
    id, name, eventDate: date, startTime: null, endTime: null, location: 'מיקום לדוגמה', generalNotes: '', isArchived: false, isUpcoming: days >= 0, daysUntil: days,
    averageTicketPrice: null, expectedTicketCount: null, agreedExpenses: 0, plannedExpenses: 0, paidTotal: 0, remainingToPay: 0,
    incomeTotal: 0, ticketIncome: 0, nonTicketIncome: 0, ticketsSold: 0, balance: 0, expensesCount: 0, artistsCount: 0, tiers,
    ...over,
  };
  return {
    ...base,
    pnl: computeEventPnl({
      plannedExpenses: base.plannedExpenses, ticketsSold: base.ticketsSold, ticketIncome: base.ticketIncome,
      nonTicketIncome: base.nonTicketIncome, averageTicketPrice: base.averageTicketPrice, expectedTicketCount: base.expectedTicketCount, tiers,
    }),
  };
}

export const events: EventSummaryVM[] = [
  event(HARNESS_EVENT_ID, 'אירוע דוגמה — Desert', '2026-10-15', 23, { startTime: '22:00', endTime: '07:00',
    agreedExpenses: 9800, plannedExpenses: 10300, paidTotal: 3400, remainingToPay: 6400, incomeTotal: 4299.7,
    ticketIncome: 4000, nonTicketIncome: 299.7, ticketsSold: 40, balance: -5500.3, expensesCount: 4, artistsCount: 2,
    averageTicketPrice: 100, expectedTicketCount: 180,
  }),
  event(HARNESS_EVENT2_ID, 'אירוע דוגמה — Full Moon', '2026-11-02', 41, {
    agreedExpenses: 15000, plannedExpenses: 15000, remainingToPay: 15000, balance: -15000, expensesCount: 3,
  }, [{ name: 'מוקדם', quantity: 100, price: 100 }, { name: 'רגיל', quantity: 100, price: 200 }]),
  event('dev-event-3', 'אירוע דוגמה ללא תחזית', '2026-12-01', 70, { agreedExpenses: 2000, plannedExpenses: 2000, remainingToPay: 2000, balance: -2000 }),
];

const expense = (over: Partial<ExpenseVM> & Pick<ExpenseVM, 'id' | 'name' | 'categoryId' | 'categoryName'>): ExpenseVM => ({
  eventId: HARNESS_EVENT_ID, subcategoryId: null, subcategoryName: null, isArtist: false, vendorId: null, vendorName: null,
  artistId: null, artistName: null, artistRealName: null, plannedAmount: 0, agreedAmount: 0, paidAmount: 0, remainingAmount: 0,
  manualStatus: 'מתוכנן', computedStatus: 'מתוכנן', hasOverdue: false, nextDueDate: null, paymentsCount: 0, expenseDate: null,
  paidBy: '', internalNotes: '', startTime: null, endTime: null, durationMinutes: null, hourlyCost: null, coverage: [],
  ...over,
});

export const expenses: ExpenseVM[] = [
  expense({ id: HARNESS_EXPENSE_ID, name: 'הגברה', categoryId: 'c-tech', categoryName: 'ציוד טכני (דוגמה)', subcategoryId: 's-sound', subcategoryName: 'הגברה',
    vendorId: 'v1', vendorName: 'ספק דוגמה א', plannedAmount: 1500, agreedAmount: 1000, paidAmount: 400, remainingAmount: 600, manualStatus: 'סוכם',
    computedStatus: 'שולם חלקית', hasOverdue: true, paymentsCount: 2 }),
  expense({ id: 'dev-exp-rent', name: 'השכרת שטח', categoryId: 'c-site', categoryName: 'תשתית ומיקום (דוגמה)', subcategoryId: 's-rent', subcategoryName: 'השכרת שטח',
    vendorId: 'v2', vendorName: 'ספק דוגמה ב', agreedAmount: 3800, remainingAmount: 800, paidAmount: 3000, manualStatus: 'סוכם', computedStatus: 'שולם חלקית',
    coverage: [{ id: 'cov1', categoryId: null, subcategoryId: 's-toilets', customLabel: null }] }),
  expense({ id: 'dev-exp-dj1', name: 'DJ דוגמה 1', categoryId: 'c-art', categoryName: 'אמנים', isArtist: true, artistId: 'a1', artistName: 'DJ דוגמה 1',
    agreedAmount: 3000, remainingAmount: 3000, manualStatus: 'סוכם', computedStatus: 'סוכם', startTime: '23:00', endTime: '01:00', durationMinutes: 120, hourlyCost: 1500 }),
  expense({ id: 'dev-exp-dj2', name: 'DJ דוגמה 2', categoryId: 'c-art', categoryName: 'אמנים', isArtist: true, artistId: 'a2', artistName: 'DJ דוגמה 2', artistRealName: 'שם אמיתי לדוגמה',
    agreedAmount: 2000, remainingAmount: 2000, startTime: '00:30', endTime: '02:00', durationMinutes: 90, hourlyCost: 1333 }),
];

export const payments: PaymentVM[] = [
  { id: 'p1', expenseId: HARNESS_EXPENSE_ID, amount: 400, dueDate: '2026-09-10', paidDate: '2026-09-10', paymentMethodId: 'm1', paymentMethodName: 'Bit', status: 'שולם', note: 'תשלום ראשון', isOverdue: false },
  { id: 'p2', expenseId: HARNESS_EXPENSE_ID, amount: 600, dueDate: '2026-09-20', paidDate: null, paymentMethodId: null, paymentMethodName: null, status: 'ממתין לתשלום', note: '', isOverdue: true },
];

export const upcoming: UpcomingPaymentVM[] = [
  { paymentId: 'p2', expenseId: HARNESS_EXPENSE_ID, expenseName: 'הגברה', eventId: HARNESS_EVENT_ID, eventName: 'אירוע דוגמה — Desert', amount: 600, dueDate: '2026-09-20', status: 'ממתין לתשלום', isOverdue: true, daysUntilDue: -2 },
  { paymentId: 'p3', expenseId: 'dev-exp-rent', expenseName: 'השכרת שטח', eventId: HARNESS_EVENT_ID, eventName: 'אירוע דוגמה — Desert', amount: 800, dueDate: '2026-09-26', status: 'מתוכנן', isOverdue: false, daysUntilDue: 4 },
];

export const income: IncomeVM[] = [
  { id: 'i1', eventId: HARNESS_EVENT_ID, name: 'כרטיסים — מכירה מוקדמת', quantity: 40, unitPrice: 100, totalAmount: 4000, notes: '', isTicketIncome: true },
  { id: 'i2', eventId: HARNESS_EVENT_ID, name: 'בר', quantity: 3, unitPrice: 99.9, totalAmount: 299.7, notes: '', isTicketIncome: false },
];

export const requiredItems: RequiredItem[] = [
  { id: 'r1', categoryId: null, subcategoryId: 's-sound' },
  { id: 'r2', categoryId: null, subcategoryId: 's-toilets' },
  { id: 'r3', categoryId: null, subcategoryId: 's-light' },
  { id: 'r4', categoryId: 'c-art', subcategoryId: null },
];

export const notes: NoteVM[] = [
  { id: 'n1', type: 'reminder', content: 'תזכורת לדוגמה: לאשר שעות עם הצוות', reminderDate: '2026-10-01', isCompleted: false, createdAt: '2026-09-20T09:00:00Z' },
  { id: 'n2', type: 'note', content: 'הערה לדוגמה', reminderDate: null, isCompleted: false, createdAt: '2026-09-18T09:00:00Z' },
];

export const breakdown: EventBreakdownVM = {
  byCategory: [
    { keyId: 'c-art', label: 'אמנים', amount: 5000, count: 2, subcategories: [] },
    { keyId: 'c-site', label: 'תשתית ומיקום (דוגמה)', amount: 3800, count: 1, subcategories: [{ keyId: 's-rent', label: 'השכרת שטח', amount: 3800, count: 1 }] },
    { keyId: 'c-tech', label: 'ציוד טכני (דוגמה)', amount: 1000, count: 1, subcategories: [{ keyId: 's-sound', label: 'הגברה', amount: 1000, count: 1 }] },
  ],
  byVendor: [
    { keyId: null, label: 'ללא ספק', amount: 5000, count: 2 },
    { keyId: 'v2', label: 'ספק דוגמה ב', amount: 3800, count: 1 },
    { keyId: 'v1', label: 'ספק דוגמה א', amount: 1000, count: 1 },
  ],
};

export const home: HomeSummaryVM = {
  activeEventsCount: 3, plannedExpenses: 27300, agreedExpenses: 26800, paidTotal: 3400, remainingToPay: 23400,
  incomeTotal: 4299.7, ticketIncome: 4000, ticketsSold: 40,
};

const usage = { eventsCount: 1, totalAgreed: 3000, nextEvent: { id: HARNESS_EVENT_ID, name: 'אירוע דוגמה — Desert', date: '2026-10-15' } };
export const artists: ArtistVM[] = [
  { id: 'a1', displayName: 'DJ דוגמה 1', realNameSecondary: null, stageName: 'DJ דוגמה 1', realName: '', legacyName: null, phone: '050-0000000', contactDetails: '', notes: '', systemNotes: '', isArchived: false, ...usage },
  { id: 'a2', displayName: 'DJ דוגמה 2', realNameSecondary: 'שם אמיתי לדוגמה', stageName: 'DJ דוגמה 2', realName: 'שם אמיתי לדוגמה', legacyName: null, phone: '', contactDetails: '', notes: '', systemNotes: '', isArchived: false, ...usage, totalAgreed: 2000 },
];
export const vendors: VendorVM[] = [
  { id: 'v1', name: 'ספק דוגמה א', phone: '052-0000000', contactDetails: '', notes: '', isArchived: false, ...usage, totalAgreed: 1000 },
  { id: 'v2', name: 'ספק דוגמה ב', phone: '', contactDetails: '', notes: '', isArchived: false, ...usage, totalAgreed: 3800 },
];
export const methods: PaymentMethodVM[] = ['מזומן', 'Bit', 'העברה בנקאית', 'PayBox', 'אשראי', 'אחר']
  .map((name, i) => ({ id: `m${i}`, name, sortOrder: i, isActive: true }));
