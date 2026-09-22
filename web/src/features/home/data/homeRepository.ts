import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

// Home = Control Room (Book 05 §4). Only what Home shows: the active-events summary (one row
// from v_home_summary). Event cards and upcoming payments come from their own queries.

export interface HomeSummaryVM {
  activeEventsCount: number;
  plannedExpenses: number;
  agreedExpenses: number;
  paidTotal: number;
  remainingToPay: number;
  incomeTotal: number;
  ticketIncome: number;
  ticketsSold: number;
}

export async function getHomeSummary(): Promise<HomeSummaryVM> {
  const { data, error } = await supabase.from('v_home_summary').select('*').single();
  if (error) throw toAppError(error, 'getHomeSummary', MESSAGES.load);
  return {
    activeEventsCount: data.active_events_count ?? 0,
    plannedExpenses: data.planned_expenses ?? 0,
    agreedExpenses: data.agreed_expenses ?? 0,
    paidTotal: data.paid_total ?? 0,
    remainingToPay: data.remaining_to_pay ?? 0,
    incomeTotal: data.income_total ?? 0,
    ticketIncome: data.ticket_income ?? 0,
    ticketsSold: data.tickets_sold ?? 0,
  };
}
