import { eventDurationMinutes, lineupSpan, type LineupSlot } from '@/domain/lineup';
import { emptyEventForm, eventFormSchema, formToEventInput } from './eventForm';

describe('event hours (UX addendum 2026-09-22)', () => {
  const base = { ...emptyEventForm, name: 'אירוע', eventDate: '2026-09-24' };

  it('creates an event without hours and sends null, never 00:00', () => {
    const v = eventFormSchema.parse(base);
    expect(formToEventInput(v)).toMatchObject({ startTime: null, endTime: null });
  });
  it('accepts 22:00–07:00 (crosses midnight) with a 9-hour duration', () => {
    const v = eventFormSchema.parse({ ...base, startTime: '22:00', endTime: '07:00' });
    expect(formToEventInput(v)).toMatchObject({ startTime: '22:00', endTime: '07:00' });
    expect(eventDurationMinutes('22:00', '07:00')).toBe(540);
  });
  it('keeps a single hour without inventing the other', () => {
    const v = eventFormSchema.parse({ ...base, startTime: '22:00' });
    expect(formToEventInput(v)).toMatchObject({ startTime: '22:00', endTime: null });
    expect(eventDurationMinutes('22:00', null)).toBeNull();
  });
  it('blocks start == end on the end field (decision 2026-09-22) and never shows 24h', () => {
    const r = eventFormSchema.safeParse({ ...base, startTime: '22:00', endTime: '22:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['endTime']);
    expect(eventDurationMinutes('22:00', '22:00')).toBeNull();
  });
});

describe('line-up span for the collapsed header', () => {
  const slot = (id: string, start: string, end: string): LineupSlot => ({
    expenseId: id, artistId: null, displayName: id, realName: null, start, end, durationMinutes: 0, hourlyCost: null, overlapsWith: [],
  });
  it('runs from the first start to the latest end across midnight', () => {
    expect(lineupSpan([slot('a', '22:00', '23:30'), slot('b', '23:30', '01:00'), slot('c', '04:00', '07:00')])).toEqual({ start: '22:00', end: '07:00' });
  });
  it('is null without slots', () => {
    expect(lineupSpan([])).toBeNull();
  });
});
