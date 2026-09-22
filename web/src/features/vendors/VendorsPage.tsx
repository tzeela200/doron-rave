import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Phone, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AppHeader } from '@/components/navigation/navigation';
import { Button, FloatingCreateButton } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, NoResultsState } from '@/design-system/feedback';
import { Field, Input, SearchInput, Textarea } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { PageContainer, Stack } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { Caption, Money } from '@/design-system/Typography';
import { useVendors } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { saveVendor, type VendorVM } from './data/vendorsRepository';
import styles from '@/features/artists/ArtistsPage.module.css';

// VENDORS (Book 05 §13, Book 06 §40). A simple searchable list. An expense without a vendor is
// legal and shows as "ללא ספק" in reports — never as a fake vendor card.

const schema = z.object({
  name: z.string().trim().min(1, 'יש להזין שם ספק'),
  phone: z.string(),
  contactDetails: z.string(),
  notes: z.string(),
});
type Values = z.infer<typeof schema>;

export function VendorSheet({ vendor, onClose }: { vendor: VendorVM | null; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: vendor?.name ?? '', phone: vendor?.phone ?? '', contactDetails: vendor?.contactDetails ?? '', notes: vendor?.notes ?? '' },
  });
  const save = useAppMutation({
    operation: 'saveVendor',
    mutationFn: saveVendor,
    refresh: () => refresh.vendor(),
    successMessage: 'הספק נשמר',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);
  const onSubmit = handleSubmit((v) => save.mutate({ id: vendor?.id, ...v }));
  return (
    <>
      <BottomSheet
        open
        title={vendor ? 'עריכת ספק' : 'הוספת ספק'}
        onRequestClose={requestClose}
        footer={
          <>
            <Button variant="primary" loading={save.isPending} loadingText="שומר…" onClick={() => void onSubmit()}>שמור</Button>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>ביטול</Button>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate className={styles.formStack}>
          {save.error && <InlineMessage tone="error" title={save.error.userMessage} />}
          <Field label="שם הספק" required error={errors.name?.message}>
            {(a) => <Input {...a} {...register('name')} autoComplete="off" />}
          </Field>
          <Field label="טלפון">
            {(a) => <Input {...a} {...register('phone')} type="tel" inputMode="tel" dir="ltr" autoComplete="off" />}
          </Field>
          <Field label="פרטי קשר">
            {(a) => <Textarea {...a} {...register('contactDetails')} rows={2} />}
          </Field>
          <Field label="הערות">
            {(a) => <Textarea {...a} {...register('notes')} rows={2} />}
          </Field>
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}

export function VendorCard({ vendor }: { vendor: VendorVM }) {
  return (
    <li className={styles.item}>
      <Link to={`/vendors/${vendor.id}`} className={styles.row}>
        <div className={styles.main}>
          <p className={styles.name}><bdi>{vendor.name}</bdi></p>
          <p className={styles.sub}>
            {vendor.eventsCount > 0 ? <>{formatNumber(vendor.eventsCount)} אירועים · <Money value={vendor.totalAgreed} /></> : 'עדיין לא קושר להוצאה'}
            {vendor.phone && <span className={styles.phone}> · <Icon icon={Phone} size="xs" /><span dir="ltr" className="num">{vendor.phone}</span></span>}
          </p>
        </div>
        <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
      </Link>
    </li>
  );
}

export function VendorsPage() {
  const vendors = useVendors();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [adding, setAdding] = useState(false);
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = vendors.data ?? [];
    return q ? all.filter((v) => [v.name, v.phone, v.contactDetails].some((f) => f.toLowerCase().includes(q))) : all;
  }, [vendors.data, query]);

  return (
    <>
      <AppHeader title="ספקים" back="/management" />
      <PageContainer>
        <Stack gap="1-5">
          <SearchInput label="חיפוש ספקים" placeholder="חיפוש ספקים…" value={query} onChange={setQuery} />
          {vendors.data && <Caption>{formatNumber(visible.length)} ספקים</Caption>}
        </Stack>
        {vendors.isLoading ? <LoadingBlock rows={4} height="72px" />
          : vendors.error ? <ErrorState onRetry={() => void vendors.refetch()} retrying={vendors.isFetching} />
            : vendors.data?.length === 0 ? <EmptyState title="אין עדיין ספקים" action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>הוסף ספק</Button>} />
              : visible.length === 0 ? <NoResultsState onClear={() => setQuery('')} clearLabel="נקה חיפוש" />
                : <Card padded={false}><ul>{visible.map((v) => <VendorCard key={v.id} vendor={v} />)}</ul></Card>}
      </PageContainer>
      <FloatingCreateButton icon={Plus} label="הוסף ספק" onClick={() => setAdding(true)} />
      {adding && <VendorSheet vendor={null} onClose={() => setAdding(false)} />}
    </>
  );
}
