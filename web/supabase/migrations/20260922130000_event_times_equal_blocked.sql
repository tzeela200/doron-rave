-- DORON'S RAVE — business decision (user, 2026-09-22), closing UX addendum §10:
-- event_start_time == event_end_time is a validation error. No implicit 24-hour events.
-- Enforced in save_event (friendly DOMAIN error) and by a table check (last line of defence).

alter table public.events
  add constraint events_hours_not_equal
  check (event_start_time is null or event_end_time is null or event_start_time <> event_end_time);

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
  if v_start is not null and v_end is not null and v_start = v_end then perform public.domain_error('event_hours_equal'); end if;

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
