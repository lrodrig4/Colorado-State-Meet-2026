import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  SourceKind,
  TimingType,
  VerificationStatus,
} from "@/types/domain";

type SupabasePerformanceRow = {
  id: string;
  athlete_name: string;
  gender: Gender;
  grade: number | null;
  school: string;
  classification: Classification | null;
  classification_verified: boolean | null;
  event: EventKey;
  mark_raw: string;
  mark_value: number | string;
  timing_type: TimingType;
  is_fat: boolean | null;
  meet_name: string;
  meet_date: string;
  source: SourceKind | null;
  source_url: string | null;
  verification_status: VerificationStatus | null;
  notes: string | null;
};

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tableName = process.env.SUPABASE_PERFORMANCES_TABLE ?? "performances";
const revalidateSeconds = Number(process.env.SUPABASE_REVALIDATE_SECONDS ?? 300);
const pageSize = 1000;
const selectColumns = [
  "id",
  "athlete_name",
  "gender",
  "grade",
  "school",
  "classification",
  "classification_verified",
  "event",
  "mark_raw",
  "mark_value",
  "timing_type",
  "is_fat",
  "meet_name",
  "meet_date",
  "source",
  "source_url",
  "verification_status",
  "notes",
].join(",");

let sourcePerformancesPromise: Promise<Performance[]> | undefined;

export function isSupabasePerformanceStoreConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getPerformanceDataSource() {
  return isSupabasePerformanceStoreConfigured() ? "supabase" : "static";
}

function validatedTableName() {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error("SUPABASE_PERFORMANCES_TABLE must be a simple table name.");
  }

  return tableName;
}

function supabaseRestUrl(offset: number) {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }

  const url = new URL(`/rest/v1/${validatedTableName()}`, supabaseUrl);
  url.searchParams.set("select", selectColumns);
  url.searchParams.set("order", "meet_date.desc,id.asc");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(pageSize));
  return url;
}

function rowToPerformance(row: SupabasePerformanceRow): Performance {
  return {
    id: row.id,
    athleteName: row.athlete_name,
    gender: row.gender,
    grade: row.grade ?? undefined,
    school: row.school,
    classification: row.classification ?? undefined,
    classificationVerified: row.classification_verified ?? Boolean(row.classification),
    event: row.event,
    markRaw: row.mark_raw,
    markValue:
      typeof row.mark_value === "number"
        ? row.mark_value
        : Number(row.mark_value),
    timingType: row.timing_type,
    isFAT: row.is_fat ?? row.timing_type === "FAT",
    meetName: row.meet_name,
    meetDate: row.meet_date,
    source: row.source ?? "official_timing",
    sourceUrl: row.source_url ?? undefined,
    verificationStatus: row.verification_status ?? "verified",
    notes: row.notes ?? undefined,
  };
}

async function fetchSupabasePerformances() {
  if (!supabaseKey) {
    throw new Error(
      "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured",
    );
  }

  const rows: SupabasePerformanceRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(supabaseRestUrl(offset), {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      next: {
        revalidate: revalidateSeconds,
        tags: ["performances"],
      },
    } as RequestInit & { next: { revalidate: number; tags: string[] } });

    if (!response.ok) {
      throw new Error(
        `Supabase performances fetch failed: ${response.status} ${await response.text()}`,
      );
    }

    const page = (await response.json()) as SupabasePerformanceRow[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows.map(rowToPerformance);
}

async function getStaticPerformances() {
  return [];
}

async function loadSourcePerformances() {
  if (!isSupabasePerformanceStoreConfigured()) {
    return getStaticPerformances();
  }

  try {
    return await fetchSupabasePerformances();
  } catch (error) {
    console.error(error);
    return getStaticPerformances();
  }
}

export function getSourcePerformances() {
  sourcePerformancesPromise ??= loadSourcePerformances();
  return sourcePerformancesPromise;
}
