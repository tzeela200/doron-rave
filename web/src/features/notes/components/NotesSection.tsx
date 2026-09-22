import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Bell, CheckCircle2, Circle, Plus, RotateCcw, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Card } from '@/design-system/Card';
import { Button, IconButton } from '@/design-system/Button';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { DateInput, Field, Textarea } from '@/design-system/form';
import { Inline, Section } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { ConfirmArchive } from '@/design-system/patterns';
import { NOTE_TYPE, type NoteEntityType, type NoteType } from '@/domain/constants';
import { useNotes } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatDate, formatTimestampDate, formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveNote, saveNote, setReminderCompleted, type NoteVM } from '../data/notesRepository';
import styles from './NotesSection.module.css';

// NOTES_REMINDERS (Book 05 §15, Book 06 §41, ADR-023/024). User-authored only. A reminder can
// be completed / reopened / archived; a note can be archived. No push, calendar or WhatsApp.

const schema = z.object({
  content: z.string().trim().min(1, 'יש להזין תוכן'),
  reminderDate: z.string(),
});
type Values = z.infer<typeof schema>;

function NoteSheet({ entityType, entityId, type, onClose }: { entityType: NoteEntityType; entityId: string; type: NoteType; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', reminderDate: '' },
  });
  const save = useAppMutation({
    operation: 'saveNote',
    mutationFn: saveNote,
    refresh: () => refresh.notes(entityType, entityId),
    successMessage: type === 'reminder' ? 'התזכורת נשמרה' : 'ההערה נשמרה',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);
  const onSubmit = handleSubmit((v) => save.mutate({
    entityType, entityId, type, content: v.content, reminderDate: type === 'reminder' && v.reminderDate ? v.reminderDate : null,
  }));
  return (
    <>
      <BottomSheet
        open
        title={type === 'reminder' ? 'הוספת תזכורת' : 'הוספת הערה'}
        onRequestClose={requestClose}
        footer={
          <>
            <Button variant="primary" loading={save.isPending} loadingText="שומר…" onClick={() => void onSubmit()}>שמור</Button>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>ביטול</Button>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate className={styles.form}>
          {save.error && <InlineMessage tone="error" title={save.error.userMessage} />}
          <Field label="תוכן" required error={errors.content?.message}>
            {(a) => <Textarea {...a} {...register('content')} rows={4} />}
          </Field>
          {type === 'reminder' && (
            <Field label="תאריך תזכורת">
              {(a) => <DateInput {...a} {...register('reminderDate')} />}
            </Field>
          )}
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}

function NoteItem({ note, entityType, entityId }: { note: NoteVM; entityType: NoteEntityType; entityId: string }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const toggle = useAppMutation({
    operation: 'setReminderCompleted',
    mutationFn: (completed: boolean) => setReminderCompleted(note.id, completed),
    refresh: () => refresh.notes(entityType, entityId),
    successMessage: (completed) => (completed ? 'התזכורת סומנה כהושלמה' : 'התזכורת נפתחה מחדש'),
  });
  const archive = useAppMutation({
    operation: 'archiveNote',
    mutationFn: archiveNote,
    refresh: () => refresh.notes(entityType, entityId),
    successMessage: 'הפריט הועבר לארכיון',
  });
  const isReminder = note.type === 'reminder';
  return (
    <li className={styles.item}>
      <div className={styles.body}>
        <Inline gap="1">
          {isReminder
            ? <Badge tone={note.isCompleted ? 'success' : 'neutral'} icon={note.isCompleted ? CheckCircle2 : Bell}>{note.isCompleted ? 'הושלמה' : 'תזכורת'}</Badge>
            : <Badge icon={StickyNote}>הערה</Badge>}
          {isReminder && note.reminderDate && <span className={`${styles.meta} num`}>ל־{formatDate(note.reminderDate)}</span>}
        </Inline>
        <p className={note.isCompleted ? styles.done : styles.content}>{note.content}</p>
        <p className={`${styles.meta} num`}>נוצר ב־{formatTimestampDate(note.createdAt)}</p>
        {toggle.error && <p className={styles.error} role="alert">{toggle.error.userMessage}</p>}
      </div>
      <div className={styles.actions}>
        {isReminder && (
          note.isCompleted
            ? <IconButton icon={RotateCcw} label="פתח מחדש" disabled={toggle.isPending} onClick={() => toggle.mutate(false)} />
            : <IconButton icon={Circle} label="סמן כהושלם" disabled={toggle.isPending} onClick={() => toggle.mutate(true)} />
        )}
        <IconButton icon={Archive} label="העבר לארכיון" onClick={() => setArchiveOpen(true)} />
      </div>
      <ConfirmArchive
        open={archiveOpen}
        title={isReminder ? 'להעביר את התזכורת לארכיון?' : 'להעביר את ההערה לארכיון?'}
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => archive.mutate(note.id, { onSuccess: () => setArchiveOpen(false) })}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
    </li>
  );
}

export function NotesSection({ entityType, entityId, allowReminders = true }: { entityType: NoteEntityType; entityId: string; allowReminders?: boolean }) {
  const notes = useNotes(entityType, entityId);
  const [adding, setAdding] = useState<NoteType | null>(null);
  const title = allowReminders ? 'הערות ותזכורות' : 'הערות';
  const openReminders = (notes.data ?? []).filter((n) => n.type === NOTE_TYPE.REMINDER && !n.isCompleted).length;
  return (
    <Section
      id="notes"
      title={title}
      count={notes.data?.length}
      icon={StickyNote}
      meta={openReminders > 0 ? `${formatNumber(openReminders)} תזכורות פתוחות` : undefined}
      action={
        <Inline gap="0-5">
          <Button variant="secondary" compact icon={Plus} onClick={() => setAdding('note')}>הוסף הערה</Button>
          {allowReminders && <Button variant="ghost" compact icon={Bell} onClick={() => setAdding('reminder')}>הוסף תזכורת</Button>}
        </Inline>
      }
    >
      {notes.isLoading ? <LoadingBlock rows={2} height="72px" />
        : notes.error ? <ErrorState onRetry={() => void notes.refetch()} retrying={notes.isFetching} />
          : notes.data && notes.data.length === 0 ? (
            <EmptyState compact title="אין עדיין הערות" />
          ) : (
            <Card padded={false}>
              <ul className={styles.list}>
                {notes.data?.map((n) => <NoteItem key={n.id} note={n} entityType={entityType} entityId={entityId} />)}
              </ul>
            </Card>
          )}
      {adding && <NoteSheet entityType={entityType} entityId={entityId} type={adding} onClose={() => setAdding(null)} />}
    </Section>
  );
}
