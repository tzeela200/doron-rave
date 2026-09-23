import { artistDisplayName, artistSecondaryName } from './artists';
import { daysBetween, todayIso } from './dates';
import {
  buildLineup,
  findOverlaps,
  hourlyCost,
  nightSortKey,
  performanceDurationMinutes,
  validatePerformanceTimes,
  type LineupSource,
} from './lineup';
import { lineTotal, parseAmount } from './money';
import { computeEventPnl, ticketsToCover, type PnlInput } from './pnl';
import { buildReadiness, type ReadinessExpense, type RequiredItem } from './readiness';

// Acceptance cases from Book 04 §24 and Book 10 §12–§17. Values are test fixtures.

const basePnl: PnlInput = {
  plannedExpenses: 0,
  ticketsSold: 0,
  ticketIncome: 0,
  nonTicketIncome: 0,
  averageTicketPrice: null,
  expectedTicketCount: null,
  tiers: [],
};

describe('money', () => {
  it('IN-01 income 3 × 99.90 = 299.70', () => {
    expect(lineTotal(3, 99.9)).toBe(299.7);
  });
  it('rounds to the agora without float drift', () => {
    expect(lineTotal(3, 0.1)).toBe(0.3);
    expect(lineTotal(7, 19.99)).toBe(139.93);
  });
  it('empty amount stays null, never 0', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('P&L / break-even (Book 04 §6, Book 10 §13)', () => {
  it('planned 1,000; non-ticket 200; price 200 → remaining cost 800, break-even 4', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 1000, nonTicketIncome: 200, averageTicketPrice: 200 });
    expect(p.remainingCostToCover).toBe(800);
    expect(p.breakEvenTickets).toBe(4);
  });
  it('PL-01/02 planned 100,000; price 200 → 500; sold 300 → 200 remaining', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 100_000, averageTicketPrice: 200, ticketsSold: 300, ticketIncome: 60_000 });
    expect(p.breakEvenTickets).toBe(500);
    expect(p.breakEvenRemaining).toBe(200);
  });
  it('PL-03 non-ticket income lowers the cost to cover', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 100_000, nonTicketIncome: 20_000, averageTicketPrice: 200 });
    expect(p.remainingCostToCover).toBe(80_000);
    expect(p.breakEvenTickets).toBe(400);
  });
  it('PL-04 expected 600 × 200 on 100,000 planned → income 120,000, profit 20,000', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 100_000, averageTicketPrice: 200, expectedTicketCount: 600 });
    expect(p.forecastTicketIncome).toBe(120_000);
    expect(p.forecastProfit).toBe(20_000);
  });
  it('PL-06 no price and no sales → break-even null, not 0', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 5000 });
    expect(p.breakEvenTickets).toBeNull();
    expect(p.breakEvenRemaining).toBeNull();
    expect(p.forecastProfit).toBeNull();
  });
  it('PL-07 sold beyond break-even → remaining 0, never negative', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 2000, averageTicketPrice: 200, ticketsSold: 14, ticketIncome: 2800 });
    expect(p.breakEvenTickets).toBe(10);
    expect(p.breakEvenRemaining).toBe(0);
  });
  it('PL-08 negative forecast stays negative in the data (UI shows הפסד צפוי)', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 100_000, averageTicketPrice: 100, expectedTicketCount: 500 });
    expect(p.forecastProfit).toBe(-50_000);
  });
  it('forecast needs both a price and an expected count (Book 04 §6.1)', () => {
    expect(computeEventPnl({ ...basePnl, plannedExpenses: 1000, averageTicketPrice: 100 }).forecastProfit).toBeNull();
    expect(computeEventPnl({ ...basePnl, plannedExpenses: 1000, expectedTicketCount: 100 }).forecastProfit).toBeNull();
  });
  it('entered average price wins over the actual average (Book 04 §7.2)', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 2300, averageTicketPrice: 200, ticketsSold: 10, ticketIncome: 2300 });
    expect(p.actualAverageTicketPrice).toBe(230);
    expect(p.averageTicketPriceUsed).toBe(200);
    expect(p.breakEvenTickets).toBe(12);
  });
  it('actual average is used when no price was entered', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 1000, ticketsSold: 4, ticketIncome: 400 });
    expect(p.averageTicketPriceUsed).toBe(100);
    expect(p.breakEvenTickets).toBe(10);
  });
});

