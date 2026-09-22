-- DORON'S RAVE — core schema (Book 03 §5, §6, §12, §13, §14, §25)
-- 14 canonical entities. Money is numeric(12,2). Business dates are DATE, show times are TIME,
-- technical timestamps are timestamptz. Derived values (paid, remaining, P&L, readiness,
-- lineup, overdue) are never stored as columns (Book 03 §8).

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- "Today" in the business timezone. Every overdue / upcoming comparison uses this one function.
create or replace function public.app_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

-- The artists category is identified by its name, exactly as the legacy system did
-- (Config.gs DEFAULT_CATEGORY_NAME). It never has subcategories and is the only
-- category whose expenses carry performance times (Book 01 §17, Book 04 §11).
create or replace function public.artists_category_name()
returns text
language sql
immutable
set search_path = ''
as $$ select 'אמנים'::text $$;

-- Uniform updated_at trigger (Book 03 §14). The frontend never sends updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Dictionaries and people
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_artists_category(p_category_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select trim(c.name) = public.artists_category_name() from public.categories c where c.id = p_category_id),
    false)
$$;

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name text not null check (trim(name) <> ''),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  phone text not null default '',
  contact_details text not null default '',
  notes text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  legacy_name text,                         -- legacy Artists.name, migration compatibility only
  real_name text not null default '',
  stage_name text not null default '',
  phone text not null default '',
  contact_details text not null default '',
  notes text not null default '',
  system_notes text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An artist must be identifiable by at least one name.
  constraint artists_has_name check (
    trim(coalesce(stage_name, '')) <> '' or trim(coalesce(legacy_name, '')) <> '' or trim(coalesce(real_name, '')) <> ''
  )
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Events and their planning data
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  event_date date not null,
  location text not null default '',
  general_notes text not null default '',
  average_ticket_price numeric(12,2) check (average_ticket_price >= 0),
  expected_ticket_count integer check (expected_ticket_count >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (trim(name) <> ''),
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_tiers_event_sort_unique unique (event_id, sort_order)
);

create table public.event_required_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  created_at timestamptz not null default now(),
  -- A required item is exactly one category OR one subcategory (Book 03 §6).
  constraint event_required_items_exactly_one check (num_nonnulls(category_id, subcategory_id) = 1)
);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (trim(name) <> ''),
  category_id uuid not null references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  agreed_amount numeric(12,2) not null default 0 check (agreed_amount >= 0),
  vendor_id uuid references public.vendors(id),
  artist_id uuid references public.artists(id),
  paid_by text not null default '',
  manual_status text not null default 'מתוכנן' check (manual_status in ('מתוכנן', 'סוכם')),
  expense_date date,
  internal_notes text not null default '',
  performance_start_time time,
  performance_end_time time,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Show times come as a pair, and a pair of identical times is not a 24-hour show (Book 04 §11, ADR-036).
  constraint expenses_performance_pair check (
    (performance_start_time is null) = (performance_end_time is null)
  ),
  constraint expenses_performance_not_equal check (
    performance_start_time is null or performance_start_time <> performance_end_time
  )
);

create table public.expense_coverage (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id),
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  custom_label text check (custom_label is null or char_length(custom_label) <= 60),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_coverage_identified check (
    category_id is not null or subcategory_id is not null or trim(coalesce(custom_label, '')) <> ''
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  paid_date date,
  payment_method_id uuid references public.payment_methods(id),
  payment_status text not null default 'מתוכנן' check (payment_status in ('מתוכנן', 'ממתין לתשלום', 'שולם')),
  note text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.income (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (trim(name) <> ''),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  notes text not null default '',
  is_ticket_income boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notes and attachments (controlled polymorphism)
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('event', 'artist')),
  entity_id uuid not null,
  note_type text not null check (note_type in ('note', 'reminder')),
  content text not null check (trim(content) <> ''),
  reminder_date date,
  is_completed boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A plain note is not a task: no date, no "done" state (Book 04 / ADR-023).
  constraint notes_reminder_fields check (
    note_type = 'reminder' or (reminder_date is null and is_completed = false)
  )
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('event', 'expense', 'artist', 'vendor')),
  entity_id uuid not null,
  storage_bucket text not null default 'dorons-rave',
  storage_path text not null check (trim(storage_path) <> ''),
  file_name text not null check (trim(file_name) <> ''),
  mime_type text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cross-table integrity that a CHECK cannot express
-- ---------------------------------------------------------------------------

