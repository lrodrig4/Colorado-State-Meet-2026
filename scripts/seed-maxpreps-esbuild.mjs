#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { build } from "esbuild";

const CLASSIFICATION = String(process.env.MAXPREPS_CLASSIFICATION ?? "5A").toUpperCase();
const outDir = path.resolve(".tmp-esbuild");
const outFile = path.join(outDir, `import-maxpreps-${CLASSIFICATION.toLowerCase()}.cjs`);

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.resolve("scripts/import-maxpreps-5a-rankings.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  tsconfig: path.resolve("tsconfig.json"),
  logLevel: "silent",
});

const child = spawn(process.execPath, [outFile], {
  stdio: "inherit",
  env: { ...process.env, MAXPREPS_CLASSIFICATION: CLASSIFICATION },
});

child.on("exit", (code) => process.exit(code ?? 1));
