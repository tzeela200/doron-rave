-- DORON'S RAVE — canonical views (Book 03 §9, Book 04 §4, §5, §6, §12, §13)
--
-- Where each formula lives (ADR-042 — one implementation per formula):
--   * Sums of money (paid, remaining, agreed, planned, income, ticket income, breakdowns,
--     overdue flags) live HERE, in SQL, on exact numeric(12,2).
--   * Formulas built on top of those sums (break-even, tiers, forecast, readiness states,
--     lineup duration/overlap) live in web/src/domain and consume these views.
-- All views are security_invoker so RLS of the caller applies.
-- Archived rows never participate (Book 04 §1, §16).

-- Per expense: paid / remaining / computed status / next due / overdue (Book 04 §2.2, §4)
create view public.v_expense_payment_summary
with (security_invoker = true) as
select
  e.id as expense_id,
  e.event_id,
  e.agreed_amount,
  e.manual_status,
  coalesce(p.paid_amount, 0)::numeric(12,2) as paid_amount,
  (e.agreed_amount - coalesce(p.paid_amount, 0))::numeric(12,2) as remaining_amount,
  case
    when coalesce(p.paid_amount, 0) = 0 then e.manual_status
    when p.paid_amount < e.agreed_amount then 'שולם חלקית'
    else 'שולם'
  end as computed_status,
  p.next_due_date,
  coalesce(p.has_overdue, false) as has_overdue,
  coalesce(p.payments_count, 0) as payments_count
from public.expenses e
left join (
  select
    pay.expense_id,
    sum(pay.amount) filter (where pay.payment_status = 'שולם') as paid_amount,
    min(pay.due_date) filter (where pay.payment_status <> 'שולם') as next_due_date,
    bool_or(pay.payment_status <> 'שולם' and pay.due_date is not null and pay.due_date < public.app_today()) as has_overdue,
    count(*) as payments_count
  from public.payments pay
  where pay.is_archived = false
  group by pay.expense_id
) p on p.expense_id = e.id
where e.is_archived = false;

-- Per event: actual picture + the sums the P&L needs (Book 04 §5, §6, §11.1)
create view public.v_event_financial_totals
with (security_invoker = true) as
select
  ev.id as event_id,
  coalesce(x.agreed_expenses, 0)::numeric(12,2) as agreed_expenses,
  coalesce(x.planned_expenses, 0)::numeric(12,2) as planned_expenses,
  coalesce(x.paid_total, 0)::numeric(12,2) as paid_total,
  (coalesce(x.agreed_expenses, 0) - coalesce(x.paid_total, 0))::numeric(12,2) as remaining_to_pay,
  coalesce(i.income_total, 0)::numeric(12,2) as income_total,
  coalesce(i.ticket_income, 0)::numeric(12,2) as ticket_income,
  coalesce(i.non_ticket_income, 0)::numeric(12,2) as non_ticket_income,
  coalesce(i.tickets_sold, 0)::numeric(12,2) as tickets_sold,
  (coalesce(i.income_total, 0) - coalesce(x.agreed_expenses, 0))::numeric(12,2) as balance,
  coalesce(x.expenses_count, 0) as expenses_count,
  coalesce(x.artists_count, 0) as artists_count
from public.events ev
left join (
  select
    e.event_id,
    sum(e.agreed_amount) as agreed_expenses,
    -- planned falls back to agreed per expense, then sums (Book 04 §6)
    sum(case when e.planned_amount > 0 then e.planned_amount else e.agreed_amount end) as planned_expenses,
    sum(s.paid_amount) as paid_total,
    count(*) as expenses_count,
    -- counted from expenses with an artist, not from the lineup (Book 04 §11.1)
    count(*) filter (where e.artist_id is not null) as artists_count
  from public.expenses e
  join public.v_expense_payment_summary s on s.expense_id = e.id
  where e.is_archived = false
  group by e.event_id
) x on x.event_id = ev.id
left join (
  select
    inc.event_id,
    sum(inc.total_amount) as income_total,
    sum(inc.total_amount) filter (where inc.is_ticket_income) as ticket_income,
    sum(inc.total_amount) filter (where not inc.is_ticket_income) as non_ticket_income,
    sum(inc.quantity) filter (where inc.is_ticket_income) as tickets_sold
  from public.income inc
  where inc.is_archived = false
  group by inc.event_id
) i on i.event_id = ev.id;