-- Subcategory must belong to the given category; artists category has no subcategories;
-- show times only on artist expenses (Book 03 §6).
create or replace function public.check_expense_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subcategory_id is not null then
    if public.is_artists_category(new.category_id) then
      raise exception 'artists category has no subcategories' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.subcategories s
                   where s.id = new.subcategory_id and s.category_id = new.category_id) then
      raise exception 'subcategory does not belong to category' using errcode = 'check_violation';
    end if;
  end if;
  if new.performance_start_time is not null and not public.is_artists_category(new.category_id) then
    raise exception 'performance times are allowed only on artist expenses' using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger expenses_integrity
  before insert or update of category_id, subcategory_id, performance_start_time, performance_end_time
  on public.expenses
  for each row execute function public.check_expense_integrity();

create or replace function public.check_subcategory_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_artists_category(new.category_id) then
    raise exception 'artists category has no subcategories' using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger subcategories_parent
  before insert or update of category_id on public.subcategories
  for each row execute function public.check_subcategory_parent();

-- Coverage / required item: when both ids are present they must agree.
create or replace function public.check_category_pair()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null and new.subcategory_id is not null
     and not exists (select 1 from public.subcategories s
                     where s.id = new.subcategory_id and s.category_id = new.category_id) then
    raise exception 'subcategory does not belong to category' using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger expense_coverage_pair
  before insert or update on public.expense_coverage
  for each row execute function public.check_category_pair();

-- Notes / attachments must point at an existing entity of the declared type (Book 04 §20).
create or replace function public.check_polymorphic_entity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found boolean;
begin
  found := case new.entity_type
    when 'event'   then exists (select 1 from public.events   where id = new.entity_id)
    when 'artist'  then exists (select 1 from public.artists  where id = new.entity_id)
    when 'expense' then exists (select 1 from public.expenses where id = new.entity_id)
    when 'vendor'  then exists (select 1 from public.vendors  where id = new.entity_id)
    else false
  end;
  if not found then
    raise exception 'entity % % not found', new.entity_type, new.entity_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end
$$;

create trigger notes_entity
  before insert or update of entity_type, entity_id on public.notes
  for each row execute function public.check_polymorphic_entity();

create trigger attachments_entity
  before insert or update of entity_type, entity_id on public.attachments
  for each row execute function public.check_polymorphic_entity();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger subcategories_updated_at before update on public.subcategories for each row execute function public.set_updated_at();
create trigger vendors_updated_at before update on public.vendors for each row execute function public.set_updated_at();
create trigger artists_updated_at before update on public.artists for each row execute function public.set_updated_at();
create trigger payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger ticket_tiers_updated_at before update on public.ticket_tiers for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create trigger expense_coverage_updated_at before update on public.expense_coverage for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger income_updated_at before update on public.income for each row execute function public.set_updated_at();
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes (Book 03 §12) — only the real query paths
-- ---------------------------------------------------------------------------

create index events_archived_date_idx on public.events (is_archived, event_date);
create index expenses_event_idx on public.expenses (event_id, is_archived);
create index expenses_artist_idx on public.expenses (artist_id, is_archived);
create index expenses_vendor_idx on public.expenses (vendor_id, is_archived);
create index expenses_category_idx on public.expenses (category_id, subcategory_id);
create index payments_expense_idx on public.payments (expense_id, is_archived);
create index payments_status_due_idx on public.payments (payment_status, due_date) where is_archived = false;
create index income_event_idx on public.income (event_id, is_archived);
create index notes_entity_idx on public.notes (entity_type, entity_id, is_archived);
create index ticket_tiers_event_idx on public.ticket_tiers (event_id, sort_order);
create index event_required_items_event_idx on public.event_required_items (event_id);
create index expense_coverage_expense_idx on public.expense_coverage (expense_id, is_archived);
create index subcategories_category_idx on public.subcategories (category_id);
create index attachments_entity_idx on public.attachments (entity_type, entity_id, is_archived);

-- ---------------------------------------------------------------------------
-- Unique constraints (Book 03 §13)
-- ---------------------------------------------------------------------------

create unique index payment_methods_active_name_unique
  on public.payment_methods (lower(trim(name))) where is_active;

create unique index event_required_items_category_unique
  on public.event_required_items (event_id, category_id) where category_id is not null;
create unique index event_required_items_subcategory_unique
  on public.event_required_items (event_id, subcategory_id) where subcategory_id is not null;

create unique index expense_coverage_active_unique
  on public.expense_coverage (
    expense_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(coalesce(custom_label, '')))
  ) where is_archived = false;
