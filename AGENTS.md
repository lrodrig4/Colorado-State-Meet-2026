<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Shortcuts

- Package manager: npm. Use `npm install` when dependencies need to be restored.
- Dev server: `npm run dev`.
- Production build: `npm run build` (`next build --webpack`). Run this only for routing/config/build-sensitive changes or before a release check.
- Start production server after a build: `npm run start`.
- Lint: `npm run lint`.
- Tests: `npm test` runs `tsx --test src/**/*.test.ts`.
- Targeted tests: run `npx tsx --test path/to/file.test.ts` for a specific test file when possible.

## Repo Map

- App routes and pages: `src/app/`.
- Shared UI: `src/components/`.
- Domain/data logic: `src/lib/`.
- Shared TypeScript types: `src/types/`.
- Data import and audit scripts: `scripts/`.
- Static assets: `public/`.
- Audit outputs and generated reports: `reports/`.

## Speed Guidance

- Before editing Next.js code, read the most specific relevant guide under `node_modules/next/dist/docs/`; avoid broad doc scans.
- Prefer `rg` and targeted file reads over full-tree exploration.
- Skip generated or bulky paths unless directly relevant: `node_modules/`, `.next/`, `.next-stale-*`, `.npm-cache/`, `.playwright-mcp/`, screenshots, and generated report JSON files.
- Use the smallest validation that covers the change: targeted test first, then `npm test` or `npm run lint` when the touched surface justifies it.
- Do not run `npm run build` by default; reserve it for Next config, route/layout behavior, build pipeline, dependency, or release-readiness changes.
