-- DORON'S RAVE — align event hours with the canonical amendment
-- (UX Change Addendum — Event Hours & Accordions, 2026-09-22, §2 and §9–§10).
--   * column names: event_start_time / event_end_time (TIME, nullable)
--   * start == end is NOT blocked: the addendum leaves it to an explicit business decision and
--     only says no duration is shown for it (§10). The earlier check is removed.
-- The columns were added earlier the same day and hold no data (verified: 0 of 2 events).

alter table public.events drop constraint events_times_not_equal;
alter table public.events rename column start_time to event_start_time;
alter table public.events rename column end_time to event_end_time;

-- View column names do not follow a table rename, so both views are rebuilt.
drop view public.v_active_events;
drop view public.v_event_overview;

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
  t.artists_count,
  ev.event_start_time,
  ev.event_end_time
from public.events ev
join public.v_event_financial_totals t on t.event_id = ev.id;

create view public.v_active_events
with (security_invoker = true) as
select * from public.v_event_overview where is_archived = false;

revoke all on public.v_event_overview, public.v_active_events from public, anon, authenticated;
grant select on public.v_event_overview, public.v_active_events to authenticated;

-- save_event: hours are written atomically with the event, and only when the caller sends the
-- keys, so a client that does not know about them never clears them.
create or replace function public.save_event(p jsonb, p_tiers jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := public.jtext(p, 'id')::uuid;
  v_price numeric := public.jnum(p, 'average_ticket_price');
  v_count numeric := public.jnum(p, 'expected_ticket_count');
  v_start time := public.jtext(p, 'event_start_time')::time;
  v_end time := public.jtext(p, 'event_end_time')::time;
begin
  if public.jtext(p, 'name') is null then perform public.domain_error('event_name_required'); end if;
  if public.jtext(p, 'event_date') is null then perform public.domain_error('event_date_required'); end if;
  if v_price is not null and v_price < 0 then perform public.domain_error('amount_invalid'); end if;
  if v_count is not null and (v_count < 0 or v_count <> trunc(v_count)) then perform public.domain_error('ticket_count_invalid'); end if;

  if v_id is null then
    insert into public.events (name, event_date, location, general_notes, average_ticket_price, expected_ticket_count, event_start_time, event_end_time)
    values (public.jtext(p, 'name'), public.jtext(p, 'event_date')::date, coalesce(p ->> 'location', ''),
            coalesce(p ->> 'general_notes', ''), v_price, v_count::integer, v_start, v_end)
    returning id into v_id;
  else
    update public.events set
      name = public.jtext(p, 'name'),
      event_date = public.jtext(p, 'event_date')::date,
      location = coalesce(p ->> 'location', ''),
      general_notes = coalesce(p ->> 'general_notes', ''),
      average_ticket_price = v_price,
      expected_ticket_count = v_count::integer,
      event_start_time = case when p ? 'event_start_time' then v_start else event_start_time end,
      event_end_time = case when p ? 'event_end_time' then v_end else event_end_time end
    where id = v_id and is_archived = false;
    if not found then perform public.domain_error('event_not_found'); end if;
  end if;

  if p_tiers is not null then
    perform public.set_ticket_tiers(v_id, p_tiers);
  end if;
  return v_id;
end
$$;

revoke execute on function public.save_event(jsonb, jsonb) from public, anon;
grant execute on function public.save_event(jsonb, jsonb) to authenticated;
