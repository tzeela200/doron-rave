-- DORON'S RAVE — vendor / artist usage (Book 05 §12.1, §13; legacy getVendors/getArtists)
-- Facts only: in how many events the vendor/artist appears, the agreed total of their active
-- expenses, and the next upcoming event. Money sums stay in SQL (ADR-042).

create view public.v_vendor_usage
with (security_invoker = true) as
select
  e.vendor_id,
  count(distinct e.event_id) as events_count,
  sum(e.agreed_amount)::numeric(12,2) as total_agreed,
  (array_agg(ev.id order by ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived))[1] as next_event_id,
  (array_agg(ev.name order by ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived))[1] as next_event_name,
  min(ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived) as next_event_date
from public.expenses e
join public.events ev on ev.id = e.event_id
where e.is_archived = false and e.vendor_id is not null
group by e.vendor_id;

create view public.v_artist_usage
with (security_invoker = true) as
select
  e.artist_id,
  count(distinct e.event_id) as events_count,
  sum(e.agreed_amount)::numeric(12,2) as total_agreed,
  (array_agg(ev.id order by ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived))[1] as next_event_id,
  (array_agg(ev.name order by ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived))[1] as next_event_name,
  min(ev.event_date) filter (where ev.event_date >= public.app_today() and not ev.is_archived) as next_event_date
from public.expenses e
join public.events ev on ev.id = e.event_id
where e.is_archived = false and e.artist_id is not null
group by e.artist_id;

revoke all on public.v_vendor_usage, public.v_artist_usage from anon, authenticated;
grant select on public.v_vendor_usage, public.v_artist_usage to authenticated;
