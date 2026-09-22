import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ChevronDown, FolderTree, Mic2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppHeader } from '@/components/navigation/navigation';
import { Button, IconButton } from '@/design-system/Button';
import { Badge } from '@/design-system/Card';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox, Field, Input } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { PageContainer, Stack } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { ConfirmArchive } from '@/design-system/patterns';
import { cx } from '@/design-system/Typography';
import { useCategoryTree, useCategoryUsage } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveCategory, archiveSubcategory, saveCategory, saveSubcategory, type CategoryTree, type CategoryVM, type SubcategoryVM } from './data/categoriesRepository';
import styles from './CategoriesPage.module.css';

// CATEGORIES (Book 05 §14). Parent = clear card with icon box, bold name, count, chevron.
// Subcategory = inset area with a branch line. Relations are by id, so renaming never breaks
// history (Book 04 §18). "אמנים" has no subcategories.

const schema = z.object({ name: z.string().trim().min(1, 'יש להזין שם'), isVisible: z.boolean() });
type Values = z.infer<typeof schema>;

type Editing =
  | { kind: 'category'; category: CategoryVM | null }
  | { kind: 'subcategory'; parent: CategoryVM; sub: SubcategoryVM | null };

function NameSheet({ editing, tree, onClose }: { editing: Editing; tree: CategoryTree; onClose: () => void }) {
  const current = editing.kind === 'category' ? editing.category : editing.sub;
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: current?.name ?? '', isVisible: current?.isVisible ?? true },
  });
  const save = useAppMutation({
    operation: 'saveCategory',
    mutationFn: (v: Values) => editing.kind === 'category'
      ? saveCategory({ id: editing.category?.id, name: v.name, isVisible: v.isVisible }, tree)
      : saveSubcategory({ id: editing.sub?.id, categoryId: editing.parent.id, name: v.name, isVisible: v.isVisible }, tree),
    refresh: () => refresh.categories(),
    successMessage: 'נשמר',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(isDirty && !save.isPending, onClose);
  const onSubmit = handleSubmit((v) => save.mutate(v));
  const title = editing.kind === 'category'
    ? (editing.category ? 'עריכת קטגוריה' : 'הוספת קטגוריה')
    : (editing.sub ? 'עריכת תת־קטגוריה' : `תת־קטגוריה חדשה ב${editing.parent.name}`);
  return (
    <>
      <BottomSheet
        open
        title={title}
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
          {current && <Checkbox {...register('isVisible')} label="מוצג בבחירה בטפסים" description="הסתרה לא מוחקת ולא משנה הוצאות קיימות" />}
          <button type="submit" hidden />
        </form>
      </BottomSheet>
      {guard}
    </>
  );
}

function CategoryTreeItem({ category, usage, onEdit, onAddSub, onEditSub, onArchive, onArchiveSub }: {
  category: CategoryVM;
  usage: number | undefined;
  onEdit: () => void;
  onAddSub: () => void;
  onEditSub: (s: SubcategoryVM) => void;
  onArchive: () => void;
  onArchiveSub: (s: SubcategoryVM) => void;
}) {
  const [open, setOpen] = useState(false);
  const subs = category.subcategories.filter((s) => !s.isArchived);
  const bodyId = `cat-${category.id}`;
  return (
    <li className={styles.parent}>
      <div className={styles.parentHead}>
        <button type="button" className={styles.expand} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <span className={styles.iconBox}><Icon icon={category.isArtists ? Mic2 : FolderTree} size="sm" /></span>
          <span className={styles.parentText}>
            <span className={styles.parentName}>{category.name}</span>
            <span className={styles.meta}>
              {category.isArtists ? 'ללא תתי־קטגוריות' : `${formatNumber(subs.length)} תתי־קטגוריות`}
              {usage ? ` · ${formatNumber(usage)} הוצאות` : ''}
            </span>
          </span>
          {!category.isVisible && <Badge>מוסתר</Badge>}
          <Icon icon={ChevronDown} size="sm" className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
      </div>
      <div id={bodyId} hidden={!open} className={styles.body}>
        {!category.isArtists && (
          <ul className={styles.subs}>
            {subs.map((s) => (
              <li key={s.id} className={styles.sub}>
                <span className={styles.subName}>{s.name}{!s.isVisible && <Badge>מוסתר</Badge>}</span>
                <IconButton icon={Pencil} label={`עריכת ${s.name}`} onClick={() => onEditSub(s)} />
                <IconButton icon={Archive} label={`העברת ${s.name} לארכיון`} onClick={() => onArchiveSub(s)} />
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          {!category.isArtists && <Button variant="secondary" compact icon={Plus} onClick={onAddSub}>הוסף תת־קטגוריה</Button>}
          <Button variant="ghost" compact icon={Pencil} onClick={onEdit}>ערוך</Button>
          {!category.isArtists && <Button variant="danger" compact icon={Archive} onClick={onArchive}>העבר לארכיון</Button>}
        </div>
      </div>
    </li>
  );
}

export function CategoriesPage() {
  const tree = useCategoryTree();
  const usage = useCategoryUsage();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [archiving, setArchiving] = useState<{ kind: 'category' | 'subcategory'; id: string; name: string } | null>(null);
  const archive = useAppMutation({
    operation: 'archiveCategory',
    mutationFn: (t: { kind: 'category' | 'subcategory'; id: string }) => (t.kind === 'category' ? archiveCategory(t.id) : archiveSubcategory(t.id)),
    refresh: () => refresh.categories(),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: () => setArchiving(null),
  });

  const active = (tree.data?.categories ?? []).filter((c) => !c.isArchived);
  return (
    <>
      <AppHeader title="קטגוריות" back="/management" action={<Button variant="primary" compact icon={Plus} onClick={() => setEditing({ kind: 'category', category: null })}>הוסף קטגוריה</Button>} />
      <PageContainer>
        {tree.isLoading ? <LoadingBlock rows={5} height="72px" />
          : tree.error ? <ErrorState onRetry={() => void tree.refetch()} />
            : active.length === 0 ? <EmptyState title="אין עדיין קטגוריות" />
              : (
                <Stack gap="1-5">
                  <ul className={styles.tree}>
                    {active.map((c) => (
                      <CategoryTreeItem
                        key={c.id}
                        category={c}
                        usage={usage.data?.get(c.id)}
                        onEdit={() => setEditing({ kind: 'category', category: c })}
                        onAddSub={() => setEditing({ kind: 'subcategory', parent: c, sub: null })}
                        onEditSub={(s) => setEditing({ kind: 'subcategory', parent: c, sub: s })}
                        onArchive={() => setArchiving({ kind: 'category', id: c.id, name: c.name })}
                        onArchiveSub={(s) => setArchiving({ kind: 'subcategory', id: s.id, name: s.name })}
                      />
                    ))}
                  </ul>
                </Stack>
              )}
      </PageContainer>
      {editing && tree.data && <NameSheet editing={editing} tree={tree.data} onClose={() => setEditing(null)} />}
      <ConfirmArchive
        open={!!archiving}
        title={archiving ? `להעביר את ״${archiving.name}״ לארכיון?` : ''}
        body="הפריט לא יופיע בבחירה בטפסים. הוצאות קיימות ומוכנות הפקה שמשתמשות בו נשמרות."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => archiving && archive.mutate(archiving)}
        onCancel={() => { setArchiving(null); archive.reset(); }}
      />
    </>
  );
}
