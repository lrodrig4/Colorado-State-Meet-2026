import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { localSchoolBrandAssets } from "@/lib/data/schoolBranding.generated";
import {
  normalizeSchoolLookupKey,
  schools,
} from "@/lib/data/schools";
import { schoolBrandAssetId } from "@/lib/services/schoolBranding";
import type { Classification, School } from "@/types/domain";

const classifications = new Set(["1A", "2A", "3A", "4A", "5A"]);
const outputColumns = [
  "school_id",
  "school_name",
  "classification",
  "mascot_name",
  "source_url",
  "source_label",
  "candidate_search_url",
  "local_png_path",
  "storage_path",
  "license_status",
  "dominant_color",
  "accent_color",
];

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function getArgs(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .filter((arg) => arg.startsWith(prefix))
    .map((arg) => arg.slice(prefix.length))
    .filter(Boolean);
}

function csvCell(value: string | undefined) {
  const clean = value ?? "";

  if (/[",\n]/.test(clean)) {
    return `"${clean.replace(/"/g, '""')}"`;
  }

  return clean;
}

function teamMatches(school: School, teamName: string) {
  const teamKey = normalizeSchoolLookupKey(teamName);
  return [school.schoolName, ...school.aliases].some(
    (alias) => normalizeSchoolLookupKey(alias) === teamKey,
  );
}

function resolveClassification(): Classification | undefined {
  const value =
    getArg("classification") ||
    getArg("class") ||
    process.env.NEXT_PUBLIC_DEFAULT_CLASSIFICATION;

  if (!value) return undefined;

  if (!classifications.has(value)) {
    throw new Error(`Invalid classification "${value}". Use 1A, 2A, 3A, 4A, or 5A.`);
  }

  return value as Classification;
}

function resolveSchools() {
  const classification = resolveClassification();
  const teams = getArgs("team");
  let selected = schools;

  if (classification) {
    selected = selected.filter((school) => school.classification === classification);
  }

  if (teams.length) {
    selected = selected.filter((school) =>
      teams.some((teamName) => teamMatches(school, teamName)),
    );
  }

  return selected.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
}

async function main() {
  const outputPath =
    getArg("out") || "reports/school-mascot-import-template.csv";
  const selectedSchools = resolveSchools();

  if (!selectedSchools.length) {
    throw new Error("No schools matched the requested classification/team filters.");
  }

  const rows = selectedSchools.map((school) => {
    const schoolId = schoolBrandAssetId(school.schoolName, school.classification);
    const localAsset = localSchoolBrandAssets[schoolId];

    return [
      schoolId,
      school.schoolName,
      school.classification,
      localAsset?.mascotName,
      localAsset?.sourceUrl,
      localAsset?.sourceLabel,
      `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
        `${school.schoolName} ${school.classification} mascot logo PNG official`,
      )}`,
      "",
      `${school.classification.toLowerCase()}/${schoolId}.png`,
      localAsset?.licenseStatus ?? "needs_review",
      localAsset?.dominantColor,
      localAsset?.accentColor,
    ].map(csvCell);
  });

  const csv = [
    outputColumns.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
  const absoluteOutputPath = path.resolve(outputPath);

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, `${csv}\n`, "utf8");

  console.log(
    `Wrote ${selectedSchools.length} mascot import row(s) to ${absoluteOutputPath}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
