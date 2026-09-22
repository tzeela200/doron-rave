import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { AppHeader } from '@/components/navigation/navigation';
import { Button } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox, DateInput, Field, Input } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { Inline, PageContainer, Stack } from '@/design-system/layout';
import { AlertDialog } from '@/design-system/overlay';
import { FormSection, SegmentedControl, StickyFormActions } from '@/design-system/patterns';
import { Caption, Money } from '@/design-system/Typography';
import { CLONE_MODE, type CloneMode } from '@/domain/constants';
import { isIsoDate } from '@/domain/dates';
import { useEventExpenses, useEventSummary } from '@/features/queries';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChanges';
import { userMessage } from '@/lib/errors';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { cloneEvent } from './data/eventsRepository';
import styles from './EventClonePage.module.css';

// EVENT_CLONE (Book 05 §18, Book 11 §28, ADR-039/040). The source never changes; a paid payment
// never arrives as paid; notes/reminders are not copied. The server does it in one transaction.

const MODE_TEXT: Record<CloneMode, { label: string; explain: string; copied: string[]; notCopied: string[] }> = {
  structure: {
    label: 'מבנה בלבד',
    explain: 'מעתיק את מבנה האירוע בלי מצב כספי שבוצע.',
    copied: ['ההוצאות שנבחרו: קטגוריה, תת־קטגוריה, ספק ואמן'],
    notCopied: ['סכומים (מתחילים מ־0, סטטוס מתוכנן)', 'תשלומים', 'שעות הופעה', 'הערות פנימיות', 'מה כלול במחיר', 'הערות ותזכורות'],
  },
  all: {
    label: 'הכול',
    explain: 'מעתיק את הנתונים המוגדרים, אך תשלומים ששולמו אינם הופכים לשולמו באירוע החדש.',
    copied: ['ההוצאות שנבחרו עם סכומים, סטטוס, הערות פנימיות ושעות הופעה', 'מה כלול במחיר', 'תשלומים — מועדים זזים לפי התאריך החדש'],
    notCopied: ['תשלום ששולם מגיע כ״מתוכנן״ ובלי תאריך תשלום', 'הערות ותזכורות'],
  },
};

const schema = z.object({
  name: z.string().trim().min(1, 'יש להזין שם אירוע'),
  eventDate: z.string().refine(isIsoDate, 'יש להזין תאריך אירוע'),
  location: z.string(),
});
type Values = z.infer<typeof schema>;

export function EventClonePage() {
  const { eventId = '' } = useParams();
  const source = useEventSummary(eventId);
  const expenses = useEventExpenses(eventId);
  if (source.isLoading || expenses.isLoading) return <><AppHeader title="שכפול אירוע" back={`/events/${eventId}`} /><PageContainer><LoadingBlock rows={4} /></PageContainer></>;
  if (source.error || expenses.error || !source.data || !expenses.data) {
    return (
      <>
        <AppHeader title="שכפול אירוע" back={`/events/${eventId}`} />
        <PageContainer><ErrorState message={userMessage(source.error ?? expenses.error, 'לא הצלחנו לטעון את הנתונים. נסה שוב.')} onRetry={() => { void source.refetch(); void expenses.refetch(); }} /></PageContainer>
      </>
    );
  }
  return <CloneForm eventId={eventId} source={source.data} expenses={expenses.data} />;
}

