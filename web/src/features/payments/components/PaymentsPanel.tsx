import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Pencil, Plus, Split, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { OverdueBadge, PaymentStatusBadge } from '@/components/StatusBadges';
import { Button, IconButton } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { DateInput, Field, Input, MoneyInput, Select } from '@/design-system/form';
import { Inline, Section, Stack } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { ConfirmArchive } from '@/design-system/patterns';
import { Caption, Money } from '@/design-system/Typography';
import { PAYMENT_STATUSES, type PaymentStatus } from '@/domain/constants';
import { parseAmount } from '@/domain/money';
import { useExpensePayments, usePaymentMethods } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatDate } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archivePayment, replaceExpensePayments, savePayment, type PaymentInput, type PaymentVM } from '@/features/expenses/data/expensesRepository';
import styles from './PaymentsPanel.module.css';

// Payments belong to an expense (ADR-028). A partial payment is an ordinary payment of part of
// the amount — there is no "מקדמה" status (ADR-029); that word can live in the note.

const paymentRowSchema = z.object({
  id: z.string(),
  amount: z.string().refine((v) => (parseAmount(v) ?? 0) > 0, 'יש להזין סכום תקין'),
  status: z.enum(['מתוכנן', 'ממתין לתשלום', 'שולם']),
  dueDate: z.string(),
  paidDate: z.string(),
  paymentMethodId: z.string(),
  note: z.string(),
});
type PaymentRowValues = z.infer<typeof paymentRowSchema>;

const toRowValues = (p?: PaymentVM, defaults?: Partial<PaymentRowValues>): PaymentRowValues => ({
  id: p?.id ?? '',
  amount: p ? String(p.amount) : defaults?.amount ?? '',
  status: p?.status ?? 'מתוכנן',
  dueDate: p?.dueDate ?? '',
  paidDate: p?.paidDate ?? '',
  paymentMethodId: p?.paymentMethodId ?? '',
  note: p?.note ?? '',
});

const toInput = (v: PaymentRowValues, expenseId: string): PaymentInput => ({
  id: v.id || undefined,
  expenseId,
  amount: parseAmount(v.amount) ?? 0,
  status: v.status as PaymentStatus,
  dueDate: v.dueDate || null,
  // paid_date only for a paid payment; the server defaults it to today (Book 04 §3)
  paidDate: v.status === 'שולם' && v.paidDate ? v.paidDate : null,
  paymentMethodId: v.paymentMethodId || null,
  note: v.note,
});

type FieldKey = Exclude<keyof PaymentRowValues, 'id'>;

