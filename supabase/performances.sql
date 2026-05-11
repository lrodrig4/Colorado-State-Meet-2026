-- Supabase/Postgres schema for the read-optimized public performances store.
-- Writes should use the server-only SUPABASE_SERVICE_ROLE_KEY sync script.

create table if not exists public.performances (
  id text primary key,
  athlete_name text not null check (length(athlete_name) <= 160),
  gender text not null check (gender in ('Boys', 'Girls')),
  grade smallint check (grade between 9 and 12),
  school text not null check (length(school) <= 180),
  classification text check (classification in ('1A', '2A', '3A', '4A', '5A')),
  classification_verified boolean not null default false,
  event text not null check (
    event in (
      '100m',
      '200m',
      '400m',
      '800m',
      '1600m',
      '3200m',
      '100m Hurdles',
      '110m Hurdles',
      '300m Hurdles',
      '4x100m Relay',
      '4x200m Relay',
      '4x400m Relay',
      '4x800m Relay',
      'High Jump',
      'Pole Vault',
      'Long Jump',
      'Triple Jump',
      'Shot Put',
      'Discus'
    )
  ),
  mark_raw text not null check (length(mark_raw) <= 32),
  mark_value double precision not null check (mark_value >= 0),
  timing_type text not null check (timing_type in ('FAT', 'Hand', 'Field', 'Unknown')),
  is_fat boolean not null default false,
  meet_name text not null check (length(meet_name) <= 240),
  meet_date date not null,
  source text not null check (
    source in (
      'official_timing',
      'athletic_net',
      'milesplit',
      'maxpreps',
      'generic',
      'manual'
    )
  ),
  source_url text,
  verification_status text not null default 'needs_review' check (
    verification_status in (
      'verified',
      'needs_review',
      'rejected',
      'manual_approved',
      'depth_only'
    )
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists performances_set_updated_at on public.performances;
create trigger performances_set_updated_at
before update on public.performances
for each row
execute function public.set_updated_at();

create index if not exists performances_meet_date_id_idx
  on public.performances (meet_date desc, id asc);

create index if not exists performances_ranking_lookup_idx
  on public.performances (classification, gender, event, mark_value);

create index if not exists performances_school_classification_idx
  on public.performances (school, classification);

create index if not exists performances_review_queue_idx
  on public.performances (verification_status, meet_date desc)
  where verification_status = 'needs_review';

alter table public.performances enable row level security;

revoke insert, update, delete on public.performances from anon, authenticated;
grant select on public.performances to anon, authenticated;

drop policy if exists performances_public_read on public.performances;
create policy performances_public_read
on public.performances
for select
to anon, authenticated
using (true);
