create table if not exists public.performances (
  id text primary key,
  athlete_name text not null,
  gender text not null,
  grade integer,
  school text not null,
  classification text,
  classification_verified boolean not null default false,
  event text not null,
  mark_raw text not null,
  mark_value double precision not null,
  timing_type text not null,
  is_fat boolean not null default false,
  meet_name text not null,
  meet_date date not null,
  source text not null default 'official_timing',
  source_url text,
  verification_status text not null default 'verified',
  notes text,
  updated_at timestamptz not null default now(),
  constraint performances_gender_check
    check (gender in ('Boys', 'Girls')),
  constraint performances_grade_check
    check (grade is null or grade between 6 and 12),
  constraint performances_classification_check
    check (classification is null or classification in ('1A', '2A', '3A', '4A', '5A')),
  constraint performances_event_check
    check (
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
  constraint performances_timing_type_check
    check (timing_type in ('FAT', 'Hand', 'Field', 'Unknown')),
  constraint performances_source_check
    check (
      source in (
        'official_timing',
        'athletic_net',
        'milesplit',
        'maxpreps',
        'generic',
        'manual'
      )
    ),
  constraint performances_verification_status_check
    check (
      verification_status in (
        'verified',
        'needs_review',
        'rejected',
        'manual_approved',
        'depth_only'
      )
    )
);

create index if not exists performances_rank_lookup_idx
  on public.performances (classification, gender, event, mark_value);

create index if not exists performances_verified_rank_lookup_idx
  on public.performances (classification, gender, event, mark_value)
  where verification_status in ('verified', 'manual_approved', 'depth_only');

create index if not exists performances_event_gender_lookup_idx
  on public.performances (event, gender, mark_value);

create index if not exists performances_school_lookup_idx
  on public.performances (school, classification);

create index if not exists performances_meet_date_idx
  on public.performances (meet_date desc);

alter table public.performances enable row level security;

drop policy if exists "Performances are publicly readable"
  on public.performances;

create policy "Performances are publicly readable"
  on public.performances
  for select
  to public
  using (true);

drop policy if exists "Service role manages performances"
  on public.performances;

create policy "Service role manages performances"
  on public.performances
  for all
  to service_role
  using (true)
  with check (true);