-- Every event with its totals and time position. Event lists and Home read this.
create view public.v_event_overview
with (security_invoker = true) as
select
  ev.id,
  ev.name,
  ev.event_date,
  ev.location,
  ev.general_notes,
  ev.average_ticket_price,
  ev.expected_ticket_count,
  ev.is_archived,
  ev.created_at,
  ev.updated_at,
  (ev.event_date >= public.app_today()) as is_upcoming,
  (ev.event_date - public.app_today()) as days_until,
  t.agreed_expenses,
  t.planned_expenses,
  t.paid_total,
  t.remaining_to_pay,
  t.income_total,
  t.ticket_income,
  t.non_ticket_income,
  t.tickets_sold,
  t.balance,
  t.expenses_count,
  t.artists_count
from public.events ev
join public.v_event_financial_totals t on t.event_id = ev.id;

-- Not archived; callers order upcoming first, then history (Book 03 §9).
create view public.v_active_events
with (security_invoker = true) as
select * from public.v_event_overview where is_archived = false;

-- Expense breakdown by category / subcategory / vendor (Book 04 §12).
-- key_id NULL means "no subcategory" / "no vendor"; the UI supplies the canonical label.
-- The artists category never gets a subcategory breakdown.
create view public.v_event_expense_breakdown
with (security_invoker = true) as
select
  e.event_id,
  'category'::text as dimension,
  e.category_id as key_id,
  c.name as label,
  null::uuid as parent_id,
  min(c.sort_order) as sort_order,
  sum(e.agreed_amount)::numeric(12,2) as amount,
  count(*) as expense_count
from public.expenses e
join public.categories c on c.id = e.category_id
where e.is_archived = false
group by e.event_id, e.category_id, c.name
union all
select
  e.event_id,
  'subcategory'::text,
  e.subcategory_id,
  s.name,
  e.category_id,
  coalesce(min(s.sort_order), 2147483647),
  sum(e.agreed_amount)::numeric(12,2),
  count(*)
from public.expenses e
left join public.subcategories s on s.id = e.subcategory_id
where e.is_archived = false
  and not public.is_artists_category(e.category_id)
group by e.event_id, e.category_id, e.subcategory_id, s.name
union all
select
  e.event_id,
  'vendor'::text,
  e.vendor_id,
  v.name,
  null::uuid,
  0,
  sum(e.agreed_amount)::numeric(12,2),
  count(*)
from public.expenses e
left join public.vendors v on v.id = e.vendor_id
where e.is_archived = false
group by e.event_id, e.vendor_id, v.name;

-- Unpaid payments with a due date, on active (upcoming, not archived) events (Book 04 §13).
-- "Overdue" is derived here and never stored.
create view public.v_upcoming_payments
with (security_invoker = true) as
select
  p.id as payment_id,
  p.expense_id,
  e.name as expense_name,
  e.event_id,
  ev.name as event_name,
  ev.event_date,
  p.amount,
  p.due_date,
  p.payment_status,
  p.payment_method_id,
  p.note,
  (p.due_date < public.app_today()) as is_overdue,
  (p.due_date - public.app_today()) as days_until_due
from public.payments p
join public.expenses e on e.id = p.expense_id and e.is_archived = false
join public.events ev on ev.id = e.event_id and ev.is_archived = false
where p.is_archived = false
  and p.payment_status <> 'שולם'
  and p.due_date is not null
  and ev.event_date >= public.app_today();

revoke all on public.v_expense_payment_summary, public.v_event_financial_totals, public.v_event_overview,
  public.v_active_events, public.v_event_expense_breakdown, public.v_upcoming_payments from anon, authenticated;
grant select on public.v_expense_payment_summary, public.v_event_financial_totals, public.v_event_overview,
  public.v_active_events, public.v_event_expense_breakdown, public.v_upcoming_payments to authenticated;
