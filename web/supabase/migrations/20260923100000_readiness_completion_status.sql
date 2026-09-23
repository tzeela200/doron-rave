-- DORON'S RAVE — production readiness becomes a checklist of work, not only of expenses
-- (user decision 2026-09-23). Additive only:
--   * every required item gets a manual completion status: לא התחיל / בטיפול / בוצע
--   * the readiness percentage counts items marked בוצע (the derived expense coverage is still
--     shown next to each item, and money, profit and break-even are untouched)
-- Nothing here writes to expenses, payments or income.

alter table public.event_required_items
  add column completion_status text not null default 'לא התחיל'
    check (completion_status in ('לא התחיל', 'בטיפול', 'בוצע')),
  add column completed_at timestamptz;

-- One item's status. Completing stamps the time; leaving "בוצע" clears it.
create or replace function public.set_required_item_status(p_item_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event uuid;
begin
  if p_status not in ('לא התחיל', 'בטיפול', 'בוצע') then perform public.domain_error('readiness_status_invalid'); end if;

  select i.event_id into v_event
  from public.event_required_items i
  join public.events e on e.id = i.event_id and e.is_archived = false
  where i.id = p_item_id;
  if v_event is null then perform public.domain_error('required_item_not_found'); end if;

  update public.event_required_items
  set completion_status = p_status,
      completed_at = case when p_status = 'בוצע' then now() end
  where id = p_item_id;
end
$$;

revoke execute on function public.set_required_item_status(uuid, text) from public, anon;
grant execute on function public.set_required_item_status(uuid, text) to authenticated;

-- Editing the list must not lose progress: items that stay keep their status; only items the
-- user removed are deleted, and only new ones are inserted.
create or replace function public.set_event_required_items(p_event_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_cats uuid[] := '{}';
  v_subs uuid[] := '{}';
begin
  if not exists (select 1 from public.events where id = p_event_id and is_archived = false) then
    perform public.domain_error('event_not_found');
  end if;
  if jsonb_typeof(p_items) <> 'array' then perform public.domain_error('required_items_invalid'); end if;

  for v_row in select * from jsonb_array_elements(p_items) loop
    if public.jtext(v_row, 'subcategory_id') is not null then
      v_subs := v_subs || public.jtext(v_row, 'subcategory_id')::uuid;
    elsif public.jtext(v_row, 'category_id') is not null then
      v_cats := v_cats || public.jtext(v_row, 'category_id')::uuid;
    end if;
  end loop;

  delete from public.event_required_items
  where event_id = p_event_id
    and coalesce(category_id <> all (v_cats), true)
    and coalesce(subcategory_id <> all (v_subs), true);

  insert into public.event_required_items (event_id, category_id, subcategory_id)
  select p_event_id, c, null from unnest(v_cats) as c
  on conflict do nothing;

  insert into public.event_required_items (event_id, category_id, subcategory_id)
  select p_event_id, null, s from unnest(v_subs) as s
  on conflict do nothing;
end
$$;

revoke execute on function public.set_event_required_items(uuid, jsonb) from public, anon;
grant execute on function public.set_event_required_items(uuid, jsonb) to authenticated;
