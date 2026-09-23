import type { ReadinessCompletion } from '@/domain/constants';
import type { RequiredItem } from '@/domain/readiness';
import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase, type Json } from '@/lib/supabase/client';

export async function listRequiredItems(eventId: string): Promise<RequiredItem[]> {
  const { data, error } = await supabase
    .from('event_required_items')
    .select('id, category_id, subcategory_id, completion_status, owner_name')
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw toAppError(error, 'listRequiredItems', MESSAGES.load);
  return data.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    completion: (r.completion_status ?? undefined) as ReadinessCompletion | undefined,
    owner: r.owner_name ?? '',
  }));
}

/** Replaces the whole list atomically. Never touches money (Book 04 §9). */
export async function setRequiredItems(eventId: string, items: { categoryId: string | null; subcategoryId: string | null }[]): Promise<void> {
  const { error } = await supabase.rpc('set_event_required_items', {
    p_event_id: eventId,
    p_items: items.map((i) => (i.subcategoryId ? { subcategory_id: i.subcategoryId } : { category_id: i.categoryId })) as Json,
  });
  if (error) throw toAppError(error, 'setRequiredItems');
}

/** One checklist item's manual progress. Work only — never touches money (Book 04 §9). */
export async function setRequiredItemStatus(itemId: string, status: ReadinessCompletion): Promise<void> {
  const { error } = await supabase.rpc('set_required_item_status', { p_item_id: itemId, p_status: status });
  if (error) throw toAppError(error, 'setRequiredItemStatus');
}

/** Who is responsible for this item. Free text; '' clears it. */
export async function setRequiredItemOwner(itemId: string, owner: string): Promise<void> {
  const { error } = await supabase.rpc('set_required_item_owner', { p_item_id: itemId, p_owner: owner });
  if (error) throw toAppError(error, 'setRequiredItemOwner');
}
