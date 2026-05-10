# Operations

## Daily Verification Flow

1. Check MaxPreps, MileSplit Colorado, Rapid Results, and AthleticLIVE for new eligible results.
2. Import generated source data where possible.
3. Add manual correction files for verified result pages that are not reflected in public rankings yet.
4. Check the affected ranking in the local app before deploying.
5. Deploy only after the affected event list matches the verified source.

## Manual Correction Pattern

Use a generated file under `src/lib/data/` with `Performance[]` rows. Keep the row source URL and meet date specific. Import it from `src/lib/data/performances.ts` after the broader imported feeds so verified late corrections win.

If an earlier scrape was preliminary and has incorrect marks, filter that event/meet out before appending the corrected rows.

## GitHub Setup

After the local repo is initialized:

```bash
git add .
git commit -m "Initialize Colorado state meet command center"
gh repo create colorado-state-meet-command-center --private --source=. --remote=origin --push
```

Use `--public` only when you are comfortable with the generated public-source data being visible.
