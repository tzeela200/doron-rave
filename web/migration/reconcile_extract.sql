-- DORON'S RAVE — target extract for reconciliation (Book 09 §33–§36, §48). Read-only.
-- Run against the target after load.sql; save the single JSON value as migration/runs/target_extract.json
--   psql "$DATABASE_URL" -At -f migration/reconcile_extract.sql > migration/runs/target_extract.json
select json_build_object(
  'counts', (select json_object_agg(t, c) from (
      select 'Events' t, json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) c from public.events
      union all select 'Expenses', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.expenses
      union all select 'Payments', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.payments
      union all select 'Income', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.income
      union all select 'Artists', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.artists
      union all select 'Vendors', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.vendors
      union all select 'Categories', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.categories
      union all select 'Subcategories', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.subcategories
      union all select 'Notes', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.notes
      union all select 'ExpenseCoverage', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.expense_coverage
      union all select 'PaymentMethods', json_build_object('total', count(*), 'archived', count(*) filter (where not is_active)) from public.payment_methods
      union all select 'Attachments', json_build_object('total', count(*), 'archived', count(*) filter (where is_archived)) from public.attachments
    ) x),
  'statuses', json_build_object(
    'payments', (select json_object_agg(payment_status, n) from (select payment_status, count(*) n from public.payments group by 1) s),
    'expenses', (select json_object_agg(manual_status, n) from (select manual_status, count(*) n from public.expenses group by 1) s),
    'income_ticket', (select json_object_agg(is_ticket_income::text, n) from (select is_ticket_income, count(*) n from public.income group by 1) s)),
  'sums', json_build_object(
    'planned', (select coalesce(sum(planned_amount), 0) from public.expenses),
    'agreed', (select coalesce(sum(agreed_amount), 0) from public.expenses),
    'paid', (select coalesce(sum(amount), 0) from public.payments where payment_status = 'שולם'),
    'income', (select coalesce(sum(total_amount), 0) from public.income)),
  'upcoming', (select coalesce(json_agg(json_build_object('payment', payment_id, 'overdue', is_overdue, 'event', event_id)), '[]') from public.v_upcoming_payments),
  'orphans', json_build_object(
    'subcategory_mismatch', (select count(*) from public.expenses e join public.subcategories s on s.id = e.subcategory_id where s.category_id <> e.category_id),
    'required_items_not_exactly_one', (select count(*) from public.event_required_items where num_nonnulls(category_id, subcategory_id) <> 1)),
  'events', (select json_object_agg(ev.id, json_build_object(
      'average_ticket_price', ev.average_ticket_price,
      'expected_ticket_count', ev.expected_ticket_count,
      'totals', (select row_to_json(t) from public.v_event_financial_totals t where t.event_id = ev.id),
      'tiers', (select coalesce(json_agg(json_build_object('name', name, 'quantity', quantity, 'price', price) order by sort_order), '[]') from public.ticket_tiers where event_id = ev.id),
      'required', (select coalesce(json_agg(json_build_object('id', id, 'categoryId', category_id, 'subcategoryId', subcategory_id)), '[]') from public.event_required_items where event_id = ev.id),
      'expenses', (select coalesce(json_agg(json_build_object(
          'id', e.id, 'name', e.name, 'categoryId', e.category_id, 'subcategoryId', e.subcategory_id, 'agreedAmount', e.agreed_amount,
          'manualStatus', e.manual_status, 'paidAmount', s.paid_amount, 'artistId', e.artist_id,
          'start', to_char(e.performance_start_time, 'HH24:MI'), 'end', to_char(e.performance_end_time, 'HH24:MI'))), '[]')
        from public.expenses e join public.v_expense_payment_summary s on s.expense_id = e.id where e.event_id = ev.id and not e.is_archived),
      'coverage', (select coalesce(json_agg(json_build_object('expenseId', c.expense_id, 'expenseName', e.name, 'categoryId', c.category_id, 'subcategoryId', c.subcategory_id, 'customLabel', c.custom_label)), '[]')
        from public.expense_coverage c join public.expenses e on e.id = c.expense_id where e.event_id = ev.id and not e.is_archived and not c.is_archived)
    )) from public.events ev)
) as extract;
