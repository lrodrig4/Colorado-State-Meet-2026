create table if not exists public.school_brand_assets (
  school_id text primary key,
  school_name text not null,
  classification text not null,
  mascot_name text,
  mascot_asset_path text,
  mascot_public_url text,
  source_url text,
  source_label text,
  license_status text not null default 'needs_review',
  dominant_color text,
  accent_color text,
  updated_at timestamptz not null default now(),
  constraint school_brand_assets_classification_check
    check (classification in ('1A', '2A', '3A', '4A', '5A')),
  constraint school_brand_assets_license_status_check
    check (license_status in ('approved', 'needs_review', 'rejected')),
  constraint school_brand_assets_dominant_color_check
    check (dominant_color is null or dominant_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint school_brand_assets_accent_color_check
    check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists school_brand_assets_approved_lookup_idx
  on public.school_brand_assets (classification, school_id)
  where license_status = 'approved';

create index if not exists school_brand_assets_school_name_idx
  on public.school_brand_assets (school_name);

alter table public.school_brand_assets enable row level security;

drop policy if exists "Approved school brand assets are publicly readable"
  on public.school_brand_assets;

create policy "Approved school brand assets are publicly readable"
  on public.school_brand_assets
  for select
  to public
  using (license_status = 'approved');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'school-mascots',
  'school-mascots',
  true,
  524288,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "School mascot PNGs are publicly readable"
  on storage.objects;

create policy "School mascot PNGs are publicly readable"
  on storage.objects
  for select
  to public
  using (bucket_id = 'school-mascots');

drop policy if exists "Service role manages school mascot PNGs"
  on storage.objects;

create policy "Service role manages school mascot PNGs"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'school-mascots')
  with check (bucket_id = 'school-mascots');