/** Shared payment fields; `reg` binds a field to whichever form owns it (single or split). */
function PaymentFields({ reg, errors, status }: {
  reg: (field: FieldKey) => UseFormRegisterReturn;
  errors: Partial<Record<keyof PaymentRowValues, { message?: string }>> | undefined;
  status: string;
}) {
  const methods = usePaymentMethods();
  return (
    <>
      <div className={styles.pair}>
        <Field label="סכום" required error={errors?.amount?.message}>
          {(a) => <MoneyInput {...a} {...reg('amount')} />}
        </Field>
        <Field label="סטטוס תשלום">
          {(a) => (
            <Select {...a} {...reg('status')}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <div className={styles.pair}>
        <Field label="מועד תשלום">
          {(a) => <DateInput {...a} {...reg('dueDate')} />}
        </Field>
        <Field label="אמצעי תשלום">
          {(a) => (
            <Select {...a} {...reg('paymentMethodId')} placeholder="לא נבחר">
              {methods.data?.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {status === 'שולם' && (
        <Field label="תאריך תשלום" hint="ריק = היום">
          {(a) => <DateInput {...a} {...reg('paidDate')} />}
        </Field>
      )}
      <Field label="הערה" hint="למשל: תשלום ראשון">
        {(a) => <Input {...a} {...reg('note')} />}
      </Field>
    </>
  );
}

function PaymentSheet({ eventId, expenseId, payment, suggestedAmount, onClose }: {
  eventId: string; expenseId: string; payment: PaymentVM | null; suggestedAmount: number; onClose: () => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const form = useForm<PaymentRowValues>({
    resolver: zodResolver(paymentRowSchema),
    defaultValues: toRowValues(payment ?? undefined, { amount: suggestedAmount > 0 ? String(suggestedAmount) : '' }),
  });
  const status = useWatch({ control: form.control, name: 'status' });
  const save = useAppMutation({
    operation: 'savePayment',
    mutationFn: savePayment,
    refresh: () => refresh.payment(eventId, expenseId),
    successMessage: 'התשלום נשמר',
    onSuccess: onClose,
  });
  const archive = useAppMutation({
    operation: 'archivePayment',
    mutationFn: archivePayment,
    refresh: () => refresh.payment(eventId, expenseId),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(form.formState.isDirty && !save.isPending, onClose);
  const onSubmit = form.handleSubmit((v) => save.mutate(toInput(v, expenseId)));

  return (
    <>
      <BottomSheet
        open
        title={payment ? 'עריכת תשלום' : 'הוספת תשלום'}
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
          <PaymentFields reg={(k) => form.register(k)} errors={form.formState.errors} status={status} />
          {payment && <Button variant="ghost" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>}
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את התשלום לארכיון?"
        body="התשלום לא ייספר יותר בשולם ובנותר לשלם. ההיסטוריה נשמרת."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => payment && archive.mutate(payment.id)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
      {guard}
    </>
  );
}

const splitSchema = z.object({ rows: z.array(paymentRowSchema).min(1, 'יש להוסיף לפחות תשלום אחד') });
type SplitValues = z.infer<typeof splitSchema>;

/** Edits the whole active set at once; saved in one transaction (Book 07 F10, QA PY-06). */
function SplitSheet({ eventId, expenseId, payments, agreed, onClose }: {
  eventId: string; expenseId: string; payments: PaymentVM[]; agreed: number; onClose: () => void;
}) {
  const form = useForm<SplitValues>({
    resolver: zodResolver(splitSchema),
    defaultValues: { rows: payments.length > 0 ? payments.map((p) => toRowValues(p)) : [toRowValues(undefined, { amount: agreed > 0 ? String(agreed) : '' })] },
  });
  const rows = useFieldArray({ control: form.control, name: 'rows' });
  const watched = useWatch({ control: form.control, name: 'rows' });
  const sum = watched.reduce((s, r) => s + Math.round((parseAmount(r.amount) ?? 0) * 100), 0) / 100;
  const save = useAppMutation({
    operation: 'replaceExpensePayments',
    mutationFn: (v: SplitValues) => replaceExpensePayments(expenseId, v.rows.map((r) => toInput(r, expenseId))),
    refresh: () => refresh.payment(eventId, expenseId),
    successMessage: 'התשלום נשמר',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(form.formState.isDirty && !save.isPending, onClose);
  const onSubmit = form.handleSubmit((v) => save.mutate(v));

  return (
    <>
      <BottomSheet
        open
        title="פיצול תשלומים"
        description={<>סכום מוסכם <Money value={agreed} /> · סה״כ בפיצול <Money value={sum} /></>}
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
          {form.formState.errors.rows?.message && <InlineMessage tone="error" title={form.formState.errors.rows.message} />}
          {rows.fields.map((f, i) => (
            <Card key={f.id} variant="subtle">
              <Stack gap="1-5">
                <Inline justify="between">
                  <Caption>תשלום {i + 1}</Caption>
                  <IconButton icon={Trash2} label={`הסר תשלום ${i + 1}`} onClick={() => rows.remove(i)} />
                </Inline>
                <PaymentFields reg={(k) => form.register(`rows.${i}.${k}`)} errors={form.formState.errors.rows?.[i]} status={watched[i]?.status ?? 'מתוכנן'} />
              </Stack>
            </Card>
          ))}
          <Button variant="secondary" icon={Plus} onClick={() => rows.append(toRowValues(undefined, { amount: agreed - sum > 0 ? String(Math.round((agreed - sum) * 100) / 100) : '' }))}>הוסף תשלום</Button>
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}

export function PaymentRow({ payment, onEdit }: { payment: PaymentVM; onEdit: () => void }) {
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <Money value={payment.amount} className={styles.amount} />
        <p className={styles.sub}>
          {payment.dueDate && <span className="num">מועד {formatDate(payment.dueDate)}</span>}
          {payment.status === 'שולם' && payment.paidDate && <span className="num"> · שולם ב־{formatDate(payment.paidDate)}</span>}
          {payment.paymentMethodName && <> · {payment.paymentMethodName}</>}
        </p>
        {payment.note && <p className={styles.sub}>{payment.note}</p>}
        <div className={styles.badges}>
          <PaymentStatusBadge status={payment.status} />
          {payment.isOverdue && <OverdueBadge />}
        </div>
      </div>
      <IconButton icon={Pencil} label="עריכת תשלום" onClick={onEdit} />
    </li>
  );
}

export function PaymentsPanel({ eventId, expenseId, agreed, paid, remaining }: {
  eventId: string; expenseId: string; agreed: number; paid: number; remaining: number;
}) {
  const payments = useExpensePayments(expenseId);
  const [editing, setEditing] = useState<PaymentVM | 'new' | null>(null);
  const [splitting, setSplitting] = useState(false);

  return (
    <Section
      id="payments"
      title="תשלומים"
      meta={<>שולם <Money value={paid} /> · נותר <Money value={remaining} signed /></>}
      titleAs="h2"
    >
      {payments.isLoading ? <LoadingBlock rows={2} height="72px" />
        : payments.error ? <ErrorState onRetry={() => void payments.refetch()} retrying={payments.isFetching} />
          : (
            <Stack gap="1-5">
              {payments.data && payments.data.length === 0
                ? <EmptyState compact title="אין עדיין תשלומים להוצאה הזו" />
                : (
                  <Card padded={false}>
                    <ul className={styles.list}>
                      {payments.data?.map((p) => <PaymentRow key={p.id} payment={p} onEdit={() => setEditing(p)} />)}
                    </ul>
                  </Card>
                )}
              <Inline gap="1">
                <Button variant="secondary" icon={Plus} onClick={() => setEditing('new')}>הוסף תשלום</Button>
                <Button variant="ghost" icon={Split} onClick={() => setSplitting(true)}>פיצול תשלומים</Button>
              </Inline>
            </Stack>
          )}
      {editing && (
        <PaymentSheet
          eventId={eventId}
          expenseId={expenseId}
          payment={editing === 'new' ? null : editing}
          suggestedAmount={editing === 'new' ? Math.max(0, remaining) : 0}
          onClose={() => setEditing(null)}
        />
      )}
      {splitting && payments.data && (
        <SplitSheet eventId={eventId} expenseId={expenseId} payments={payments.data} agreed={agreed} onClose={() => setSplitting(false)} />
      )}
    </Section>
  );
}
