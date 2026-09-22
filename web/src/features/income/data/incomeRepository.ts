import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase, type Json } from '@/lib/supabase/client';

export interface IncomeVM {
  id: string;
  eventId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Stored by save_income() as round(quantity × unit_price, 2); never a free field. */
  totalAmount: number;
  notes: string;
  isTicketIncome: boolean;
}

export async function listEventIncome(eventId: string): Promise<IncomeVM[]> {
  const { data, error } = await supabase
    .from('income')
    .select('id, event_id, name, quantity, unit_price, total_amount, notes, is_ticket_income')
    .eq('event_id', eventId)
    .eq('is_archived', false)
    .order('created_at');
  if (error) throw toAppError(error, 'listEventIncome', MESSAGES.load);
  return data.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    quantity: r.quantity,
    unitPrice: r.unit_price,
    totalAmount: r.total_amount,
    notes: r.notes,
    isTicketIncome: r.is_ticket_income,
  }));
}

export interface IncomeInput {
  id?: string;
  eventId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  isTicketIncome: boolean;
}

export async function saveIncome(input: IncomeInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_income', {
    p: {
      id: input.id ?? null,
      event_id: input.eventId,
      name: input.name.trim(),
      quantity: input.quantity,
      unit_price: input.unitPrice,
      notes: input.notes,
      is_ticket_income: input.isTicketIncome,
    } as Json,
  });
  if (error) throw toAppError(error, 'saveIncome');
  return data;
}

export async function archiveIncome(id: string): Promise<void> {
  const { error } = await supabase.from('income').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveIncome');
}
