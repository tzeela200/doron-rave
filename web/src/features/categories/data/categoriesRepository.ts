import { ARTISTS_CATEGORY_NAME } from '@/domain/constants';
import { AppError, MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export interface SubcategoryVM {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  isVisible: boolean;
  isArchived: boolean;
}

export interface CategoryVM {
  id: string;
  name: string;
  sortOrder: number;
  isVisible: boolean;
  isArchived: boolean;
  isArtists: boolean;
  subcategories: SubcategoryVM[];
}

export interface CategoryTree {
  categories: CategoryVM[];
  categoryById: Map<string, CategoryVM>;
  subcategoryById: Map<string, SubcategoryVM>;
  artistsCategoryId: string | null;
}

const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'he');

/** All categories + subcategories (archived included, flagged) — a small dictionary. */
export async function getCategoryTree(): Promise<CategoryTree> {
  const [cats, subs] = await Promise.all([
    supabase.from('categories').select('id, name, sort_order, is_visible, is_archived'),
    supabase.from('subcategories').select('id, category_id, name, sort_order, is_visible, is_archived'),
  ]);
  if (cats.error) throw toAppError(cats.error, 'getCategoryTree', MESSAGES.load);
  if (subs.error) throw toAppError(subs.error, 'getCategoryTree', MESSAGES.load);

  const subcategoryById = new Map<string, SubcategoryVM>();
  const grouped = new Map<string, SubcategoryVM[]>();
  for (const s of subs.data) {
    const vm: SubcategoryVM = { id: s.id, categoryId: s.category_id, name: s.name, sortOrder: s.sort_order, isVisible: s.is_visible, isArchived: s.is_archived };
    subcategoryById.set(vm.id, vm);
    grouped.set(vm.categoryId, [...(grouped.get(vm.categoryId) ?? []), vm]);
  }
  const categories: CategoryVM[] = cats.data
    .map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      isVisible: c.is_visible,
      isArchived: c.is_archived,
      isArtists: c.name.trim() === ARTISTS_CATEGORY_NAME,
      subcategories: (grouped.get(c.id) ?? []).sort(byOrder),
    }))
    .sort(byOrder);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const artistsCategoryId = categories.find((c) => c.isArtists && !c.isArchived)?.id ?? null;
  return { categories, categoryById, subcategoryById, artistsCategoryId };
}

function assertUniqueName(existing: { name: string; id: string; isArchived: boolean }[], name: string, selfId?: string) {
  const clash = existing.some((e) => !e.isArchived && e.id !== selfId && e.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (clash) throw new AppError('VALIDATION', 'duplicate_name', 'כבר קיים פריט בשם הזה', 'saveCategory');
}

export async function saveCategory(input: { id?: string; name: string; isVisible?: boolean }, tree: CategoryTree): Promise<string> {
  const name = input.name.trim();
  assertUniqueName(tree.categories, name, input.id);
  if (input.id) {
    const { error } = await supabase.from('categories').update({ name, is_visible: input.isVisible ?? true }).eq('id', input.id);
    if (error) throw toAppError(error, 'saveCategory');
    return input.id;
  }
  const nextOrder = Math.max(0, ...tree.categories.map((c) => c.sortOrder)) + 1;
  const { data, error } = await supabase.from('categories').insert({ name, sort_order: nextOrder }).select('id').single();
  if (error) throw toAppError(error, 'saveCategory');
  return data.id;
}

export async function saveSubcategory(input: { id?: string; categoryId: string; name: string; isVisible?: boolean }, tree: CategoryTree): Promise<string> {
  const name = input.name.trim();
  const parent = tree.categoryById.get(input.categoryId);
  if (!parent || parent.isArchived) throw new AppError('VALIDATION', 'parent_required', 'יש לבחור קטגוריה', 'saveSubcategory');
  if (parent.isArtists) throw new AppError('VALIDATION', 'artists_no_sub', 'לקטגוריית אמנים אין תתי־קטגוריות', 'saveSubcategory');
  // unique within the same parent only ("שונות" may exist under several parents)
  assertUniqueName(parent.subcategories, name, input.id);
  if (input.id) {
    const { error } = await supabase.from('subcategories').update({ name, is_visible: input.isVisible ?? true }).eq('id', input.id);
    if (error) throw toAppError(error, 'saveSubcategory');
    return input.id;
  }
  const nextOrder = Math.max(0, ...parent.subcategories.map((s) => s.sortOrder)) + 1;
  const { data, error } = await supabase.from('subcategories').insert({ category_id: input.categoryId, name, sort_order: nextOrder }).select('id').single();
  if (error) throw toAppError(error, 'saveSubcategory');
  return data.id;
}

export async function archiveCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveCategory');
}

export async function archiveSubcategory(id: string): Promise<void> {
  const { error } = await supabase.from('subcategories').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveSubcategory');
}

/** Usage counts for the categories screen (active expenses per category). */
export async function getCategoryUsage(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('expenses').select('category_id').eq('is_archived', false);
  if (error) throw toAppError(error, 'getCategoryUsage', MESSAGES.load);
  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  return counts;
}
