import { CheckCircle2, ChevronRight, Circle, CircleDashed, ListChecks, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReadinessBadge } from '@/components/StatusBadges';
import { Button } from '@/design-system/Button';
import { Card, Progress } from '@/design-system/Card';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { Checkbox } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { Section, Stack } from '@/design-system/layout';
import { BottomSheet } from '@/design-system/overlay';
import { Caption, cx } from '@/design-system/Typography';
import { READINESS_COMPLETION, type ReadinessCompletion } from '@/domain/constants';
import type { ReadinessItemVM } from '@/domain/readiness';
import { useCategoryTree, useReadiness, useRequiredItems } from '@/features/queries';
import { useSheetCloseGuard } from '@/hooks/useUnsavedChanges';
import { formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { setRequiredItems, setRequiredItemStatus } from '../data/readinessRepository';
import styles from './ReadinessSection.module.css';

// Production readiness (Book 05 §8, Book 06 §37, ADR-032/033). The list is the user's choice from
// her own categories. Each item carries the progress she marks by hand (לא התחיל / בטיפול / בוצע),
// which is what the percentage counts, plus the state derived from expenses and coverage, shown
// beside it. Nothing here changes money.

function ReadinessItemRow({ item, eventId }: { item: ReadinessItemVM; eventId: string }) {
  const done = item.completion === READINESS_COMPLETION.DONE;
  const inProgress = item.completion === READINESS_COMPLETION.IN_PROGRESS;
  const name = item.label || 'רכיב שהועבר לארכיון';

  const setStatus = useAppMutation({
    operation: 'setRequiredItemStatus',
    mutationFn: (status: ReadinessCompletion) => setRequiredItemStatus(item.itemId, status),
    refresh: () => refresh.requiredItems(eventId),
  });
  const toggleDone = () => setStatus.mutate(done ? READINESS_COMPLETION.NOT_STARTED : READINESS_COMPLETION.DONE);
  const toggleInProgress = () => setStatus.mutate(inProgress ? READINESS_COMPLETION.NOT_STARTED : READINESS_COMPLETION.IN_PROGRESS);

  const label = (
    <span className={styles.label}>
      {item.parentLabel && <span className={styles.parent}>{item.parentLabel} ← </span>}
      {name}
    </span>
  );

  return (
    <li className={cx(styles.item, done && styles.itemDone)}>
      <div className={styles.row}>
        <button
          type="button"
          className={cx(styles.check, done && styles.checkDone, inProgress && styles.checkProgress)}
          aria-pressed={done}
          aria-label={`${done ? 'בטל סימון בוצע' : 'סמן כבוצע'}: ${name}`}
          disabled={setStatus.isPending}
          onClick={toggleDone}
        >
          <Icon icon={done ? CheckCircle2 : inProgress ? CircleDashed : Circle} size="sm" />
        </button>

        {item.linkedExpenseId ? (
          <Link to={`/events/${eventId}/expenses/${item.linkedExpenseId}`} className={styles.main}>
            {label}
            <Icon icon={ChevronRight} size="xs" directional className={styles.chevron} />
          </Link>
        ) : (
          <button type="button" className={styles.main} onClick={toggleDone} disabled={setStatus.isPending}>{label}</button>
        )}

        <span className={styles.states}>
          {!done && (
            <button
              type="button"
              className={cx(styles.progressChip, inProgress && styles.progressChipOn)}
              aria-pressed={inProgress}
              disabled={setStatus.isPending}
              onClick={toggleInProgress}
            >
              בטיפול
            </button>
          )}
          <ReadinessBadge state={item.state} includedBy={item.includedByLabel} />
        </span>
      </div>
      {setStatus.error && <p className={styles.error} role="alert">{setStatus.error.userMessage}</p>}
    </li>
  );
}

type Choice = { key: string; categoryId: string | null; subcategoryId: string | null };

function RequiredItemsSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const tree = useCategoryTree();
  const current = useRequiredItems(eventId);
  const initial = new Set((current.data ?? []).map((r) => (r.subcategoryId ? `sub:${r.subcategoryId}` : `cat:${r.categoryId}`)));
  const [selected, setSelected] = useState<Set<string>>(initial);
  const dirty = selected.size !== initial.size || [...selected].some((k) => !initial.has(k));

  const save = useAppMutation({
    operation: 'setRequiredItems',
    mutationFn: (items: Choice[]) => setRequiredItems(eventId, items),
    refresh: () => refresh.requiredItems(eventId),
    successMessage: 'רשימת המוכנות נשמרה',
    onSuccess: onClose,
  });
  const { requestClose, guard } = useSheetCloseGuard(dirty && !save.isPending, onClose);

  const toggle = (key: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const choices: { title: string; items: (Choice & { label: string })[] }[] = (tree.data?.categories ?? [])
    .filter((c) => !c.isArchived && c.isVisible)
    .map((c) => {
      const subs = c.subcategories.filter((s) => !s.isArchived && s.isVisible);
      return {
        title: c.name,
        items: subs.length > 0
          ? subs.map((s) => ({ key: `sub:${s.id}`, categoryId: null, subcategoryId: s.id, label: s.name }))
          : [{ key: `cat:${c.id}`, categoryId: c.id, subcategoryId: null, label: c.name }],
      };
    });
  const all = choices.flatMap((g) => g.items);

  return (
    <>
      <BottomSheet
        open
        title="רשימת מוכנות"
        description="בחר מה האירוע הזה צריך. סימון הביצוע נשמר גם כשמעדכנים את הרשימה."
        onRequestClose={requestClose}
        footer={
          <>
            <Button variant="primary" loading={save.isPending} loadingText="שומר…"
              onClick={() => save.mutate(all.filter((c) => selected.has(c.key)))}>שמור</Button>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>ביטול</Button>
          </>
        }
      >
        {save.error && <InlineMessage tone="error" title={save.error.userMessage} />}
        {tree.isLoading || current.isLoading ? <LoadingBlock rows={4} height="48px" />
          : tree.error ? <ErrorState onRetry={() => void tree.refetch()} />
            : choices.map((g) => (
              <fieldset key={g.title} className={styles.group}>
                <legend className={styles.groupTitle}>{g.title}</legend>
                {g.items.map((c) => (
                  <Checkbox key={c.key} label={c.label} checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                ))}
              </fieldset>
            ))}
      </BottomSheet>
      {guard}
    </>
  );
}

export function ReadinessSection({ eventId }: { eventId: string }) {
  const readiness = useReadiness(eventId);
  const [editing, setEditing] = useState(false);
  const r = readiness.data;

  return (
    <Section
      id="readiness"
      title="מוכנות הפקה"
      icon={ListChecks}
      defaultOpen={!!r?.defined}
      meta={r ? (r.defined ? `${formatNumber(r.percent)}% · ${formatNumber(r.completed)} מתוך ${formatNumber(r.total)} בוצעו` : 'לא הוגדרה רשימה') : undefined}
      action={r?.defined
        ? <Button variant="ghost" compact icon={Pencil} onClick={() => setEditing(true)}>ערוך רשימה</Button>
        : r ? <Button variant="secondary" compact icon={ListChecks} onClick={() => setEditing(true)}>הגדר רשימה</Button> : undefined}
    >
      {readiness.isLoading ? <LoadingBlock rows={1} height="96px" />
        : readiness.error ? <ErrorState onRetry={readiness.refetch} />
          : !r?.defined ? (
            <EmptyState
              compact
              title="לא הוגדרה רשימת מוכנות לאירוע"
              action={<Button variant="secondary" icon={ListChecks} onClick={() => setEditing(true)}>הגדר רשימת מוכנות</Button>}
            />
          ) : (
            <Card padded={false}>
              <Stack gap="1" >
                <div className={styles.summary}>
                  <p className={styles.percent}><span className="num">{formatNumber(r.percent)}%</span></p>
                  <Caption>
                    {formatNumber(r.completed)} מתוך {formatNumber(r.total)} בוצעו{r.inProgress > 0 ? ` · ${formatNumber(r.inProgress)} בטיפול` : ''}
                  </Caption>
                  <Progress value={r.percent ?? 0} label={`${r.completed} מתוך ${r.total} רכיבים בוצעו`} tone={r.percent === 100 ? 'success' : 'brand'} />
                  {r.closed > 0 && <Caption>{formatNumber(r.closed)} מתוך {formatNumber(r.total)} מכוסים בהוצאה</Caption>}
                </div>
                <ul className={styles.list}>
                  {r.items.map((i) => <ReadinessItemRow key={i.itemId} item={i} eventId={eventId} />)}
                </ul>
              </Stack>
            </Card>
          )}
      {editing && <RequiredItemsSheet eventId={eventId} onClose={() => setEditing(false)} />}
    </Section>
  );
}
