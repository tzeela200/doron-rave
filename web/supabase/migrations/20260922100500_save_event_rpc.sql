-- DORON'S RAVE — save_event (Book 03 §10 create_event/update_event, §21)
-- Event fields + forecast fields + ticket tiers in one transaction, so an edit can never
-- leave the event saved with half-replaced tiers.
--
-- p: { id?, name, event_date, location?, general_notes?, average_ticket_price?, expected_ticket_count? }
-- p_tiers: null = leave tiers untouched; array = the complete tier list in sale order.
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
begin
  if public.jtext(p, 'name') is null then perform public.domain_error('event_name_required'); end if;
  if public.jtext(p, 'event_date') is null then perform public.domain_error('event_date_required'); end if;
  if v_price is not null and v_price < 0 then perform public.domain_error('amount_invalid'); end if;
  if v_count is not null and (v_count < 0 or v_count <> trunc(v_count)) then perform public.domain_error('ticket_count_invalid'); end if;

  if v_id is null then
    insert into public.events (name, event_date, location, general_notes, average_ticket_price, expected_ticket_count)
    values (public.jtext(p, 'name'), public.jtext(p, 'event_date')::date, coalesce(p ->> 'location', ''),
            coalesce(p ->> 'general_notes', ''), v_price, v_count::integer)
    returning id into v_id;
  else
    update public.events set
      name = public.jtext(p, 'name'),
      event_date = public.jtext(p, 'event_date')::date,
      location = coalesce(p ->> 'location', ''),
      general_notes = coalesce(p ->> 'general_notes', ''),
      average_ticket_price = v_price,
      expected_ticket_count = v_count::integer
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
