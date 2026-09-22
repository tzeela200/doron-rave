import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/design-system/Button';
import { InlineMessage } from '@/design-system/feedback';
import { Field, Input, Textarea } from '@/design-system/form';
import { BottomSheet } from '@/design-system/overlay';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { saveArtist, type ArtistVM } from '../data/artistsRepository';
import styles from './ArtistSheet.module.css';

// Artist create/edit (Book 07 F15). An artist has no money of its own — cost lives in the
// artist expense of each event (ADR-027).

const baseSchema = z.object({
  stageName: z.string(),
  realName: z.string(),
  phone: z.string(),
  contactDetails: z.string(),
  notes: z.string(),
  systemNotes: z.string(),
});
type Values = z.infer<typeof baseSchema>;

/** A legacy artist may be identified only by its old name, which stays as-is (Book 09 §17). */
const schemaFor = (hasLegacyName: boolean) => baseSchema.refine(
  (v) => hasLegacyName || v.stageName.trim() !== '' || v.realName.trim() !== '',
  { path: ['stageName'], message: 'יש להזין שם במה או שם אמיתי' },
);

export function ArtistSheet({ artist, onClose, onSaved }: { artist: ArtistVM | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schemaFor(!!artist?.legacyName?.trim())),
    defaultValues: {
      stageName: artist?.stageName ?? '',
      realName: artist?.realName ?? '',
      phone: artist?.phone ?? '',
      contactDetails: artist?.contactDetails ?? '',
      notes: artist?.notes ?? '',
      systemNotes: artist?.systemNotes ?? '',
    },
  });
  const save = useAppMutation({
    operation: 'saveArtist',
    mutationFn: saveArtist,
    refresh: () => refresh.artist(),
    successMessage: 'האמן נשמר',
    onSuccess: (id) => { onSaved?.(id); onClose(); },
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);
  const onSubmit = handleSubmit((v) => save.mutate({ id: artist?.id, ...v }));

  return (
    <>
      <BottomSheet
        open
        title={artist ? 'עריכת אמן' : 'הוספת אמן'}
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
          <Field label="שם במה" error={errors.stageName?.message} hint={artist?.legacyName ? `שם מהמערכת הקודמת: ${artist.legacyName}` : undefined}>
            {(a) => <Input {...a} {...register('stageName')} autoComplete="off" />}
          </Field>
          <Field label="שם אמיתי">
            {(a) => <Input {...a} {...register('realName')} autoComplete="off" />}
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
          <Field label="הערות קבועות" hint="מידע קבוע על האמן, לא הערה מתוארכת">
            {(a) => <Textarea {...a} {...register('systemNotes')} rows={2} />}
          </Field>
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}
