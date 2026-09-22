-- DORON'S RAVE — database acceptance tests (Book 10 §10–§27, Book 04 §24)
-- Runs inside one transaction and ROLLS BACK: it never leaves data behind.
-- Any failed assertion raises and aborts. A clean run ends with 'ALL DB TESTS PASSED'.
-- Fixture values are test data, invented for the assertions below only.

begin;

-- ---------------------------------------------------------------- SEC-01: anonymous sees nothing
set local role anon;
do $$
begin
  begin
    perform count(*) from public.events;
    raise exception 'SEC-01 failed: anon could read events';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_income('{"name":"x"}'::jsonb);
    raise exception 'SEC-01 failed: anon could call save_income';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------- signed-in user
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000test","role":"authenticated"}';

do $$
declare
  ev uuid; ev2 uuid; clone_all uuid; clone_struct uuid;
  cat uuid; sub uuid; art_cat uuid; vendor uuid; artist uuid;
  ex1 uuid; ex_art uuid; ex_novendor uuid; ex_archived uuid; p1 uuid; p2 uuid; inc uuid;
  r record; n numeric; c integer; t date := public.app_today();
begin
  select id into art_cat from public.categories where trim(name) = public.artists_category_name();
  if art_cat is null then raise exception 'seed missing: artists category'; end if;

  insert into public.categories (name, sort_order) values ('TEST ציוד טכני', 90) returning id into cat;
  insert into public.subcategories (category_id, name) values (cat, 'TEST הגברה') returning id into sub;
  insert into public.vendors (name) values ('TEST ספק') returning id into vendor;
  insert into public.artists (stage_name, real_name) values ('TEST DJ', 'TEST שם אמיתי') returning id into artist;
  insert into public.events (name, event_date) values ('TEST אירוע', t + 30) returning id into ev;

  -- Artists category never takes a subcategory (direct write blocked by trigger)
  begin
    insert into public.subcategories (category_id, name) values (art_cat, 'x');
    raise exception 'artists subcategory was allowed';
  exception when check_violation then null;
  end;

  -- EX-01 expense 1,000 with no payments
  ex1 := public.save_expense(jsonb_build_object('event_id', ev, 'name', 'הגברה', 'category_id', cat,
          'subcategory_id', sub, 'vendor_id', vendor, 'planned_amount', 1200, 'agreed_amount', 1000,
          'manual_status', 'סוכם'));
  select * into r from public.v_expense_payment_summary where expense_id = ex1;
  if r.paid_amount <> 0 or r.remaining_amount <> 1000 or r.computed_status <> 'סוכם' then
    raise exception 'EX-01 failed: %', row_to_json(r);
  end if;

  -- EX-02 paid 400 → partial; paid_date defaults to today
  p1 := public.save_payment(jsonb_build_object('expense_id', ex1, 'amount', 400, 'payment_status', 'שולם'));
  select * into r from public.v_expense_payment_summary where expense_id = ex1;
  if r.paid_amount <> 400 or r.remaining_amount <> 600 or r.computed_status <> 'שולם חלקית' then
    raise exception 'EX-02 failed: %', row_to_json(r);
  end if;
  if (select paid_date from public.payments where id = p1) <> t then raise exception 'paid_date default failed'; end if;
  if (select manual_status from public.expenses where id = ex1) <> 'סוכם' then raise exception 'EX-08 manual status overwritten'; end if;

  -- PY-01/02/04 planned & pending do not count as paid; overdue is derived only
  p2 := public.save_payment(jsonb_build_object('expense_id', ex1, 'amount', 600,
          'payment_status', 'ממתין לתשלום', 'due_date', t - 1, 'paid_date', t));
  if (select paid_date from public.payments where id = p2) is not null then raise exception 'non-paid kept paid_date'; end if;
  select * into r from public.v_expense_payment_summary where expense_id = ex1;
  if r.paid_amount <> 400 or not r.has_overdue then raise exception 'PY-02/04 failed: %', row_to_json(r); end if;
  if (select payment_status from public.payments where id = p2) <> 'ממתין לתשלום' then raise exception 'PY-04 status changed'; end if;
  if not exists (select 1 from public.v_upcoming_payments where payment_id = p2 and is_overdue) then
    raise exception 'H-06 overdue payment missing from upcoming';
  end if;

  -- EX-03 fully paid
  perform public.save_payment(jsonb_build_object('id', p2, 'expense_id', ex1, 'amount', 600, 'payment_status', 'שולם'));
  select * into r from public.v_expense_payment_summary where expense_id = ex1;
  if r.remaining_amount <> 0 or r.computed_status <> 'שולם' or r.has_overdue then raise exception 'EX-03 failed: %', row_to_json(r); end if;

  -- PY-06 split replace is all-or-nothing
  begin
    perform public.replace_expense_payments(ex1, jsonb_build_array(
      jsonb_build_object('amount', 100, 'payment_status', 'מתוכנן'),
      jsonb_build_object('amount', 0, 'payment_status', 'מתוכנן')));
    raise exception 'PY-06 invalid split accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:payment_amount_invalid%' then raise; end if;
  end;
  select count(*) into c from public.payments where expense_id = ex1 and is_archived = false;
  if c <> 2 then raise exception 'PY-06 partial set left behind: % active', c; end if;

  -- Split replace keeps ids given, archives the rest
  perform public.replace_expense_payments(ex1, jsonb_build_array(
    jsonb_build_object('id', p1, 'amount', 400, 'payment_status', 'שולם'),
    jsonb_build_object('amount', 300, 'payment_status', 'שולם'),
    jsonb_build_object('amount', 300, 'payment_status', 'מתוכנן', 'due_date', t + 5)));
  select * into r from public.v_expense_payment_summary where expense_id = ex1;
  if r.paid_amount <> 700 or r.payments_count <> 3 then raise exception 'split replace failed: %', row_to_json(r); end if;

  -- AR-01 artist 23:00–01:00 is valid (cross-midnight)
  ex_art := public.save_expense(jsonb_build_object('event_id', ev, 'name', 'TEST DJ', 'category_id', art_cat,
            'subcategory_id', sub, 'artist_id', artist, 'agreed_amount', 3000, 'manual_status', 'סוכם',
            'performance_start_time', '23:00', 'performance_end_time', '01:00'));
  if (select subcategory_id from public.expenses where id = ex_art) is not null then
    raise exception 'artist expense kept a subcategory';
  end if;

  -- AR-02 equal times blocked; AR-03 one time only blocked
  begin
    perform public.save_expense(jsonb_build_object('event_id', ev, 'name', 'x', 'category_id', art_cat,
      'performance_start_time', '22:00', 'performance_end_time', '22:00'));
    raise exception 'AR-02 equal times accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:performance_times_equal%' then raise; end if;
  end;
  begin
    perform public.save_expense(jsonb_build_object('event_id', ev, 'name', 'x', 'category_id', art_cat,
      'performance_start_time', '22:00'));
    raise exception 'AR-03 single time accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:performance_end_missing%' then raise; end if;
  end;
  -- performance times on a non-artist expense are rejected
  begin
    perform public.save_expense(jsonb_build_object('event_id', ev, 'name', 'x', 'category_id', cat,
      'performance_start_time', '22:00', 'performance_end_time', '23:00'));
    raise exception 'times on non-artist accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:performance_only_artists%' then raise; end if;
  end;

  -- EX-04 expense with no vendor is legal and lands under "no vendor"
  ex_novendor := public.save_expense(jsonb_build_object('event_id', ev, 'name', 'גנרטור', 'category_id', cat,
                 'agreed_amount', 500));

  -- IN-01 income 3 × 99.90 = 299.70 (client total ignored)
  inc := public.save_income(jsonb_build_object('event_id', ev, 'name', 'בר', 'quantity', 3, 'unit_price', 99.90,
         'total_amount', 1));
  if (select total_amount from public.income where id = inc) <> 299.70 then raise exception 'IN-01 failed'; end if;
  perform public.save_income(jsonb_build_object('event_id', ev, 'name', 'כרטיסים', 'quantity', 10,
          'unit_price', 100, 'is_ticket_income', true));

  -- Coverage never changes money (RD / ADR-034)
  select agreed_expenses into n from public.v_event_financial_totals where event_id = ev;
  perform public.save_expense(jsonb_build_object('id', ex_novendor, 'event_id', ev, 'name', 'גנרטור',
          'category_id', cat, 'agreed_amount', 500), jsonb_build_array(jsonb_build_object('subcategory_id', sub)));
  if (select agreed_expenses from public.v_event_financial_totals where event_id = ev) <> n then
    raise exception 'coverage changed totals';
  end if;
  if (select count(*) from public.expense_coverage where expense_id = ex_novendor and not is_archived) <> 1 then
    raise exception 'coverage not saved';
  end if;

  -- Event totals: agreed 1000 + 3000 + 500; paid 700; income 299.70 + 1000
  select * into r from public.v_event_financial_totals where event_id = ev;
  if r.agreed_expenses <> 4500 or r.paid_total <> 700 or r.remaining_to_pay <> 3800
     or r.income_total <> 1299.70 or r.ticket_income <> 1000 or r.non_ticket_income <> 299.70
     or r.tickets_sold <> 10 or r.balance <> -3200.30 or r.artists_count <> 1
     or r.planned_expenses <> 4700 then
    raise exception 'event totals failed: %', row_to_json(r);
  end if;

  -- RP-01/RP-04 breakdowns reconcile to the total; artists get no subcategory rows
  select sum(amount) into n from public.v_event_expense_breakdown where event_id = ev and dimension = 'category';
  if n <> 4500 then raise exception 'RP-01 category sum %', n; end if;
  select sum(amount) into n from public.v_event_expense_breakdown where event_id = ev and dimension = 'vendor';
  if n <> 4500 then raise exception 'RP-04 vendor sum %', n; end if;
  if (select amount from public.v_event_expense_breakdown where event_id = ev and dimension = 'vendor' and key_id is null) <> 3500 then
    raise exception 'EX-04 no-vendor bucket wrong';
  end if;
  if exists (select 1 from public.v_event_expense_breakdown where event_id = ev and dimension = 'subcategory' and parent_id = art_cat) then
    raise exception 'RP-03 artists got subcategory rows';
  end if;
  select sum(amount) into n from public.v_event_expense_breakdown where event_id = ev and dimension = 'subcategory' and parent_id = cat;
  if n <> 1500 then raise exception 'RP-02 subcategory sum %', n; end if;

  -- Tiers keep sale order
  perform public.set_ticket_tiers(ev, '[{"name":"מוקדם","quantity":100,"price":100},{"quantity":100,"price":200}]'::jsonb);
  if (select string_agg(name || ':' || sort_order, ',' order by sort_order) from public.ticket_tiers where event_id = ev)
     <> 'מוקדם:1,סבב 2:2' then raise exception 'tiers order failed'; end if;
  begin
    perform public.set_ticket_tiers(ev, '[{"quantity":0,"price":100}]'::jsonb);
    raise exception 'tier quantity 0 accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:tier_quantity_invalid%' then raise; end if;
  end;
  if (select count(*) from public.ticket_tiers where event_id = ev) <> 2 then raise exception 'tiers replace not atomic'; end if;

  -- Required items: exactly one of category/subcategory, replaced atomically
  perform public.set_event_required_items(ev, jsonb_build_array(
    jsonb_build_object('subcategory_id', sub), jsonb_build_object('category_id', art_cat)));
  if (select count(*) from public.event_required_items where event_id = ev) <> 2 then raise exception 'required items failed'; end if;

  -- Clone ALL: paid → planned, paid_date cleared, due shifted, coverage remapped, source untouched
  select count(*) into c from public.payments pay join public.expenses e on e.id = pay.expense_id
    where e.event_id = ev and pay.payment_status = 'שולם' and not pay.is_archived;
  clone_all := public.clone_event(jsonb_build_object('source_event_id', ev, 'mode', 'all',
               'name', 'TEST שכפול', 'event_date', t + 37));
  if exists (select 1 from public.payments pay join public.expenses e on e.id = pay.expense_id
             where e.event_id = clone_all and (pay.payment_status = 'שולם' or pay.paid_date is not null)) then
    raise exception 'ADR-040 clone copied a paid payment';
  end if;
  if not exists (select 1 from public.payments pay join public.expenses e on e.id = pay.expense_id
                 where e.event_id = clone_all and pay.due_date = t + 12) then
    raise exception 'clone due date not shifted by 7 days';
  end if;
  if exists (select 1 from public.expense_coverage cv join public.expenses e on e.id = cv.expense_id
             where e.event_id = clone_all and cv.expense_id in (select id from public.expenses where event_id = ev)) then
    raise exception 'clone coverage points at source';
  end if;
  if (select count(*) from public.expense_coverage cv join public.expenses e on e.id = cv.expense_id where e.event_id = clone_all) <> 1 then
    raise exception 'clone coverage missing';
  end if;
  if (select agreed_expenses from public.v_event_financial_totals where event_id = clone_all) <> 4500 then
    raise exception 'clone all amounts not copied';
  end if;
  if (select performance_start_time from public.expenses where event_id = clone_all and artist_id = artist) <> '23:00' then
    raise exception 'clone all show times not copied';
  end if;
  if (select count(*) from public.payments pay join public.expenses e on e.id = pay.expense_id
      where e.event_id = ev and pay.payment_status = 'שולם' and not pay.is_archived) <> c then
    raise exception 'clone changed source payments';
  end if;
  if exists (select 1 from public.notes where entity_id = clone_all) then raise exception 'clone copied notes'; end if;

  -- Clone STRUCTURE: amounts zero, status planned, no payments, no times, no internal notes
  clone_struct := public.clone_event(jsonb_build_object('source_event_id', ev, 'mode', 'structure',
                  'name', 'TEST מבנה', 'event_date', t + 60));
  if exists (select 1 from public.expenses where event_id = clone_struct
             and (agreed_amount <> 0 or planned_amount <> 0 or manual_status <> 'מתוכנן'
                  or performance_start_time is not null or internal_notes <> '')) then
    raise exception 'clone structure kept execution data';
  end if;
  if exists (select 1 from public.payments pay join public.expenses e on e.id = pay.expense_id where e.event_id = clone_struct) then
    raise exception 'clone structure copied payments';
  end if;
  if (select count(*) from public.expenses where event_id = clone_struct) <> 3 then raise exception 'clone structure lost expenses'; end if;

  -- EX-05 archive expense: out of totals, coverage archived, row kept
  perform public.archive_expense(ex_novendor);
  if (select agreed_expenses from public.v_event_financial_totals where event_id = ev) <> 4000 then
    raise exception 'EX-05 archived expense still counted';
  end if;
  if exists (select 1 from public.expense_coverage where expense_id = ex_novendor and not is_archived) then
    raise exception 'archive left coverage active';
  end if;
  if not exists (select 1 from public.expenses where id = ex_novendor) then raise exception 'archive deleted row'; end if;

  -- Archive never becomes delete: DELETE is not granted
  begin
    delete from public.expenses where id = ex1;
    raise exception 'DELETE on expenses was allowed';
  exception when insufficient_privilege then null;
  end;

  -- Notes: entity must exist; plain note has no reminder fields
  insert into public.notes (entity_type, entity_id, note_type, content) values ('event', ev, 'note', 'הערה');
  begin
    insert into public.notes (entity_type, entity_id, note_type, content) values ('artist', ev, 'note', 'x');
    raise exception 'note attached to wrong entity type';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.notes (entity_type, entity_id, note_type, content, is_completed) values ('event', ev, 'note', 'x', true);
    raise exception 'plain note accepted a completed flag';
  exception when check_violation then null;
  end;
  insert into public.notes (entity_type, entity_id, note_type, content, reminder_date)
    values ('event', ev, 'reminder', 'תזכורת', t + 3);

  -- Income requires an active event
  update public.events set is_archived = true where id = clone_struct;
  begin
    perform public.save_income(jsonb_build_object('event_id', clone_struct, 'name', 'x', 'quantity', 1, 'unit_price', 1));
    raise exception 'income on archived event accepted';
  exception when raise_exception then
    if sqlerrm not like 'DOMAIN:event_not_found%' then raise; end if;
  end;

  raise notice 'ALL DB TESTS PASSED';
end $$;

rollback;
