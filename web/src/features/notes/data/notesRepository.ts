import type { NoteEntityType, NoteType } from '@/domain/constants';
import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

// Notes & reminders of ONE entity (entity_type + entity_id): an event note never shows up on an
// artist and vice versa (Book 04 §20, Book 10 NR-03). A note is not a task (ADR-023).

export interface NoteVM {
  id: string;
  type: NoteType;
  content: string;
  reminderDate: string | null;
  isCompleted: boolean;
  createdAt: string;
}

export async function listNotes(entityType: NoteEntityType, entityId: string): Promise<NoteVM[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, note_type, content, reminder_date, is_completed, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error, 'listNotes', MESSAGES.load);
  return data.map((n) => ({
    id: n.id,
    type: n.note_type as NoteType,
    content: n.content,
    reminderDate: n.reminder_date,
    isCompleted: n.is_completed,
    createdAt: n.created_at,
  }));
}

export interface NoteInput {
  id?: string;
  entityType: NoteEntityType;
  entityId: string;
  type: NoteType;
  content: string;
  reminderDate: string | null;
}

export async function saveNote(input: NoteInput): Promise<string> {
  const row = {
    note_type: input.type,
    content: input.content.trim(),
    reminder_date: input.type === 'reminder' ? input.reminderDate : null,
  };
  if (input.id) {
    const { error } = await supabase.from('notes').update(row).eq('id', input.id);
    if (error) throw toAppError(error, 'saveNote');
    return input.id;
  }
  const { data, error } = await supabase
    .from('notes')
    .insert({ ...row, entity_type: input.entityType, entity_id: input.entityId })
    .select('id')
    .single();
  if (error) throw toAppError(error, 'saveNote');
  return data.id;
}

export async function setReminderCompleted(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from('notes').update({ is_completed: completed }).eq('id', id).eq('note_type', 'reminder');
  if (error) throw toAppError(error, 'setReminderCompleted');
}

export async function archiveNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveNote');
}
