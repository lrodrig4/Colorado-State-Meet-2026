# Colorado State Meet Command Center

Mobile-first CHSAA 3A/4A/5A state-qualification tracker for coaches. The app combines public rankings, verified meet results, historical state cutoffs, St. Vrain/last-chance entries, depth charts, relay pools, and virtual state scoring.

## What It Does

- Shows class-specific Top 18 cutoff boards for every boys/girls event.
- Separates hold odds, improve odds, state odds, scratch risk, and weekend-entry context.
- Supports 3A, 4A, and 5A with independent team selections and class-specific data.
- Builds team depth charts and relay pools from current season marks.
- Runs virtual state meet scoring using CHSAA 9-place scoring: `10-8-7-6-5-4-3-2-1`.
- Lets coaches inspect St. Vrain and last-chance scenarios without editing source code.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Commands

```bash
npm run build
npm run test
npm run deploy:prod
```

Print a ranking directly from the data layer:

```bash
npm run rank -- --class=4A --gender=Girls --event="4x800m Relay" --top=50
```

## Data Refresh Commands

These commands update generated data files. Do not store passwords, cookies, or tokens in the repo.

```bash
npm run seed:maxpreps-3a
npm run seed:maxpreps-4a
npm run seed:maxpreps-5a
npm run seed:milesplit-browser
```

Manual verified results can be added as generated correction files under `src/lib/data/` and then included from `src/lib/data/performances.ts`.

## Classification Scope

The app can run the same codebase for a different default CHSAA class.

```bash
NEXT_PUBLIC_DEFAULT_CLASSIFICATION=5A npm run dev
```

URL overrides also work:

```text
/rankings?class=5A
/?class=3A
```

For separate Vercel hosts, create separate Vercel projects pointed at this repo and set:

```bash
NEXT_PUBLIC_DEFAULT_CLASSIFICATION=4A
NEXT_PUBLIC_LOCK_CLASSIFICATION=true
```

Change `NEXT_PUBLIC_DEFAULT_CLASSIFICATION` for each host. Saved focus schools are class-scoped so a 5A team selection does not overwrite a 4A team selection.

## Credential Safety

- Use public pages first.
- Do not commit MileSplit, Athletic.net, MaxPreps, Vercel, or browser cookies.
- Do not put login secrets into Vercel env vars for this public app.
- If authenticated browsing is needed, keep it local-only and convert verified public results into manual correction files.

## Deployment

Production deploy:

```bash
npm run deploy:prod
```

Current production URL:

[https://colorado-distance-qualifier-tracker.vercel.app](https://colorado-distance-qualifier-tracker.vercel.app)
