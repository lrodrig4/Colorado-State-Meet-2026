import type { Performance } from "@/types/domain";

type SupabasePerformanceUpsertRow = {
  id: string;
  athlete_name: string;
  gender: Performance["gender"];
  grade: number | null;
  school: string;
  classification: Performance["classification"] | null;
  classification_verified: boolean;
  event: Performance["event"];
  mark_raw: string;
  mark_value: number;
  timing_type: Performance["timingType"];
  is_fat: boolean;
  meet_name: string;
  meet_date: string;
  source: Performance["source"];
  source_url: string | null;
  verification_status: Performance["verificationStatus"];
  notes: string | null;
};

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tableName = process.env.SUPABASE_PERFORMANCES_TABLE ?? "performances";
const chunkSize = parseChunkSize(process.env.SUPABASE_SYNC_CHUNK_SIZE);
const shouldReplace = process.env.SUPABASE_REPLACE_PERFORMANCES === "true";

function requireConfig() {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error("SUPABASE_PERFORMANCES_TABLE must be a simple table name.");
  }
}

function endpoint(path: string) {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  return new URL(path, supabaseUrl).toString();
}

function parseChunkSize(raw: string | undefined) {
  const parsed = Number(raw ?? 500);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error("SUPABASE_SYNC_CHUNK_SIZE must be an integer from 1 to 1000.");
  }

  return parsed;
}

function authHeaders() {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function rowFromPerformance(performance: Performance): SupabasePerformanceUpsertRow {
  return {
    id: performance.id,
    athlete_name: performance.athleteName,
    gender: performance.gender,
    grade: performance.grade ?? null,
    school: performance.school,
    classification: performance.classification ?? null,
    classification_verified: performance.classificationVerified,
    event: performance.event,
    mark_raw: performance.markRaw,
    mark_value: performance.markValue,
    timing_type: performance.timingType,
    is_fat: performance.isFAT,
    meet_name: performance.meetName,
    meet_date: performance.meetDate,
    source: performance.source,
    source_url: performance.sourceUrl ?? null,
    verification_status: performance.verificationStatus,
    notes: performance.notes ?? null,
  };
}

async function assertOk(response: Response, label: string) {
  if (response.ok) return;

  const body = await response.text();
  throw new Error(`${label} failed: ${response.status} ${body.slice(0, 1000)}`);
}

async function deleteExistingRows() {
  const response = await fetch(
    endpoint(`/rest/v1/${tableName}?id=not.is.null`),
    {
      method: "DELETE",
      headers: {
        ...authHeaders(),
        Prefer: "return=minimal",
      },
    },
  );

  await assertOk(response, "Supabase delete existing performances");
}

async function upsertRows(rows: SupabasePerformanceUpsertRow[]) {
  const response = await fetch(
    endpoint(`/rest/v1/${tableName}?on_conflict=id`),
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );

  await assertOk(response, `Supabase upsert ${rows.length} performances`);
}

async function main() {
  requireConfig();

  const { performances } = await import("@/lib/data/performances");
  const rows = performances.map(rowFromPerformance);

  if (shouldReplace) {
    console.log(`Deleting existing rows from public.${tableName}...`);
    await deleteExistingRows();
  }

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await upsertRows(chunk);
    console.log(`Synced ${Math.min(index + chunk.length, rows.length)} / ${rows.length}`);
  }

  console.log(`Done. Synced ${rows.length} performances to public.${tableName}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
