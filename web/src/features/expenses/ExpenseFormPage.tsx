import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { ExpenseStatusBadge } from '@/components/StatusBadges';
import { Button, IconButton } from '@/design-system/Button';
import { Accordion, Card } from '@/design-system/Card';
import { ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox, Combobox, DateInput, Field, Input, MoneyInput, Select, Textarea, TimeInput } from '@/design-system/form';
import { Inline, PageContainer, Stack } from '@/design-system/layout';
import { ConfirmArchive, FormSection, SegmentedControl, StickyFormActions } from '@/design-system/patterns';
import { Caption, Money } from '@/design-system/Typography';
import { EXPENSE_MANUAL_STATUS } from '@/domain/constants';
import { findOverlaps, hourlyCost, performanceDurationMinutes } from '@/domain/lineup';
import { parseAmount } from '@/domain/money';
import { readinessKey } from '@/domain/readiness';
import { PaymentsPanel } from '@/features/payments/components/PaymentsPanel';
import { useArtists, useCategoryTree, useEventExpenses, useEventSummary, useExpense, usePaymentMethods, useVendors } from '@/features/queries';
import { useReturn } from '@/hooks/useReturn';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChanges';
import { userMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveExpense, saveExpense } from './data/expensesRepository';
import { emptyExpenseForm, expenseFormSchema, expenseToForm, formToExpenseInput, type ExpenseFormValues } from './expenseForm';
import styles from './ExpenseFormPage.module.css';

// EXPENSE_FORM (Book 05 §9.1, Book 07 F06–F11, F16, F17, F21). A full page because it is a
// long form: category hierarchy, counterparty, amounts, manual status, show times for
// artists, "what's included", and payments. Save = one transaction (save_expense).

export function ExpenseFormPage() {
  const { eventId = '', expenseId } = useParams();
  const [params] = useSearchParams();
  const tree = useCategoryTree();
  const expense = useExpense(expenseId);
  const event = useEventSummary(eventId);

  const loading = tree.isLoading || event.isLoading || (!!expenseId && expense.isLoading);
  const error = tree.error ?? event.error ?? (expenseId ? expense.error : null);
  const title = expenseId ? 'עריכת הוצאה' : 'הוספת הוצאה';

  if (loading) return <><AppHeader title={title} back={`/events/${eventId}`} /><PageContainer><LoadingBlock rows={5} height="72px" /></PageContainer></>;
  if (error || !tree.data || !event.data) {
    return (
      <>
        <AppHeader title={title} back={`/events/${eventId}`} />
        <PageContainer><ErrorState message={userMessage(error, 'לא הצלחנו לטעון את הנתונים. נסה שוב.')} onRetry={() => { void tree.refetch(); void expense.refetch(); void event.refetch(); }} /></PageContainer>
      </>
    );
  }
  const presetArtists = params.get('artist') === '1' ? tree.data.artistsCategoryId ?? '' : '';
  const initial = expenseId && expense.data ? expenseToForm(expense.data) : emptyExpenseForm(presetArtists);
  return <ExpenseForm key={expenseId ?? 'new'} eventId={eventId} eventName={event.data.name} expenseId={expenseId} initial={initial} />;
}

