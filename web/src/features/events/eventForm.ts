import { z } from 'zod';
import { isIsoDate } from '@/domain/dates';
import { parseAmount } from '@/domain/money';
import type { TicketTier } from '@/domain/pnl';
import { MAX_TICKET_TIERS } from '@/domain/constants';
import type { EventInput, EventSummaryVM } from './data/eventsRepository';

// Event form contract: schema (client shape), defaults adapter, and the single payload builder
// (Book 08 §18). Business rules are re-checked by save_event() on the server.

const optionalMoney = z.string().refine((v) => v.trim() === '' || (parseAmount(v) ?? -1) >= 0, 'יש להזין סכום תקין');
const optionalCount = z.string().refine((v) => v.trim() === '' || /^\d+$/.test(v.trim()), 'יש להזין מספר כרטיסים שלם');

export const tierSchema = z.object({
  name: z.string().max(60, 'עד 60 תווים'),
  quantity: z.string().refine((v) => /^\d+$/.test(v.trim()) && Number(v) > 0, 'כמות חייבת להיות מספר שלם גדול מ־0'),
  price: z.string().refine((v) => (parseAmount(v) ?? -1) >= 0, 'יש להזין מחיר תקין'),
});

export const eventFormSchema = z.object({
  name: z.string().trim().min(1, 'יש להזין שם אירוע'),
  eventDate: z.string().refine(isIsoDate, 'יש להזין תאריך אירוע'),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string(),
  generalNotes: z.string(),
  averageTicketPrice: optionalMoney,
  expectedTicketCount: optionalCount,
  tiers: z.array(tierSchema).max(MAX_TICKET_TIERS, 'אפשר להגדיר עד 20 סבבי תמחור'),
})
  // Business decision 2026-09-22: equal hours are an error — no implicit 24-hour events.
  // The same rule is enforced by save_event (event_hours_equal) and a table check.
  .refine((v) => !v.startTime || !v.endTime || v.startTime !== v.endTime, {
    path: ['endTime'],
    message: 'שעת ההתחלה ושעת הסיום של האירוע לא יכולות להיות זהות',
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const emptyEventForm: EventFormValues = {
  name: '', eventDate: '', startTime: '', endTime: '', location: '', generalNotes: '', averageTicketPrice: '', expectedTicketCount: '', tiers: [],
};

export function eventToForm(e: EventSummaryVM): EventFormValues {
  return {
    name: e.name,
    eventDate: e.eventDate,
    startTime: e.startTime ?? '',
    endTime: e.endTime ?? '',
    location: e.location,
    generalNotes: e.generalNotes,
    averageTicketPrice: e.averageTicketPrice === null ? '' : String(e.averageTicketPrice),
    expectedTicketCount: e.expectedTicketCount === null ? '' : String(e.expectedTicketCount),
    tiers: e.tiers.map((t) => ({ name: t.name, quantity: String(t.quantity), price: String(t.price) })),
  };
}

export function formToEventInput(v: EventFormValues, id?: string): EventInput {
  const tiers: TicketTier[] = v.tiers.map((t, i) => ({
    name: t.name.trim() || `סבב ${i + 1}`,
    quantity: Number(t.quantity),
    price: parseAmount(t.price) ?? 0,
  }));
  return {
    id,
    name: v.name,
    eventDate: v.eventDate,
    startTime: v.startTime || null,
    endTime: v.endTime || null,
    location: v.location,
    generalNotes: v.generalNotes,
    averageTicketPrice: parseAmount(v.averageTicketPrice),
    expectedTicketCount: v.expectedTicketCount.trim() === '' ? null : Number(v.expectedTicketCount),
    tiers,
  };
}
