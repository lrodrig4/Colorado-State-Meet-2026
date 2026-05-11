import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next*/**",
    ".playwright-mcp/**",
    ".tmp-historical/**",
    "node_modules/**",
    "node_modules.broken*/**",
    "src/lib/data/*.generated.ts",
    "src/lib/data/*.generated.json",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.png",
  ]),
]);

export default eslintConfig;
