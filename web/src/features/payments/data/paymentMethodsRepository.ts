import { AppError, MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export interface PaymentMethodVM {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export async function listPaymentMethods(): Promise<PaymentMethodVM[]> {
  const { data, error } = await supabase.from('payment_methods').select('id, name, sort_order, is_active').order('sort_order');
  if (error) throw toAppError(error, 'listPaymentMethods', MESSAGES.load);
  return data.map((m) => ({ id: m.id, name: m.name, sortOrder: m.sort_order, isActive: m.is_active }));
}

/** Methods are deactivated, never deleted, so existing payments keep their method (legacy rule). */
export async function savePaymentMethod(input: { id?: string; name: string; isActive: boolean }, existing: PaymentMethodVM[]): Promise<string> {
  const name = input.name.trim();
  const clash = existing.some((m) => m.isActive && m.id !== input.id && m.name.trim().toLowerCase() === name.toLowerCase());
  if (input.isActive && clash) throw new AppError('VALIDATION', 'duplicate_name', 'כבר קיים אמצעי תשלום בשם הזה', 'savePaymentMethod');
  if (input.id) {
    const { error } = await supabase.from('payment_methods').update({ name, is_active: input.isActive }).eq('id', input.id);
    if (error) throw toAppError(error, 'savePaymentMethod');
    return input.id;
  }
  const sortOrder = Math.max(0, ...existing.map((m) => m.sortOrder)) + 1;
  const { data, error } = await supabase.from('payment_methods').insert({ name, sort_order: sortOrder }).select('id').single();
  if (error) throw toAppError(error, 'savePaymentMethod');
  return data.id;
}
