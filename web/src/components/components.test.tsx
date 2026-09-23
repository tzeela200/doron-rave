import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Button } from '@/design-system/Button';
import { KpiCard } from '@/design-system/Card';
import { ToastProvider } from '@/design-system/feedback';
import { Field, Input } from '@/design-system/form';
import { computeEventPnl } from '@/domain/pnl';
import { EventCard } from '@/features/events/components/EventCard';
import type { EventSummaryVM } from '@/features/events/data/eventsRepository';
import { LineupRow } from '@/features/artists/components/LineupSection';
import { qk } from '@/lib/query/keys';
import { ExpenseStatusBadge, OverdueBadge, PaymentStatusBadge } from './StatusBadges';

// Component contract tests (Book 06 §53, Book 08 §39). Fixture values are test data.

const saveIncome = vi.fn();
vi.mock('@/features/income/data/incomeRepository', async (orig) => ({
  ...(await orig<typeof import('@/features/income/data/incomeRepository')>()),
  saveIncome: (...args: unknown[]) => saveIncome(...args),
  listEventIncome: vi.fn(async () => []),
}));

const setRequiredItemStatus = vi.fn();
vi.mock('@/features/readiness/data/readinessRepository', async (orig) => ({
  ...(await orig<typeof import('@/features/readiness/data/readinessRepository')>()),
  setRequiredItemStatus: (...args: unknown[]) => setRequiredItemStatus(...args),
}));

