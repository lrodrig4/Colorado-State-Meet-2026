import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Classification } from "@/types/domain";

type MascotCsvRow = {
  school_id: string;
  school_name: string;
  classification: Classification;
  mascot_name?: string;
  source_url?: string;
  source_label?: string;
  local_png_path?: string;
  storage_path?: string;
  license_status?: string;
  dominant_color?: string;
  accent_color?: string;
};

const requiredColumns = new Set([
  "school_id",
  "school_name",
  "classification",
  "local_png_path",
  "storage_path",
  "license_status",
]);

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function cleanSupabaseUrl(value: string | undefined) {
  return value?.replace(/\/+$/, "");
}

function bucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_MASCOT_BUCKET || "school-mascots";
}

function encodeStoragePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseRows(csv: string): MascotCsvRow[] {
  const parsed = parseCsv(csv);
  const [header, ...rows] = parsed;

  if (!header) {
    throw new Error("CSV is empty.");
  }

  const normalizedHeader = header.map((column) => column.trim());
  for (const column of requiredColumns) {
    if (!normalizedHeader.includes(column)) {
      throw new Error(`CSV is missing required column "${column}".`);
    }
  }

  return rows.map((values) => {
    const row: Record<string, string> = {};
    normalizedHeader.forEach((column, index) => {
      row[column] = values[index]?.trim() ?? "";
    });

    return row as MascotCsvRow;
  });
}

async function fileExists(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function uploadObject({
  supabaseUrl,
  serviceRoleKey,
  storagePath,
  localPngPath,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  storagePath: string;
  localPngPath: string;
}) {
  const buffer = await readFile(localPngPath);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName()}/${encodeStoragePath(
    storagePath,
  )}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(
      `Storage upload failed for ${storagePath}: ${response.status} ${await response.text()}`,
    );
  }
}

async function upsertMetadata({
  supabaseUrl,
  serviceRoleKey,
  row,
  publicUrl,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  row: MascotCsvRow;
  publicUrl: string;
}) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/school_brand_assets?on_conflict=school_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        school_id: row.school_id,
        school_name: row.school_name,
        classification: row.classification,
        mascot_name: row.mascot_name || null,
        mascot_asset_path: row.storage_path || null,
        mascot_public_url: publicUrl,
        source_url: row.source_url || null,
        source_label: row.source_label || null,
        license_status: "approved",
        dominant_color: row.dominant_color || null,
        accent_color: row.accent_color || null,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Metadata upsert failed for ${row.school_id}: ${response.status} ${await response.text()}`,
    );
  }
}

async function main() {
  const filePath = path.resolve(
    getArg("file") || "reports/school-mascot-import-template.csv",
  );
  const supabaseUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  const rows = parseRows(await readFile(filePath, "utf8"));
  const approvedRows = rows.filter((row) => row.license_status === "approved");

  if (!approvedRows.length) {
    console.log("No approved mascot rows found. Mark rows approved before upload.");
    return;
  }

  for (const row of approvedRows) {
    if (!row.local_png_path || !row.storage_path) {
      throw new Error(`${row.school_id} needs local_png_path and storage_path.`);
    }
    if (!row.storage_path.endsWith(".png")) {
      throw new Error(`${row.school_id} storage_path must end in .png.`);
    }

    const localPngPath = path.resolve(row.local_png_path);
    if (!(await fileExists(localPngPath))) {
      throw new Error(`${row.school_id} PNG not found at ${localPngPath}.`);
    }

    await uploadObject({
      supabaseUrl,
      serviceRoleKey,
      storagePath: row.storage_path,
      localPngPath,
    });

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName()}/${encodeStoragePath(
      row.storage_path,
    )}`;

    await upsertMetadata({
      supabaseUrl,
      serviceRoleKey,
      row,
      publicUrl,
    });

    console.log(`Uploaded ${row.school_name} -> ${row.storage_path}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
