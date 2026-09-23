import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Banknote, Plus, Ticket } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/design-system/Button';
import { Badge, Card } from '@/design-system/Card';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox, Field, Input, MoneyInput, NumberInput, Textarea } from '@/design-system/form';
import { Section } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { ConfirmArchive } from '@/design-system/patterns';
import { Money } from '@/design-system/Typography';
import { lineTotal, parseAmount } from '@/domain/money';
import { useEventIncome } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveIncome, saveIncome, type IncomeVM } from '../data/incomeRepository';
import styles from './IncomeSection.module.css';

// Income & tickets (Book 05 §11, Book 07 F12/F13). The total is shown computed from
// quantity × unit price and stored by the server; it is never a free field.

const schema = z.object({
  name: z.string().trim().min(1, 'יש להזין מקור הכנסה'),
  isTicketIncome: z.boolean(),
  quantity: z.string().refine((v) => (parseAmount(v) ?? -1) >= 0, 'יש להזין כמות תקינה'),
  unitPrice: z.string().refine((v) => (parseAmount(v) ?? -1) >= 0, 'יש להזין סכום תקין'),
  notes: z.string(),
});
type Values = z.infer<typeof schema>;

function IncomeRow({ income, onOpen }: { income: IncomeVM; onOpen: () => void }) {
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={styles.main}>
          <span className={styles.title}><bdi>{income.name}</bdi></span>
          <span className={styles.sub}>
            <span className="num">{formatNumber(income.quantity)}</span> × <Money value={income.unitPrice} />
          </span>
          {income.isTicketIncome && <Badge tone="accent" icon={Ticket}>כרטיסים</Badge>}
        </span>
        <Money value={income.totalAmount} className={styles.total} />
      </button>
    </li>
  );
}

function IncomeSheet({ eventId, income, onClose }: { eventId: string; income: IncomeVM | null; onClose: () => void }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: income
      ? { name: income.name, isTicketIncome: income.isTicketIncome, quantity: String(income.quantity), unitPrice: String(income.unitPrice), notes: income.notes }
      : { name: '', isTicketIncome: false, quantity: '1', unitPrice: '', notes: '' },
  });
  const { register, handleSubmit, formState: { errors, isDirty }, control } = form;
  const [isTicket, quantity, unitPrice] = useWatch({ control, name: ['isTicketIncome', 'quantity', 'unitPrice'] });
  const q = parseAmount(quantity);
  const u = parseAmount(unitPrice);
  const preview = q !== null && u !== null && q >= 0 && u >= 0 ? lineTotal(q, u) : null;

  const save = useAppMutation({
    operation: 'saveIncome',
    mutationFn: saveIncome,
    refresh: () => refresh.income(eventId),
    successMessage: 'ההכנסה נשמרה',
    onSuccess: onClose,
  });
  const archive = useAppMutation({
    operation: 'archiveIncome',
    mutationFn: archiveIncome,
    refresh: () => refresh.income(eventId),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);

  const onSubmit = handleSubmit((v) =>
    save.mutate({
      id: income?.id,
      eventId,
      name: v.name,
      isTicketIncome: v.isTicketIncome,
      quantity: parseAmount(v.quantity) ?? 0,
      unitPrice: parseAmount(v.unitPrice) ?? 0,
      notes: v.notes,
    }));

  return (
    <>
      <BottomSheet
        open
        title={income ? 'עריכת הכנסה' : 'הוספת הכנסה'}
        onRequestClose={requestClose}
        footer={
          <>
            <Button variant="primary" onClick={() => void onSubmit()} loading={save.isPending} loadingText="שומר…">שמור</Button>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>ביטול</Button>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate className={styles.form}>
          {save.error && <InlineMessage tone="error" title={save.error.userMessage} />}
          <Field label="מקור ההכנסה" required error={errors.name?.message}>
            {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
          </Field>
          <Checkbox {...register('isTicketIncome')} label="הכנסה ממכירת כרטיסים" />
          <div className={styles.pair}>
            <Field label={isTicket ? 'כמות כרטיסים' : 'כמות'} required error={errors.quantity?.message}>
              {(a) => <NumberInput {...a} {...register('quantity')} inputMode="decimal" />}
            </Field>
            <Field label={isTicket ? 'מחיר לכרטיס' : 'מחיר ליחידה'} required error={errors.unitPrice?.message}>
              {(a) => <MoneyInput {...a} {...register('unitPrice')} />}
            </Field>
          </div>
          <div className={styles.totalRow} aria-live="polite">
            <span>סה״כ</span>
            <Money value={preview} empty="—" className={styles.total} />
          </div>
          <Field label="הערות">
            {(a) => <Textarea {...a} {...register('notes')} rows={2} />}
          </Field>
          {income && <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>}
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את ההכנסה לארכיון?"
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => income && archive.mutate(income.id)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
      {guard}
    </>
  );
}

export function IncomeSection({ eventId, incomeTotal }: { eventId: string; incomeTotal: number | null }) {
  const income = useEventIncome(eventId);
  const [editing, setEditing] = useState<IncomeVM | 'new' | null>(null);

  return (
    <Section
      id="income"
      title="הכנסות וכרטיסים"
      count={income.data?.length}
      icon={Banknote}
      iconTone="teal"
      meta={incomeTotal !== null ? <>סה״כ <Money value={incomeTotal} /></> : undefined}
      action={<Button variant="primary" tone="teal" compact icon={Plus} onClick={() => setEditing('new')}>הוסף הכנסה</Button>}
    >
      {income.isLoading ? <LoadingBlock rows={2} height="72px" />
        : income.error ? <ErrorState onRetry={() => void income.refetch()} retrying={income.isFetching} />
          : income.data && income.data.length === 0 ? (
            <EmptyState compact title="אין עדיין הכנסות" />
          ) : (
            <Card padded={false}>
              <ul className={styles.list}>
                {income.data?.map((i) => <IncomeRow key={i.id} income={i} onOpen={() => setEditing(i)} />)}
              </ul>
            </Card>
          )}
      {editing && <IncomeSheet eventId={eventId} income={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}
