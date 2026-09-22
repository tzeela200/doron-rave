import { AlertTriangle, CheckCircle2, Circle, CircleDashed, Clock, Handshake, Package, PieChart } from 'lucide-react';
import { Badge } from '@/design-system/Card';
import { OVERDUE_LABEL, type ExpenseStatus, type PaymentStatus } from '@/domain/constants';
import type { ReadinessState } from '@/domain/readiness';

// Status → badge. Only statuses that exist in the model (Book 06 §12, Book 11 §7–§9).
// No "מקדמה", no "דורש טיפול".

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  switch (status) {
    case 'שולם':
      return <Badge tone="success" icon={CheckCircle2}>שולם</Badge>;
    case 'שולם חלקית':
      return <Badge tone="accent" icon={PieChart}>שולם חלקית</Badge>;
    case 'סוכם':
      return <Badge tone="neutral" icon={Handshake}>סוכם</Badge>;
    default:
      return <Badge tone="neutral" icon={Circle}>מתוכנן</Badge>;
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'שולם':
      return <Badge tone="success" icon={CheckCircle2}>שולם</Badge>;
    case 'ממתין לתשלום':
      return <Badge tone="neutral" icon={Clock}>ממתין לתשלום</Badge>;
    default:
      return <Badge tone="neutral" icon={Circle}>מתוכנן</Badge>;
  }
}

/** Derived display badge; never a payment_status (Book 04 §2.1). */
export function OverdueBadge() {
  return <Badge tone="warning" icon={AlertTriangle}>{OVERDUE_LABEL}</Badge>;
}

export function ReadinessBadge({ state, includedBy }: { state: ReadinessState; includedBy?: string | null }) {
  switch (state) {
    case 'covered':
      return <Badge tone="success" icon={CheckCircle2}>מכוסה</Badge>;
    case 'included':
      return <Badge tone="success" icon={Package}>{includedBy ? `כלול ב־${includedBy}` : 'כלול'}</Badge>;
    case 'in_progress':
      return <Badge tone="neutral" icon={CircleDashed}>בתהליך</Badge>;
    default:
      return <Badge tone="warning" icon={AlertTriangle}>חסר</Badge>;
  }
}
