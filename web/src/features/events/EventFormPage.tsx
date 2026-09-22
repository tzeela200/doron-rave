import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { Button, IconButton } from '@/design-system/Button';
import { Accordion, Card } from '@/design-system/Card';
import { ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { DateInput, Field, Input, MoneyInput, NumberInput, Textarea } from '@/design-system/form';
import { PageContainer, Stack } from '@/design-system/layout';
import { ConfirmArchive, FormSection, StickyFormActions } from '@/design-system/patterns';
import { Caption } from '@/design-system/Typography';
import { useEventSummary } from '@/features/queries';
import { useReturn } from '@/hooks/useReturn';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChanges';
import { userMessage } from '@/lib/errors';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveEvent, saveEvent } from './data/eventsRepository';
import { emptyEventForm, eventFormSchema, eventToForm, formToEventInput, type EventFormValues } from './eventForm';
import styles from './EventFormPage.module.css';

// EVENT_CREATE / EVENT_EDIT (Book 05 §6, Book 07 F03/F04/F14). Creation stays short; the ticket
// forecast is optional and folded away. Save is one transaction (event + forecast + tiers).

export function EventFormPage() {
  const { eventId } = useParams();
  const isEdit = !!eventId;
  const existing = useEventSummary(eventId ?? '');
  if (isEdit && existing.isLoading) return <PageContainer><LoadingBlock rows={4} /></PageContainer>;
  if (isEdit && existing.error) {
    return (
      <>
        <AppHeader title="עריכת אירוע" back="/events" />
        <PageContainer><ErrorState message={userMessage(existing.error)} onRetry={() => void existing.refetch()} /></PageContainer>
      </>
    );
  }
  return <EventForm key={eventId ?? 'new'} eventId={eventId} initial={isEdit && existing.data ? eventToForm(existing.data) : emptyEventForm} />;
}

