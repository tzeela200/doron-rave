-- DORON'S RAVE — an event can carry its own poster (user request 2026-09-23).
-- The file lives in the existing private bucket under event/{event_id}/…; the row stores the path
-- only, and the app reads it through a signed URL. Additive; money is untouched.

alter table public.events
  add column image_path text;

-- Set or clear the poster on its own, so uploading is one action and not part of a form save.
create or replace function public.set_event_image(p_event_id uuid, p_path text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  if v_path is not null and v_path !~ ('^event/' || p_event_id::text || '/') then
    perform public.domain_error('event_image_path_invalid');
  end if;
  update public.events set image_path = v_path where id = p_event_id and is_archived = false;
  if not found then perform public.domain_error('event_not_found'); end if;
end
$$;

revoke execute on function public.set_event_image(uuid, text) from public, anon;
grant execute on function public.set_event_image(uuid, text) to authenticated;

-- The views carry the path so lists and the event screen can show the poster.
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
  ev.event_end_time,
  ev.image_path
from public.events ev
join public.v_event_financial_totals t on t.event_id = ev.id;

create view public.v_active_events
with (security_invoker = true) as
select * from public.v_event_overview where is_archived = false;

revoke all on public.v_event_overview, public.v_active_events from public, anon, authenticated;
grant select on public.v_event_overview, public.v_active_events to authenticated;