describe('ticket tiers (Book 04 §7, Book 10 §14)', () => {
  it('Book 04 §24: tiers 100×100 + 100×200, cost 15,000 → 125', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 15_000, tiers: [
      { name: 'א', quantity: 100, price: 100 },
      { name: 'ב', quantity: 100, price: 200 },
    ] });
    expect(p.breakEvenTickets).toBe(125);
    expect(p.breakEvenUnreachable).toBe(false);
  });
  it('TT-01 fills tiers in sale order, not by price', () => {
    const cheapFirst = ticketsToCover([{ name: 'a', quantity: 100, price: 100 }, { name: 'b', quantity: 100, price: 200 }], 1_500_000);
    const dearFirst = ticketsToCover([{ name: 'b', quantity: 100, price: 200 }, { name: 'a', quantity: 100, price: 100 }], 1_500_000);
    expect(cheapFirst.tickets).toBe(125);
    expect(dearFirst.tickets).toBe(75);
  });
  it('TT-03 all tiers together cannot cover the cost → null + unreachable', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 50_000, tiers: [{ name: 'א', quantity: 100, price: 100 }] });
    expect(p.breakEvenTickets).toBeNull();
    expect(p.breakEvenUnreachable).toBe(true);
  });
  it('TT-04/TT-06 tiers override average price and expected count; expected income Σ q×p', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 10_000, averageTicketPrice: 999, expectedTicketCount: 5, tiers: [
      { name: 'מוקדם', quantity: 100, price: 150 },
      { name: 'רגיל', quantity: 150, price: 200 },
    ] });
    expect(p.expectedTicketCount).toBe(250);
    expect(p.forecastTicketIncome).toBe(45_000);
    expect(p.forecastProfit).toBe(35_000);
    expect(p.usesTiers).toBe(true);
  });
  it('TT-05 without tiers the single-price path is unchanged', () => {
    const p = computeEventPnl({ ...basePnl, plannedExpenses: 1000, averageTicketPrice: 200 });
    expect(p.usesTiers).toBe(false);
    expect(p.breakEvenTickets).toBe(5);
  });
});

