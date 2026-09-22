-- DORON'S RAVE — legacy migration audit (Book 09 §6, §9, §42)
-- Lives in its own schema, which the Data API does not expose; the app never reads it.
-- Kept after cut-over for traceability: legacy id → target UUID, and what each run did.

create schema if not exists migration;
revoke all on schema migration from anon, authenticated;

create table if not exists migration.id_map (
  entity_type text not null,
  legacy_id text not null,
  target_id uuid not null,
  run_id text not null,
  source_row integer,
  created_at timestamptz not null default now(),
  primary key (entity_type, legacy_id),
  unique (entity_type, target_id)
);

create table if not exists migration.run_log (
  run_id text primary key,
  snapshot_sha256 text not null,
  started_at timestamptz not null default now(),
  status text not null,
  counts jsonb not null default '{}'::jsonb,
  notes text not null default ''
);

revoke all on all tables in schema migration from anon, authenticated;
