import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { AlertDialog } from '@/design-system/overlay';

// Book 07 F34: leaving a changed form never loses input silently.
// One confirmation, same words everywhere (Book 11 §14, §17).

const TITLE = 'לצאת בלי לשמור?';
const BODY = 'יש שינויים שלא נשמרו. לצאת בלי לשמור?';

/**
 * For full-page forms: blocks in-app navigation and tab close while `dirty`.
 * Call `allowNavigation()` right before navigating away after a successful save.
 */
export function useUnsavedChangesGuard(dirty: boolean): { guard: ReactNode; allowNavigation: () => void } {
  const dirtyRef = useRef(dirty);
  const bypass = useRef(false);
  dirtyRef.current = dirty;

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !bypass.current && dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const guard = (
    <AlertDialog
      open={blocker.state === 'blocked'}
      title={TITLE}
      body={BODY}
      confirmLabel="צא בלי לשמור"
      cancelLabel="המשך עריכה"
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
  return { guard, allowNavigation: () => { bypass.current = true; } };
}

/** For sheets: ask before closing when dirty. Returns the close handler and the dialog. */
export function useSheetCloseGuard(dirty: boolean, close: () => void): { requestClose: () => void; guard: ReactNode } {
  const [asking, setAsking] = useState(false);
  const requestClose = () => (dirty ? setAsking(true) : close());
  const guard = (
    <AlertDialog
      open={asking}
      title={TITLE}
      body={BODY}
      confirmLabel="צא בלי לשמור"
      cancelLabel="המשך עריכה"
      tone="danger"
      onConfirm={() => { setAsking(false); close(); }}
      onCancel={() => setAsking(false)}
    />
  );
  return { requestClose, guard };
}