function EventForm({ eventId, initial }: { eventId?: string; initial: EventFormValues }) {
  const navigate = useNavigate();
  const goBack = useReturn();
  const isEdit = !!eventId;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const form = useForm<EventFormValues>({ resolver: zodResolver(eventFormSchema), defaultValues: initial, mode: 'onSubmit' });
  const { register, handleSubmit, formState: { errors, isDirty }, control, watch } = form;
  const tiers = useFieldArray({ control, name: 'tiers' });
  const { guard, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const save = useAppMutation({
    operation: 'saveEvent',
    mutationFn: saveEvent,
    refresh: (_v, id) => refresh.event(id),
    successMessage: isEdit ? 'האירוע נשמר' : 'האירוע נוצר',
    onSuccess: (id) => {
      allowNavigation();
      if (isEdit) goBack(`/events/${id}`);
      else navigate(`/events/${id}`, { replace: true });
    },
  });

  const archive = useAppMutation({
    operation: 'archiveEvent',
    mutationFn: archiveEvent,
    refresh: (id) => refresh.event(id),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: () => {
      allowNavigation();
      navigate('/events', { replace: true });
    },
  });

  useEffect(() => {
    if (save.error) setSaveError(save.error.userMessage);
  }, [save.error]);

  const onSubmit = handleSubmit((values) => {
    setSaveError(null);
    save.mutate(formToEventInput(values, eventId));
  });

  const tierCount = watch('tiers').length;

  return (
    <>
      <AppHeader title={isEdit ? 'עריכת אירוע' : 'יצירת אירוע'} back={isEdit ? `/events/${eventId}` : '/events'} />
      <PageContainer narrow>
        <form onSubmit={onSubmit} noValidate className={styles.form}>
          <Stack gap="3">
            {saveError && <InlineMessage tone="error" title={saveError} />}

            <FormSection>
              <Field label="שם האירוע" required error={errors.name?.message}>
                {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
              </Field>
              <Field label="תאריך" required error={errors.eventDate?.message}>
                {(a) => <DateInput {...a} {...register('eventDate')} />}
              </Field>
              <Field label="מקום" error={errors.location?.message}>
                {(a) => <Input {...a} {...register('location')} autoComplete="off" />}
              </Field>
              <Field label="הערות כלליות">
                {(a) => <Textarea {...a} {...register('generalNotes')} rows={3} />}
              </Field>
            </FormSection>

            <Accordion title="תחזית כרטיסים" meta={tierCount > 0 ? `${tierCount} סבבים` : 'אופציונלי'} defaultOpen={isEdit && (tierCount > 0 || !!initial.averageTicketPrice || !!initial.expectedTicketCount)}>
              <Stack gap="3">
                <FormSection description="מחיר ממוצע וכמות צפויה משמשים לנקודת האיזון ולרווח הצפוי כשאין סבבים.">
                  <Field label="מחיר כרטיס ממוצע" error={errors.averageTicketPrice?.message}>
                    {(a) => <MoneyInput {...a} {...register('averageTicketPrice')} />}
                  </Field>
                  <Field label="כמות כרטיסים צפויה" error={errors.expectedTicketCount?.message}>
                    {(a) => <NumberInput {...a} {...register('expectedTicketCount')} />}
                  </Field>
                </FormSection>

                <FormSection title="סבבי תמחור" description="לפי סדר המכירה. כשיש סבבים הם גוברים על המחיר הממוצע ועל הכמות הצפויה.">
                  {tiers.fields.length > 0 && (
                    <ol className={styles.tiers}>
                      {tiers.fields.map((f, i) => (
                        <li key={f.id}>
                          <Card variant="subtle">
                            <Stack gap="1-5">
                              <div className={styles.tierHead}>
                                <Caption>סבב {i + 1}</Caption>
                                <div className={styles.tierActions}>
                                  <IconButton icon={ArrowUp} label="הזז למעלה" disabled={i === 0} onClick={() => tiers.move(i, i - 1)} />
                                  <IconButton icon={ArrowDown} label="הזז למטה" disabled={i === tiers.fields.length - 1} onClick={() => tiers.move(i, i + 1)} />
                                  <IconButton icon={Trash2} label={`הסר סבב ${i + 1}`} onClick={() => tiers.remove(i)} />
                                </div>
                              </div>
                              <Field label="שם הסבב" error={errors.tiers?.[i]?.name?.message}>
                                {(a) => <Input {...a} {...register(`tiers.${i}.name`)} placeholder={`סבב ${i + 1}`} />}
                              </Field>
                              <div className={styles.tierRow}>
                                <Field label="כמות" required error={errors.tiers?.[i]?.quantity?.message}>
                                  {(a) => <NumberInput {...a} {...register(`tiers.${i}.quantity`)} />}
                                </Field>
                                <Field label="מחיר" required error={errors.tiers?.[i]?.price?.message}>
                                  {(a) => <MoneyInput {...a} {...register(`tiers.${i}.price`)} />}
                                </Field>
                              </div>
                            </Stack>
                          </Card>
                        </li>
                      ))}
                    </ol>
                  )}
                  {errors.tiers?.message && <InlineMessage tone="error" title={errors.tiers.message} />}
                  <Button variant="secondary" icon={Plus} onClick={() => tiers.append({ name: '', quantity: '', price: '' })}>הוסף סבב</Button>
                </FormSection>
              </Stack>
            </Accordion>

            <StickyFormActions>
              <Button type="submit" variant="primary" loading={save.isPending} loadingText={isEdit ? 'שומר…' : 'יוצר…'}>
                {isEdit ? 'שמור' : 'צור אירוע'}
              </Button>
            </StickyFormActions>

            {isEdit && (
              <Button variant="ghost" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>
            )}
          </Stack>
        </form>
      </PageContainer>

      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את האירוע לארכיון?"
        body="האירוע יוצא מהרשימות הפעילות ומהבית. כל הנתונים שלו נשמרים בארכיון."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => eventId && archive.mutate(eventId)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
      {guard}
    </>
  );
}