describe('readiness (Book 04 §9, Book 10 §15)', () => {
  const labels = {
    categoryName: (id: string) => ({ c1: 'ציוד טכני', c2: 'אמנים' } as Record<string, string>)[id],
    subcategoryName: (id: string) => ({ s1: 'הגברה', s2: 'תאורה', s3: 'גנרטור', s4: 'אבטחה' } as Record<string, string>)[id],
    subcategoryParentName: () => 'ציוד טכני',
  };
  const expense = (over: Partial<ReadinessExpense>): ReadinessExpense => ({
    id: 'e', name: 'הוצאה', categoryId: 'c1', subcategoryId: null, agreedAmount: 0, manualStatus: 'מתוכנן', paidAmount: 0, ...over,
  });

  it('RD-01 empty list → not defined, no percentage (not 0%)', () => {
    const r = buildReadiness([], [expense({})], [], labels);
    expect(r.defined).toBe(false);
    expect(r.percent).toBeNull();
  });

  it('RD-02..RD-07 states and 75% for 3 of 4 closed', () => {
    const required: RequiredItem[] = [
      { id: 'r1', categoryId: null, subcategoryId: 's1' }, // covered: agreed + סוכם
      { id: 'r2', categoryId: null, subcategoryId: 's2' }, // included via coverage
      { id: 'r3', categoryId: null, subcategoryId: 's3' }, // covered: paid > 0
      { id: 'r4', categoryId: null, subcategoryId: 's4' }, // in progress
    ];
    const r = buildReadiness(
      required,
      [
        expense({ id: 'e1', subcategoryId: 's1', agreedAmount: 1000, manualStatus: 'סוכם' }),
        expense({ id: 'e2', subcategoryId: 's3', agreedAmount: 500, paidAmount: 100 }),
        expense({ id: 'e3', subcategoryId: 's4', agreedAmount: 0 }),
        expense({ id: 'e4', subcategoryId: 's2', agreedAmount: 0 }), // in progress, but coverage outranks it
      ],
      [{ expenseId: 'e9', expenseName: 'השכרת שטח', categoryId: null, subcategoryId: 's2', customLabel: null }],
      labels,
    );
    expect(r.items.map((i) => i.state)).toEqual(['covered', 'included', 'covered', 'in_progress']);
    expect(r.items[1]?.includedByLabel).toBe('השכרת שטח');
    expect(r.coveragePercent).toBe(75);
    expect(r.closed).toBe(3);
    // Coverage no longer drives the percentage: nothing was marked by hand yet.
    expect(r.percent).toBe(0);
    expect(r.completed).toBe(0);
  });

  it('RD-08 the percentage counts items marked בוצע, not items with an expense', () => {
    const required: RequiredItem[] = [
      { id: 'r1', categoryId: null, subcategoryId: 's1', completion: 'בוצע' },
      { id: 'r2', categoryId: null, subcategoryId: 's2', completion: 'בטיפול' },
      { id: 'r3', categoryId: null, subcategoryId: 's3' }, // no status yet → not started
      { id: 'r4', categoryId: null, subcategoryId: 's4', completion: 'בוצע' },
    ];
    const r = buildReadiness(required, [expense({ id: 'e1', subcategoryId: 's3', agreedAmount: 1000, manualStatus: 'סוכם' })], [], labels);
    expect(r.completed).toBe(2);
    expect(r.inProgress).toBe(1);
    expect(r.percent).toBe(50);
    // the expense on s3 still reads as covered, and still counts as coverage
    expect(r.items[2]?.state).toBe('covered');
    expect(r.items[2]?.completion).toBe('לא התחיל');
    expect(r.closed).toBe(1);
    expect(r.coveragePercent).toBe(25);
  });

  it('RD-09 an item with no expense at all can still be marked בוצע', () => {
    const r = buildReadiness([{ id: 'r', categoryId: null, subcategoryId: 's1', completion: 'בוצע' }], [], [], labels);
    expect(r.items[0]?.state).toBe('missing'); // no money behind it — unchanged
    expect(r.percent).toBe(100);
  });

  it('RD-03 nothing on the item → missing', () => {
    const r = buildReadiness([{ id: 'r', categoryId: null, subcategoryId: 's1' }], [], [], labels);
    expect(r.items[0]?.state).toBe('missing');
    expect(r.missing).toBe(1);
    expect(r.percent).toBe(0); // 0% is real here: a list exists and nothing was done
  });

  it('RD-07 a closed expense outranks coverage (covered > included > in progress)', () => {
    const r = buildReadiness(
      [{ id: 'r', categoryId: null, subcategoryId: 's1' }],
      [expense({ id: 'e1', subcategoryId: 's1', agreedAmount: 10, manualStatus: 'סוכם' })],
      [{ expenseId: 'e2', expenseName: 'X', categoryId: null, subcategoryId: 's1', customLabel: null }],
      labels,
    );
    expect(r.items[0]?.state).toBe('covered');
  });

  it('matches by id, not by name; a category item is closed by an expense on that category', () => {
    const r = buildReadiness(
      [{ id: 'r', categoryId: 'c2', subcategoryId: null }],
      [expense({ id: 'e1', categoryId: 'c2', agreedAmount: 3000, manualStatus: 'סוכם', name: 'שם אחר לגמרי' })],
      [],
      labels,
    );
    expect(r.items[0]?.state).toBe('covered');
    expect(r.items[0]?.label).toBe('אמנים');
  });
});

