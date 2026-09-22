-- DORON'S RAVE — event start/end time (Design System Update v2, "Event Edit").
-- Both optional. End earlier than start = the event crosses midnight (same rule as line-up);
-- equal start and end is blocked (same rule as line-up). Additive only.

alter table public.events
  add column start_time time,
  add column end_time time,
  add constraint events_times_not_equal check (start_time is null or end_time is null or start_time <> end_time);

-- New columns are appended at the end so existing view columns keep their positions.
create or replace view public.v_event_overview
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
  ev.start_time,
  ev.end_time
from public.events ev
join public.v_event_financial_totals t on t.event_id = ev.id;

create or replace view public.v_active_events
with (security_invoker = true) as
select * from public.v_event_overview where is_archived = false;

-- save_event: times are written only when the caller sends the keys, so a client that does not
-- know about them never clears them.
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
  v_start time := public.jtext(p, 'start_time')::time;
  v_end time := public.jtext(p, 'end_time')::time;
begin
  if public.jtext(p, 'name') is null then perform public.domain_error('event_name_required'); end if;
  if public.jtext(p, 'event_date') is null then perform public.domain_error('event_date_required'); end if;
  if v_price is not null and v_price < 0 then perform public.domain_error('amount_invalid'); end if;
  if v_count is not null and (v_count < 0 or v_count <> trunc(v_count)) then perform public.domain_error('ticket_count_invalid'); end if;
  if v_start is not null and v_end is not null and v_start = v_end then perform public.domain_error('performance_times_equal'); end if;

  if v_id is null then
    insert into public.events (name, event_date, location, general_notes, average_ticket_price, expected_ticket_count, start_time, end_time)
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
      start_time = case when p ? 'start_time' then v_start else start_time end,
      end_time = case when p ? 'end_time' then v_end else end_time end
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