function CloneForm({ eventId, source, expenses }: {
  eventId: string;
  source: NonNullable<ReturnType<typeof useEventSummary>['data']>;
  expenses: NonNullable<ReturnType<typeof useEventExpenses>['data']>;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CloneMode>(CLONE_MODE.STRUCTURE);
  const [selected, setSelected] = useState<Set<string>>(new Set(expenses.map((e) => e.id)));
  const [confirming, setConfirming] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: `${source.name} (עותק)`, eventDate: '', location: source.location } });
  const values = useWatch({ control: form.control });
  const { guard, allowNavigation } = useUnsavedChangesGuard(form.formState.isDirty);

  const clone = useAppMutation({
    operation: 'cloneEvent',
    mutationFn: cloneEvent,
    refresh: () => refresh.clone(),
    successMessage: 'האירוע שוכפל',
    onSuccess: (newId) => {
      allowNavigation();
      navigate(`/events/${newId}`, { replace: true });
    },
  });

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const run = () => {
    clone.mutate({
      sourceEventId: eventId,
      mode,
      name: values.name ?? '',
      eventDate: values.eventDate ?? '',
      location: values.location ?? '',
      generalNotes: source.generalNotes,
      averageTicketPrice: source.averageTicketPrice,
      expectedTicketCount: source.expectedTicketCount,
      expenseIds: [...selected],
    });
  };

  const text = MODE_TEXT[mode];
  return (
    <>
      <AppHeader title="שכפול אירוע" back={`/events/${eventId}`} subtitle={<>מקור: <bdi>{source.name}</bdi></>} />
      <PageContainer narrow>
        <form onSubmit={form.handleSubmit(() => setConfirming(true))} noValidate>
          <Stack gap="3">
            <FormSection title="מה לשכפל">
              <SegmentedControl label="מצב שכפול" value={mode} onChange={setMode}
                options={[{ value: 'structure', label: MODE_TEXT.structure.label }, { value: 'all', label: MODE_TEXT.all.label }]} />
              <Caption>{text.explain}</Caption>
              <Card variant="subtle">
                <Stack gap="1">
                  {text.copied.map((t) => <p key={t} className={styles.line}><Icon icon={Check} size="xs" className={styles.yes} />{t}</p>)}
                  {text.notCopied.map((t) => <p key={t} className={styles.line}><Icon icon={X} size="xs" className={styles.no} />{t}</p>)}
                </Stack>
              </Card>
            </FormSection>

            <FormSection title="האירוע החדש">
              <Field label="שם האירוע" required error={form.formState.errors.name?.message}>
                {(a) => <Input {...a} {...form.register('name')} />}
              </Field>
              <Field label="תאריך" required error={form.formState.errors.eventDate?.message}>
                {(a) => <DateInput {...a} {...form.register('eventDate')} />}
              </Field>
              <Field label="מקום">
                {(a) => <Input {...a} {...form.register('location')} />}
              </Field>
            </FormSection>

            {expenses.length > 0 && (
              <FormSection title="הוצאות לשכפול" description={`${selected.size} מתוך ${expenses.length} נבחרו`}>
                <Inline gap="1">
                  <Button variant="ghost" compact onClick={() => setSelected(new Set(expenses.map((e) => e.id)))}>בחר הכול</Button>
                  <Button variant="ghost" compact onClick={() => setSelected(new Set())}>נקה בחירה</Button>
                </Inline>
                <Card>
                  {expenses.map((e) => (
                    <Checkbox
                      key={e.id}
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      label={<><bdi>{e.name}</bdi>{mode === 'all' && <> · <Money value={e.agreedAmount} /></>}</>}
                      description={`${e.categoryName}${e.subcategoryName ? ` ← ${e.subcategoryName}` : ''}`}
                    />
                  ))}
                </Card>
              </FormSection>
            )}

            {clone.error && <InlineMessage tone="error" title={clone.error.userMessage} />}
            <StickyFormActions>
              <Button type="submit" variant="primary">שכפל אירוע</Button>
            </StickyFormActions>
          </Stack>
        </form>
      </PageContainer>
      <AlertDialog
        open={confirming}
        title="לשכפל את האירוע?"
        body={<>מצב: {text.label} · {selected.size} הוצאות. אירוע המקור לא ישתנה.</>}
        confirmLabel="שכפל אירוע"
        loading={clone.isPending}
        loadingText="משכפל…"
        error={clone.error?.userMessage}
        onConfirm={run}
        onCancel={() => { setConfirming(false); clone.reset(); }}
      />
      {guard}
    </>
  );
}
