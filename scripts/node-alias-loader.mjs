import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function candidateFiles(basePath) {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];
}

function resolveProjectAlias(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const relative = specifier.slice(2);
  const basePath = path.join(projectRoot, "src", relative);
  for (const candidate of candidateFiles(basePath)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const mapped = resolveProjectAlias(specifier);
  if (mapped) {
    return nextResolve(mapped, context);
  }
  return nextResolve(specifier, context);
}

