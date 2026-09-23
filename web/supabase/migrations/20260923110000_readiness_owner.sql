-- DORON'S RAVE — who is responsible for a readiness item (user request 2026-09-23).
-- Free text, so the list of people is never hard-coded; the UI offers quick picks.
-- Additive only; nothing here touches money.

alter table public.event_required_items
  add column owner_name text not null default '';

create or replace function public.set_required_item_owner(p_item_id uuid, p_owner text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event uuid;
begin
  select i.event_id into v_event
  from public.event_required_items i
  join public.events e on e.id = i.event_id and e.is_archived = false
  where i.id = p_item_id;
  if v_event is null then perform public.domain_error('required_item_not_found'); end if;

  update public.event_required_items
  set owner_name = left(coalesce(trim(p_owner), ''), 60)
  where id = p_item_id;
end
$$;

revoke execute on function public.set_required_item_owner(uuid, text) from public, anon;
grant execute on function public.set_required_item_owner(uuid, text) to authenticated;