describe('line-up (Book 04 §11, Book 10 §17)', () => {
  const slot = (id: string, start: string, end: string, agreed = 0): LineupSource => ({
    expenseId: id, artistId: id, displayName: `DJ ${id}`, expenseName: `DJ ${id}`, stageName: null, realName: null, start, end, agreedAmount: agreed,
  });

  it('AR-01 23:00–01:00 = 120 minutes', () => {
    expect(performanceDurationMinutes('23:00', '01:00')).toBe(120);
    expect(performanceDurationMinutes('23:00:00', '01:00:00')).toBe(120);
  });
  it('AR-02 equal times are invalid, never a 24h show', () => {
    expect(performanceDurationMinutes('22:00', '22:00')).toBeNull();
    expect(validatePerformanceTimes('22:00', '22:00')).toBe('equal');
  });
  it('AR-03 one time without the other blocks save', () => {
    expect(validatePerformanceTimes('22:00', '')).toBe('end_missing');
    expect(validatePerformanceTimes('', '23:00')).toBe('start_missing');
    expect(validatePerformanceTimes('', '')).toBeNull();
    expect(validatePerformanceTimes('23:00', '01:00')).toBeNull();
  });
  it('AR-04 touching at the edge is not an overlap', () => {
    const l = buildLineup([slot('a', '22:00', '23:00'), slot('b', '23:00', '01:00')]);
    expect(l.every((s) => s.overlapsWith.length === 0)).toBe(true);
  });
  it('AR-05 real intersection is a warning on both slots', () => {
    const l = buildLineup([slot('a', '22:00', '00:30'), slot('b', '23:30', '01:00')]);
    expect(l[0]?.overlapsWith).toEqual(['DJ b']);
    expect(l[1]?.overlapsWith).toEqual(['DJ a']);
    expect(findOverlaps({ expenseId: null, start: '00:00', end: '00:45' }, [slot('a', '22:00', '00:30')])).toEqual(['DJ a']);
  });
  it('AR-06 night order 21:00, 23:30, 00:30, 02:00', () => {
    const l = buildLineup([slot('c', '00:30', '01:30'), slot('d', '02:00', '03:00'), slot('a', '21:00', '22:00'), slot('b', '23:30', '00:30')]);
    expect(l.map((s) => s.start)).toEqual(['21:00', '23:30', '00:30', '02:00']);
    expect(nightSortKey('00:30')).toBeGreaterThan(nightSortKey('23:30') ?? 0);
  });
  it('AR-07 hourly cost = agreed ÷ hours, rounded, display only', () => {
    expect(hourlyCost(3000, 120)).toBe(1500);
    expect(hourlyCost(1000, 90)).toBe(667);
    expect(hourlyCost(0, 60)).toBeNull();
  });
  it('AR-08 an artist without times is not in the line-up', () => {
    const l = buildLineup([{ ...slot('a', '', ''), start: null, end: null }, slot('b', '22:00', '23:00')]);
    expect(l).toHaveLength(1);
  });
});

describe('artists', () => {
  it('display name = stage || legacy || real', () => {
    expect(artistDisplayName({ stage_name: '', legacy_name: 'ישן', real_name: 'אמיתי' })).toBe('ישן');
    expect(artistDisplayName({ stage_name: 'Stage', legacy_name: 'ישן', real_name: 'אמיתי' })).toBe('Stage');
    expect(artistSecondaryName({ stage_name: 'Stage', legacy_name: null, real_name: 'אמיתי' })).toBe('אמיתי');
    expect(artistSecondaryName({ stage_name: '', legacy_name: null, real_name: 'אמיתי' })).toBeNull();
  });
});

describe('dates', () => {
  it('today is computed in Asia/Jerusalem', () => {
    // 22:30 UTC on 21 Sep is already 22 Sep in Israel (UTC+3)
    expect(todayIso(new Date('2026-09-21T22:30:00Z'))).toBe('2026-09-22');
  });
  it('days between ISO dates', () => {
    expect(daysBetween('2026-09-22', '2026-09-29')).toBe(7);
    expect(daysBetween('2026-09-22', '2026-09-20')).toBe(-2);
  });
});