function ExpenseForm({ eventId, eventName, expenseId, initial }: { eventId: string; eventName: string; expenseId?: string; initial: ExpenseFormValues }) {
  const goBack = useReturn();
  const isEdit = !!expenseId;
  const tree = useCategoryTree().data;
  const vendors = useVendors();
  const artists = useArtists();
  const methods = usePaymentMethods();
  const eventExpenses = useEventExpenses(eventId);
  const current = useExpense(expenseId).data;
  const [archiveOpen, setArchiveOpen] = useState(false);

  const form = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), defaultValues: initial });
  const { register, handleSubmit, control, setValue, getValues, formState: { errors, isDirty } } = form;
  const labels = useFieldArray({ control, name: 'customLabels' });
  const [categoryId, subcategoryId, artistId, vendorId, startTime, endTime, agreedAmount, includesExtras, coverageKeys, isPaid, manualStatus] =
    useWatch({ control, name: ['categoryId', 'subcategoryId', 'artistId', 'vendorId', 'startTime', 'endTime', 'agreedAmount', 'includesExtras', 'coverageKeys', 'isPaid', 'manualStatus'] });
  const { guard, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const category = tree?.categoryById.get(categoryId);
  const isArtist = !!category?.isArtists;
  const subcategories = (category?.subcategories ?? []).filter((s) => (!s.isArchived && s.isVisible) || s.id === subcategoryId);

  // Keep the form coherent when the category changes (artists never take a subcategory).
  useEffect(() => {
    if (subcategoryId && !category?.subcategories.some((s) => s.id === subcategoryId)) setValue('subcategoryId', '');
    if (!isArtist && (getValues('startTime') || getValues('endTime'))) { setValue('startTime', ''); setValue('endTime', ''); }
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestName = (value: string | undefined) => {
    if (value && !getValues('name').trim()) setValue('name', value, { shouldDirty: true });
  };

  const duration = performanceDurationMinutes(startTime, endTime);
  const agreedNumber = parseAmount(agreedAmount) ?? 0;
  const overlaps = isArtist && duration
    ? findOverlaps(
        { expenseId: expenseId ?? null, start: startTime, end: endTime },
        (eventExpenses.data ?? []).filter((e) => e.isArtist).map((e) => ({
          expenseId: e.id, artistId: e.artistId, displayName: e.artistName ?? e.name, expenseName: e.name, stageName: e.artistStageName,
          realName: null, start: e.startTime, end: e.endTime, agreedAmount: e.agreedAmount,
        })),
      )
    : [];

  // "Already included elsewhere" is information, never a block (Book 07 F07, Book 11 §15).
  const coveredElsewhere = useMemo(() => {
    const key = readinessKey(categoryId || null, isArtist ? null : subcategoryId || null);
    if (!key) return null;
    const holder = (eventExpenses.data ?? []).find((e) => e.id !== expenseId
      && e.coverage.some((c) => readinessKey(c.categoryId, c.subcategoryId, c.customLabel) === key));
    return holder?.name ?? null;
  }, [eventExpenses.data, categoryId, subcategoryId, isArtist, expenseId]);

  const save = useAppMutation({
    operation: 'saveExpense',
    mutationFn: saveExpense,
    refresh: (_v, id) => refresh.expense(eventId, id),
    successMessage: 'ההוצאה נשמרה',
    onSuccess: () => {
      allowNavigation();
      goBack(`/events/${eventId}`);
    },
  });
  const archive = useAppMutation({
    operation: 'archiveExpense',
    mutationFn: archiveExpense,
    refresh: (id) => refresh.expense(eventId, id),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: () => {
      allowNavigation();
      goBack(`/events/${eventId}`);
    },
  });

  const onSubmit = handleSubmit((v) => save.mutate(formToExpenseInput(v, { eventId, id: expenseId, isArtist })));

  const coverageGroups = (tree?.categories ?? [])
    .filter((c) => !c.isArchived && c.isVisible && !c.isArtists)
    .map((c) => {
      const subs = c.subcategories.filter((s) => !s.isArchived && s.isVisible);
      return { title: c.name, items: subs.length ? subs.map((s) => ({ key: `sub:${s.id}`, label: s.name })) : [{ key: `cat:${c.id}`, label: c.name }] };
    });
  const toggleCoverage = (key: string) => {
    const set = new Set(getValues('coverageKeys'));
    if (set.has(key)) set.delete(key); else set.add(key);
    setValue('coverageKeys', [...set], { shouldDirty: true });
  };

  return (
    <>
      <AppHeader title={isEdit ? 'עריכת הוצאה' : 'הוספת הוצאה'} back={`/events/${eventId}`} subtitle={<bdi>{eventName}</bdi>} />
      <PageContainer narrow>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="3">
            {save.error && <InlineMessage tone="error" title={save.error.userMessage} />}
            {isEdit && current && (
              <Card variant="subtle">
                <Inline justify="between">
                  <ExpenseStatusBadge status={current.computedStatus} />
                  <Caption>שולם <Money value={current.paidAmount} /> · נותר <Money value={current.remainingAmount} signed /></Caption>
                </Inline>
              </Card>
            )}

            <FormSection title="פרטי ההוצאה">
              <Field label="קטגוריה" required error={errors.categoryId?.message}>
                {(a) => (
                  <Select {...a} {...register('categoryId')} placeholder="בחירת קטגוריה">
                    {tree?.categories.filter((c) => (!c.isArchived && c.isVisible) || c.id === categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
              {!isArtist && subcategories.length > 0 && (
                <Field label={category ? `תת־קטגוריה של ${category.name}` : 'תת־קטגוריה'}>
                  {(a) => (
                    <Select {...a} {...register('subcategoryId', { onChange: (e) => suggestName(tree?.subcategoryById.get(e.target.value)?.name) })} placeholder="ללא תת־קטגוריה">
                      {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  )}
                </Field>
              )}
              {isArtist ? (
                <Field label="אמן" hint={<>אמן חדש נוסף במסך <Link to="/artists" className={styles.link}>אמנים</Link></>}>
                  {(a) => (
                    <Combobox
                      a11y={a}
                      value={artistId}
                      onChange={(v) => { setValue('artistId', v, { shouldDirty: true }); suggestName(artists.data?.find((x) => x.id === v)?.displayName); }}
                      options={(artists.data ?? []).map((x) => ({ value: x.id, label: x.displayName, hint: x.realNameSecondary ?? undefined }))}
                      placeholder="בחירת אמן"
                      clearLabel="ללא אמן"
                    />
                  )}
                </Field>
              ) : (
                <Field label="ספק" hint="לא חובה — הוצאה בלי ספק נספרת תחת ״ללא ספק״">
                  {(a) => (
                    <Combobox
                      a11y={a}
                      value={vendorId}
                      onChange={(v) => setValue('vendorId', v, { shouldDirty: true })}
                      options={(vendors.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
                      placeholder="בחירת ספק"
                      clearLabel="ללא ספק"
                    />
                  )}
                </Field>
              )}
              <Field label="שם ההוצאה" required error={errors.name?.message}>
                {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
              </Field>
              {coveredElsewhere && (
                <InlineMessage tone="info" title={`הרכיב כבר מסומן ככלול בעסקה אחרת (${coveredElsewhere}). אפשר להוסיף הוצאה נפרדת.`} />
              )}
            </FormSection>

            <FormSection title="סכומים">
              <div className={styles.pair}>
                <Field label="סכום מתוכנן" error={errors.plannedAmount?.message} hint="ריק = לפי הסכום המוסכם">
                  {(a) => <MoneyInput {...a} {...register('plannedAmount')} />}
                </Field>
                <Field label="סכום מוסכם" error={errors.agreedAmount?.message}>
                  {(a) => <MoneyInput {...a} {...register('agreedAmount')} />}
                </Field>
              </div>
              <div className={styles.field}>
                <span className={styles.groupLabel} id="manual-status-label">סטטוס</span>
                <SegmentedControl
                  label="סטטוס"
                  value={manualStatus}
                  onChange={(v) => setValue('manualStatus', v, { shouldDirty: true })}
                  options={[{ value: EXPENSE_MANUAL_STATUS.PLANNED, label: 'מתוכנן' }, { value: EXPENSE_MANUAL_STATUS.AGREED, label: 'סוכם' }]}
                />
                <Caption>״שולם חלקית״ ו״שולם״ מחושבים מהתשלומים ואינם משנים את הסטטוס הזה.</Caption>
              </div>
            </FormSection>

            {isArtist && (
              <FormSection title="שעות הופעה" description="חציית חצות תקינה, למשל 23:00–01:00.">
                <div className={styles.pair}>
                  <Field label="שעת התחלה" error={errors.startTime?.message}>
                    {(a) => <TimeInput {...a} {...register('startTime')} />}
                  </Field>
                  <Field label="שעת סיום" error={errors.endTime?.message}>
                    {(a) => <TimeInput {...a} {...register('endTime')} />}
                  </Field>
                </div>
                {duration !== null && (
                  <Caption>
                    משך הופעה: {formatDuration(duration)}
                    {hourlyCost(agreedNumber, duration) !== null && <> · עלות לשעה <Money value={hourlyCost(agreedNumber, duration)} /></>}
                  </Caption>
                )}
                {overlaps.length > 0 && (
                  <InlineMessage tone="warning" title="יש חפיפה בשעות עם אמן אחר. אפשר לשמור ולתקן אחר כך.">
                    {overlaps.join(', ')}
                  </InlineMessage>
                )}
              </FormSection>
            )}

            {!isArtist && (
              <FormSection title="מה כלול במחיר">
                <Checkbox {...register('includesExtras')} label="המחיר כולל שירותים או ציוד נוספים" description="לא מוסיף כסף — רק מסמן מה כלול בעסקה הזו" />
                {includesExtras && (
                  <Stack gap="2">
                    {coverageGroups.map((g) => (
                      <fieldset key={g.title} className={styles.group}>
                        <legend className={styles.groupLabel}>{g.title}</legend>
                        <div className={styles.checks}>
                          {g.items.map((it) => (
                            <Checkbox key={it.key} label={it.label} checked={coverageKeys.includes(it.key)} onChange={() => toggleCoverage(it.key)} />
                          ))}
                        </div>
                      </fieldset>
                    ))}
                    <Stack gap="1">
                      {labels.fields.map((f, i) => (
                        <Inline key={f.id} gap="1" wrap={false} align="start">
                          <div className={styles.grow}>
                            <Field label={`רכיב נוסף ${i + 1}`} error={errors.customLabels?.[i]?.value?.message}>
                              {(a) => <Input {...a} {...register(`customLabels.${i}.value`)} maxLength={60} />}
                            </Field>
                          </div>
                          <div className={styles.removeLabel}><IconButton icon={Trash2} label={`הסר רכיב ${i + 1}`} onClick={() => labels.remove(i)} /></div>
                        </Inline>
                      ))}
                      <Button variant="ghost" compact icon={Plus} onClick={() => labels.append({ value: '' })}>רכיב שלא ברשימה</Button>
                    </Stack>
                  </Stack>
                )}
              </FormSection>
            )}

            {!isEdit && (
              <FormSection title="תשלום" description="אפשר לפצל לכמה תשלומים אחרי השמירה.">
                <Checkbox {...register('isPaid')} label="שולם במלואו" />
                <div className={styles.pair}>
                  {!isPaid && (
                    <Field label="מועד תשלום">
                      {(a) => <DateInput {...a} {...register('dueDate')} />}
                    </Field>
                  )}
                  <Field label="אמצעי תשלום">
                    {(a) => (
                      <Select {...a} {...register('paymentMethodId')} placeholder="לא נבחר">
                        {methods.data?.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
              </FormSection>
            )}

            <Accordion title="פרטים משלימים">
              <Stack gap="2">
                <Field label="תאריך הוצאה">
                  {(a) => <DateInput {...a} {...register('expenseDate')} />}
                </Field>
                <Field label="מי שילם">
                  {(a) => <Input {...a} {...register('paidBy')} />}
                </Field>
                <Field label="הערות פנימיות">
                  {(a) => <Textarea {...a} {...register('internalNotes')} rows={3} />}
                </Field>
              </Stack>
            </Accordion>

            <StickyFormActions>
              <Button type="submit" variant="primary" loading={save.isPending} loadingText="שומר…">שמור</Button>
            </StickyFormActions>
          </Stack>
        </form>

        {isEdit && current && expenseId && (
          <PaymentsPanel eventId={eventId} expenseId={expenseId} agreed={current.agreedAmount} paid={current.paidAmount} remaining={current.remainingAmount} />
        )}
        {isEdit && <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>}
      </PageContainer>

      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את ההוצאה לארכיון?"
        body="ההוצאה ומה שכלול בה יוצאים מהסיכומים הפעילים. ההיסטוריה נשמרת בארכיון."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => expenseId && archive.mutate(expenseId)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
      {guard}
    </>
  );
}
