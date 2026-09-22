-- DORON'S RAVE — payment rows + Home summary (Book 04 §2.1, §13)

-- Active payments with the derived "overdue" flag. Overdue is display-only; payment_status is
-- never changed by it (ADR / Book 04 §15).
create view public.v_payments
with (security_invoker = true) as
select
  p.id,
  p.expense_id,
  p.amount,
  p.due_date,
  p.paid_date,
  p.payment_method_id,
  pm.name as payment_method_name,
  p.payment_status,
  p.note,
  p.created_at,
  (p.payment_status <> 'שולם' and p.due_date is not null and p.due_date < public.app_today()) as is_overdue
from public.payments p
left join public.payment_methods pm on pm.id = p.payment_method_id
where p.is_archived = false;

-- Home figures over ACTIVE events only = upcoming and not archived (Book 04 §2, §13).
create view public.v_home_summary
with (security_invoker = true) as
select
  count(*) as active_events_count,
  coalesce(sum(t.planned_expenses), 0)::numeric(12,2) as planned_expenses,
  coalesce(sum(t.agreed_expenses), 0)::numeric(12,2) as agreed_expenses,
  coalesce(sum(t.paid_total), 0)::numeric(12,2) as paid_total,
  coalesce(sum(t.remaining_to_pay), 0)::numeric(12,2) as remaining_to_pay,
  coalesce(sum(t.income_total), 0)::numeric(12,2) as income_total,
  coalesce(sum(t.ticket_income), 0)::numeric(12,2) as ticket_income,
  coalesce(sum(t.tickets_sold), 0)::numeric(12,2) as tickets_sold
from public.events ev
join public.v_event_financial_totals t on t.event_id = ev.id
where ev.is_archived = false and ev.event_date >= public.app_today();

revoke all on public.v_payments, public.v_home_summary from anon, authenticated;
grant select on public.v_payments, public.v_home_summary to authenticated;
