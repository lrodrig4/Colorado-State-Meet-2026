import { findSchoolByNameOrAlias } from "@/lib/data/schools";
import { localSchoolBrandAssets } from "@/lib/data/schoolBranding.generated";
import { slugify } from "@/lib/utils/text";
import type { Classification } from "@/types/domain";
import type { SchoolBrandAsset, SchoolBrandLicenseStatus } from "@/types/schoolBranding";

type SchoolBrandAssetRow = {
  school_id: string;
  school_name: string;
  classification: Classification;
  mascot_name: string | null;
  mascot_asset_path: string | null;
  mascot_public_url: string | null;
  source_url: string | null;
  source_label: string | null;
  license_status: SchoolBrandLicenseStatus;
  dominant_color: string | null;
  accent_color: string | null;
  updated_at: string | null;
};

const BRAND_ASSET_COLUMNS = [
  "school_id",
  "school_name",
  "classification",
  "mascot_name",
  "mascot_asset_path",
  "mascot_public_url",
  "source_url",
  "source_label",
  "license_status",
  "dominant_color",
  "accent_color",
  "updated_at",
].join(",");

function cleanSupabaseUrl(value: string | undefined) {
  return value?.replace(/\/+$/, "");
}

function publicBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_MASCOT_BUCKET || "school-mascots";
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function schoolBrandAssetId(
  schoolName: string,
  classification: Classification,
) {
  const school = findSchoolByNameOrAlias(schoolName);

  if (school?.classification === classification) {
    return school.id;
  }

  return slugify(`${schoolName}-${classification}`);
}

function rowToAsset(
  row: SchoolBrandAssetRow,
  supabaseUrl: string,
): SchoolBrandAsset {
  const publicUrl =
    row.mascot_public_url ||
    (row.mascot_asset_path
      ? `${supabaseUrl}/storage/v1/object/public/${publicBucketName()}/${encodeStoragePath(
          row.mascot_asset_path,
        )}`
      : undefined);

  return {
    schoolId: row.school_id,
    schoolName: row.school_name,
    classification: row.classification,
    mascotName: row.mascot_name ?? undefined,
    mascotAssetPath: row.mascot_asset_path ?? undefined,
    mascotPublicUrl: publicUrl,
    sourceUrl: row.source_url ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    licenseStatus: row.license_status,
    dominantColor: row.dominant_color ?? undefined,
    accentColor: row.accent_color ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function fetchSupabaseBrandAsset(
  schoolId: string,
): Promise<SchoolBrandAsset | undefined> {
  const supabaseUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return undefined;

  const endpoint = new URL(`${supabaseUrl}/rest/v1/school_brand_assets`);
  endpoint.searchParams.set("school_id", `eq.${schoolId}`);
  endpoint.searchParams.set("license_status", "eq.approved");
  endpoint.searchParams.set("select", BRAND_ASSET_COLUMNS);
  endpoint.searchParams.set("limit", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      next: { revalidate: 60 * 60 * 24 },
    } as RequestInit & { next: { revalidate: number } });

    if (!response.ok) return undefined;

    const rows = (await response.json()) as SchoolBrandAssetRow[];
    const row = rows[0];

    return row ? rowToAsset(row, supabaseUrl) : undefined;
  } catch {
    return undefined;
  }
}

export async function getSchoolBrandAssetForTeam(
  schoolName: string,
  classification: Classification,
) {
  const schoolId = schoolBrandAssetId(schoolName, classification);
  const supabaseAsset = await fetchSupabaseBrandAsset(schoolId);

  return supabaseAsset ?? localSchoolBrandAssets[schoolId];
}
