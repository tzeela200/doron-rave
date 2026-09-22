import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export interface UsageVM {
  eventsCount: number;
  totalAgreed: number;
  nextEvent: { id: string; name: string; date: string } | null;
}

export interface VendorVM extends UsageVM {
  id: string;
  name: string;
  phone: string;
  contactDetails: string;
  notes: string;
  isArchived: boolean;
}

export interface EntityExpenseVM {
  expenseId: string;
  expenseName: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  agreedAmount: number;
  start: string | null;
  end: string | null;
}

interface UsageRow {
  events_count: number | null;
  total_agreed: number | null;
  next_event_id: string | null;
  next_event_name: string | null;
  next_event_date: string | null;
}

export function toUsage(u: UsageRow | undefined): UsageVM {
  return {
    eventsCount: u?.events_count ?? 0,
    totalAgreed: u?.total_agreed ?? 0,
    nextEvent: u?.next_event_id && u.next_event_name && u.next_event_date
      ? { id: u.next_event_id, name: u.next_event_name, date: u.next_event_date }
      : null,
  };
}

export async function listVendors(includeArchived = false): Promise<VendorVM[]> {
  let q = supabase.from('vendors').select('id, name, phone, contact_details, notes, is_archived');
  if (!includeArchived) q = q.eq('is_archived', false);
  const [vendors, usage] = await Promise.all([q, supabase.from('v_vendor_usage').select('*')]);
  if (vendors.error) throw toAppError(vendors.error, 'listVendors', MESSAGES.load);
  if (usage.error) throw toAppError(usage.error, 'listVendors', MESSAGES.load);
  const byId = new Map(usage.data.map((u) => [u.vendor_id, u]));
  return vendors.data
    .map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      contactDetails: v.contact_details,
      notes: v.notes,
      isArchived: v.is_archived,
      ...toUsage(byId.get(v.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

/** Expense history of a vendor or an artist, newest event first. */
export async function getEntityExpenses(column: 'vendor_id' | 'artist_id', id: string): Promise<EntityExpenseVM[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, name, agreed_amount, event_id, performance_start_time, performance_end_time, events!inner(name, event_date)')
    .eq(column, id)
    .eq('is_archived', false);
  if (error) throw toAppError(error, 'getEntityExpenses', MESSAGES.load);
  return data
    .map((r) => ({
      expenseId: r.id,
      expenseName: r.name,
      eventId: r.event_id,
      eventName: r.events.name,
      eventDate: r.events.event_date,
      agreedAmount: r.agreed_amount,
      start: r.performance_start_time,
      end: r.performance_end_time,
    }))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

export interface VendorInput { id?: string; name: string; phone: string; contactDetails: string; notes: string }

export async function saveVendor(input: VendorInput): Promise<string> {
  const row = { name: input.name.trim(), phone: input.phone.trim(), contact_details: input.contactDetails, notes: input.notes };
  if (input.id) {
    const { error } = await supabase.from('vendors').update(row).eq('id', input.id);
    if (error) throw toAppError(error, 'saveVendor');
    return input.id;
  }
  const { data, error } = await supabase.from('vendors').insert(row).select('id').single();
  if (error) throw toAppError(error, 'saveVendor');
  return data.id;
}

export async function archiveVendor(id: string): Promise<void> {
  const { error } = await supabase.from('vendors').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveVendor');
}
