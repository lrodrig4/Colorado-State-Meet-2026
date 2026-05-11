# Supabase Data

This app can read approved school mascot PNGs from Supabase Storage, brand
metadata from `public.school_brand_assets`, and runtime performance rows from
`public.performances`.

## Setup

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/`.
3. Add these env vars locally and in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_MASCOT_BUCKET=school-mascots
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PERFORMANCES_TABLE=performances
SUPABASE_REVALIDATE_SECONDS=300
```

Only use `SUPABASE_SERVICE_ROLE_KEY` locally or in protected automation. It is
for uploading reviewed PNGs and metadata, not browser code.

## Performance Data

Seed or refresh `public.performances` from the current generated app data:

```bash
SUPABASE_REPLACE_PERFORMANCES=true npm run sync:supabase
```

The app uses Supabase when `NEXT_PUBLIC_SUPABASE_URL` and either
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, or
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are available. If they are missing or a fetch
fails, it falls back to the generated static data.

## Mascot Import Flow

Generate a review sheet for one selected team:

```bash
npm run mascots:template -- --classification=4A --team="Palmer Ridge High School"
```

Fill in:

- `mascot_name`
- `source_url`
- `source_label`
- `candidate_search_url` is generated for review, not uploaded
- `local_png_path`
- `dominant_color`
- `accent_color`
- `license_status=approved`

Then upload approved rows:

```bash
npm run mascots:upload -- --file=reports/school-mascot-import-template.csv
```

The dashboard only renders remote mascot PNGs for rows with
`license_status=approved`. Unapproved or missing assets fall back to a clean team
monogram so the mobile UI still looks intentional.
