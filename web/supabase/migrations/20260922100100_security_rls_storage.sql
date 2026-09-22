-- DORON'S RAVE — security (Book 03 §15–16, Book 08 §9–10, ADR-006, ADR-054)
-- Personal system for two people: there are no roles, teams or per-row ownership.
-- The rule is binary: a signed-in user (Supabase Auth) sees and edits everything;
-- anonymous callers see nothing. Public sign-up must be disabled in the Supabase
-- dashboard so that only the two provisioned accounts can ever hold a session.

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'subcategories', 'vendors', 'artists', 'payment_methods', 'events',
    'ticket_tiers', 'event_required_items', 'expenses', 'expense_coverage', 'payments',
    'income', 'notes', 'attachments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Supabase default privileges grant ALL to anon/authenticated; start from nothing.
    execute format('revoke all on public.%I from anon, authenticated', t);
    -- Archive, never delete (Book 03 §11): DELETE is not granted on business tables.
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t);
  end loop;
end
$$;

-- Event configuration rows are replaced, not archived (Book 03 §11).
grant delete on public.ticket_tiers to authenticated;
grant delete on public.event_required_items to authenticated;

-- Helper functions are callable only by signed-in users.
revoke execute on function public.app_today() from public, anon;
revoke execute on function public.artists_category_name() from public, anon;
revoke execute on function public.is_artists_category(uuid) from public, anon;
grant execute on function public.app_today() to authenticated;
grant execute on function public.artists_category_name() to authenticated;
grant execute on function public.is_artists_category(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket. Path: {entity_type}/{entity_id}/{uuid}-{safe_filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('dorons-rave', 'dorons-rave', false)
on conflict (id) do update set public = false;

create policy dorons_rave_objects_select on storage.objects
  for select to authenticated using (bucket_id = 'dorons-rave');
create policy dorons_rave_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'dorons-rave'
    and (storage.foldername(name))[1] in ('event', 'expense', 'artist', 'vendor')
  );
-- No update/delete policy: removing a file from the UI archives the metadata row only
-- (Book 03 §15). Physical cleanup is a deliberate admin operation.
