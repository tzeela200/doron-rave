import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppHeader } from '@/components/navigation/navigation';
import { Button, IconButton } from '@/design-system/Button';
import { Badge, Card } from '@/design-system/Card';
import { ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox, Field, Input } from '@/design-system/form';
import { PageContainer } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { Caption } from '@/design-system/Typography';
import { usePaymentMethods } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { savePaymentMethod, type PaymentMethodVM } from './data/paymentMethodsRepository';
import styles from '@/features/management/ManagementPage.module.css';

// PAYMENT_METHODS (Book 05 §19, Book 03 §5.10). Methods are deactivated, never deleted, so
// existing payments keep their method.

const schema = z.object({ name: z.string().trim().min(1, 'יש להזין שם'), isActive: z.boolean() });
type Values = z.infer<typeof schema>;

function MethodSheet({ method, all, onClose }: { method: PaymentMethodVM | null; all: PaymentMethodVM[]; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: method?.name ?? '', isActive: method?.isActive ?? true },
  });
  const save = useAppMutation({
    operation: 'savePaymentMethod',
    mutationFn: (v: Values) => savePaymentMethod({ id: method?.id, ...v }, all),
    refresh: () => refresh.paymentMethods(),
    successMessage: 'אמצעי התשלום נשמר',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);
  const onSubmit = handleSubmit((v) => save.mutate(v));
  return (
    <>
      <BottomSheet
        open
        title={method ? 'עריכת אמצעי תשלום' : 'הוספת אמצעי תשלום'}
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
          <Field label="שם" required error={errors.name?.message}>
            {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
          </Field>
          {method && <Checkbox {...register('isActive')} label="פעיל" description="אמצעי לא פעיל לא מוצג בבחירה, ותשלומים קיימים שומרים אותו" />}
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}

export function PaymentMethodsPage() {
  const methods = usePaymentMethods();
  const [editing, setEditing] = useState<PaymentMethodVM | 'new' | null>(null);
  return (
    <>
      <AppHeader title="אמצעי תשלום" back="/management" action={<Button variant="primary" compact icon={Plus} onClick={() => setEditing('new')}>הוסף</Button>} />
      <PageContainer narrow>
        <Caption>אמצעי תשלום אינם נמחקים, כדי לא לשבור תשלומים קיימים — אפשר להשבית.</Caption>
        {methods.isLoading ? <LoadingBlock rows={4} height="48px" />
          : methods.error ? <ErrorState onRetry={() => void methods.refetch()} />
            : (
              <Card padded={false}>
                <ul className={styles.list}>
                  {methods.data?.map((m) => (
                    <li key={m.id} className={styles.row}>
                      <span className={styles.rowName}><bdi>{m.name}</bdi>{!m.isActive && <Badge>לא פעיל</Badge>}</span>
                      <IconButton icon={Pencil} label={`עריכת ${m.name}`} onClick={() => setEditing(m)} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
      </PageContainer>
      {editing && methods.data && <MethodSheet method={editing === 'new' ? null : editing} all={methods.data} onClose={() => setEditing(null)} />}
    </>
  );
}