function wrap(ui: ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })) {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function eventVM(over: Partial<EventSummaryVM>): EventSummaryVM {
  const base = {
    id: 'e1', name: 'אירוע בדיקה', eventDate: '2026-10-15', startTime: null, endTime: null, location: 'מקום', generalNotes: '', isArchived: false, isUpcoming: true,
    daysUntil: 23, averageTicketPrice: null, expectedTicketCount: null, agreedExpenses: 1000, plannedExpenses: 1000, paidTotal: 0,
    remainingToPay: 1000, incomeTotal: 0, ticketIncome: 0, nonTicketIncome: 0, ticketsSold: 0, balance: -1000, expensesCount: 1,
    artistsCount: 0, tiers: [], ...over,
  };
  return { ...base, pnl: computeEventPnl({ ...base, tiers: base.tiers }) };
}

describe('Button', () => {
  it('loading keeps its label area, is busy, and swallows a second click (no double submit)', async () => {
    const onClick = vi.fn();
    render(<Button loading loadingText="שומר…" onClick={onClick}>שמור</Button>);
    const btn = screen.getByRole('button', { name: 'שומר…' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links label, hint and error to the control; error is text, not colour only', () => {
    render(<Field label="סכום" hint="עזרה" error="יש להזין סכום תקין" required>{(a) => <Input {...a} />}</Field>);
    const input = screen.getByRole('textbox', { name: /סכום/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/עזרה.*יש להזין סכום תקין/);
    expect(screen.getByRole('alert')).toHaveTextContent('יש להזין סכום תקין');
  });
});

describe('KpiCard', () => {
  it('null value shows the unavailable text, never 0', () => {
    render(<KpiCard label="נקודת איזון" value={null} empty="לא ניתן לחשב" />);
    expect(screen.getByText('לא ניתן לחשב')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('EventCard (Book 06 §30, ADR-060)', () => {
  it('without a forecast shows the actual balance as "יתרה", never "רווח צפוי"', () => {
    wrap(<EventCard event={eventVM({})} />);
    expect(screen.getByText('יתרה')).toBeInTheDocument();
    expect(screen.queryByText('רווח צפוי')).not.toBeInTheDocument();
  });
  it('negative forecast reads "הפסד צפוי" with an absolute value', () => {
    wrap(<EventCard event={eventVM({ plannedExpenses: 10000, averageTicketPrice: 50, expectedTicketCount: 100 })} />);
    expect(screen.getByText('הפסד צפוי')).toBeInTheDocument();
    expect(screen.getByText(/₪5,000/)).toBeInTheDocument();
  });
  it('unreachable tiers are stated, not shown as 0', () => {
    wrap(<EventCard event={eventVM({ plannedExpenses: 50000, tiers: [{ name: 'א', quantity: 10, price: 100 }] })} />);
    expect(screen.getByText('הסבבים אינם מכסים את העלות')).toBeInTheDocument();
  });
});

describe('status badges', () => {
  it('overdue is a separate derived badge; statuses never include "מקדמה"', () => {
    render(<><PaymentStatusBadge status="ממתין לתשלום" /><OverdueBadge /><ExpenseStatusBadge status="שולם חלקית" /></>);
    expect(screen.getByText('ממתין לתשלום')).toBeInTheDocument();
    expect(screen.getByText('באיחור')).toBeInTheDocument();
    expect(screen.getByText('שולם חלקית')).toBeInTheDocument();
    expect(screen.queryByText(/מקדמה/)).not.toBeInTheDocument();
  });
});

describe('LineupRow (Book 06 §36)', () => {
  it('shows the overlap as an inline warning, not a modal', () => {
    wrap(<ul><LineupRow eventId="e1" slot={{ expenseId: 'x', artistId: 'a', displayName: 'DJ א', expenseName: 'DJ א', stageName: null, realName: null, start: '22:00', end: '00:30', durationMinutes: 150, agreedAmount: 0, hourlyCost: null, overlapsWith: ['DJ ב'] }} /></ul>);
    expect(screen.getByText(/חפיפה בשעות עם DJ ב/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('J7 — save failure keeps the form (Book 10 §44, ADR-044)', () => {
  it('income: server failure shows a human error, keeps values, shows no success', async () => {
    const { IncomeSection } = await import('@/features/income/components/IncomeSection');
    saveIncome.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(qk.event.income('e1'), []);
    wrap(<IncomeSection eventId="e1" incomeTotal={0} />, client);

    await userEvent.click(screen.getByRole('button', { name: 'הוסף הכנסה' }));
    await userEvent.type(screen.getByRole('textbox', { name: /מקור ההכנסה/ }), 'בר');
    await userEvent.clear(screen.getByRole('textbox', { name: /כמות/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /כמות/ }), '3');
    await userEvent.type(screen.getByRole('textbox', { name: /מחיר ליחידה/ }), '99.90');
    expect(screen.getByText('₪299.70', { exact: false })).toBeInTheDocument(); // live preview, same helper as the server rule

    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));
    await waitFor(() => expect(screen.getAllByText('אין כרגע חיבור. בדוק את החיבור ונסה שוב.').length).toBeGreaterThan(0));
    expect(saveIncome).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: /מקור ההכנסה/ })).toHaveValue('בר');
    expect(screen.getByRole('textbox', { name: /מחיר ליחידה/ })).toHaveValue('99.90');
    expect(screen.queryByText('ההכנסה נשמרה')).not.toBeInTheDocument();

    // retry succeeds → success appears only after the server confirmed
    saveIncome.mockResolvedValueOnce('new-id');
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));
    await waitFor(() => expect(screen.getByText('ההכנסה נשמרה')).toBeInTheDocument());
    expect(saveIncome).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'בר', quantity: 3, unitPrice: 99.9, isTicketIncome: false }));
  });
});

describe('readiness checklist — marking work as done (user decision 2026-09-23)', () => {
  it('one tap marks בוצע and sends it to the server; the summary counts items, not percentages', async () => {
    const { ReadinessSection } = await import('@/features/readiness/components/ReadinessSection');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(qk.event.readiness('e1'), [
      { id: 'r1', categoryId: null, subcategoryId: 's1' },
      { id: 'r2', categoryId: null, subcategoryId: 's2' },
    ]);
    client.setQueryData(qk.event.expenses('e1'), []);
    client.setQueryData(qk.categories, {
      categories: [],
      categoryById: new Map(),
      subcategoryById: new Map([['s1', { id: 's1', name: 'הגברה' }], ['s2', { id: 's2', name: 'תאורה' }]]),
      artistsCategoryId: 'c-art',
    });
    setRequiredItemStatus.mockResolvedValueOnce(undefined);

    wrap(<ReadinessSection eventId="e1" />, client);
    // counts, never a percentage (user, 2026-09-23)
    expect((await screen.findAllByText(/מתוך 2 בוצעו/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /סמן כבוצע: הגברה/ }));
    await waitFor(() => expect(setRequiredItemStatus).toHaveBeenCalledWith('r1', 'בוצע'));
  });

  it('an item with no expense shows one status and the badge cycles חסר → בטיפול → בוצע', async () => {
    const { ReadinessSection } = await import('@/features/readiness/components/ReadinessSection');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(qk.event.readiness('e1'), [{ id: 'r1', categoryId: null, subcategoryId: 's1' }]);
    client.setQueryData(qk.event.expenses('e1'), []);
    client.setQueryData(qk.categories, {
      categories: [], categoryById: new Map(),
      subcategoryById: new Map([['s1', { id: 's1', name: 'הגברה' }]]),
      artistsCategoryId: 'c-art',
    });
    setRequiredItemStatus.mockResolvedValue(undefined);

    wrap(<ReadinessSection eventId="e1" />, client);
    // no expense behind it → the only status shown is the manual one
    expect(await screen.findByText('חסר')).toBeInTheDocument();
    expect(screen.queryByText('מכוסה')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /שינוי מצב/ }));
    await waitFor(() => expect(setRequiredItemStatus).toHaveBeenLastCalledWith('r1', 'בטיפול'));
  });
});
