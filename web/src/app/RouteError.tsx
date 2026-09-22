import { useRouteError } from 'react-router-dom';
import { LinkButton } from '@/design-system/Button';
import { InlineMessage } from '@/design-system/feedback';
import { PageContainer } from '@/design-system/layout';

/** App-level error boundary (Book 08 §6). Human words; the technical error goes to the console. */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <PageContainer>
      <InlineMessage
        tone="error"
        title="משהו השתבש בטעינת המסך."
        action={<LinkButton to="/" variant="secondary" compact>חזרה לבית</LinkButton>}
      >
        אפשר לרענן את הדף או לחזור לבית.
      </InlineMessage>
    </PageContainer>
  );
}
